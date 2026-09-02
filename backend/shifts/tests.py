"""
Smoke tests for the rules that are expensive to get wrong.

Small on purpose — §10 asks only for manual test cases as a minimum. These
cover the handful of behaviours where a silent failure would corrupt data or
break a requirement, and they run in a few seconds.
"""

import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import services
from .models import LocationPing, Shift

User = get_user_model()


def make_user(username, role="officer", **extra):
    return User.objects.create_user(
        username=username,
        password="test-password",
        full_name=extra.pop("full_name", "اختبار"),
        badge_number=extra.pop("badge_number", username.upper()),
        role=role,
        **extra,
    )


def ping_row(lat, lng, recorded_at, **extra):
    return {
        "client_uuid": extra.pop("client_uuid", uuid.uuid4()),
        "latitude": lat,
        "longitude": lng,
        "recorded_at": recorded_at,
        **extra,
    }


class HaversineTests(TestCase):
    def test_known_distance(self):
        # One degree of latitude is about 111 km anywhere on Earth.
        metres = services.haversine_m(34.0, 35.0, 35.0, 35.0)
        self.assertAlmostEqual(metres, 111_195, delta=500)

    def test_gps_jitter_does_not_accumulate_distance(self):
        """A parked officer must not appear to walk kilometres."""
        officer = make_user("jitter")
        shift, _ = services.start_shift(officer)
        now = timezone.now()
        services.ingest_pings(
            officer,
            [
                ping_row(
                    34.436700 + i * 0.00001,
                    35.849700,
                    now + timezone.timedelta(seconds=i * 30),
                )
                for i in range(20)
            ],
        )
        self.assertLess(services.shift_distance_m(shift), 30)


class ShiftLifecycleTests(TestCase):
    def setUp(self):
        self.officer = make_user("officer1")

    def test_start_is_idempotent(self):
        """A phone that retries after a lost response must not get an error."""
        first, created_first = services.start_shift(self.officer)
        second, created_second = services.start_shift(self.officer)
        self.assertTrue(created_first)
        self.assertFalse(created_second)
        self.assertEqual(first.id, second.id)
        self.assertEqual(Shift.objects.filter(officer=self.officer).count(), 1)

    def test_start_and_end_positions_are_recorded(self):
        shift, _ = services.start_shift(self.officer, latitude=34.4367, longitude=35.8497)
        self.assertIsNotNone(shift.start_latitude)

        ended = services.end_shift(self.officer, latitude=34.4400, longitude=35.8500)
        self.assertIsNotNone(ended.end_latitude)
        self.assertIsNotNone(ended.end_longitude)

    def test_shift_without_positions_is_allowed(self):
        """No GPS fix yet must not block going on duty."""
        shift, _ = services.start_shift(self.officer)
        self.assertIsNone(shift.start_latitude)

    def test_end_without_active_shift_is_rejected(self):
        with self.assertRaises(services.ShiftError):
            services.end_shift(self.officer)

    def test_second_shift_allowed_after_first_ends(self):
        services.start_shift(self.officer)
        services.end_shift(self.officer)
        _, created = services.start_shift(self.officer)
        self.assertTrue(created)

    def test_distance_is_computed_from_pings(self):
        """`shifts_shift` has no distance column — it must come from the trail."""
        services.start_shift(self.officer)
        now = timezone.now()
        services.ingest_pings(
            self.officer,
            [
                ping_row(34.4367, 35.8497, now),
                ping_row(34.4467, 35.8497, now + timezone.timedelta(seconds=30)),
            ],
        )
        shift = services.end_shift(self.officer)
        self.assertGreater(services.shift_distance_m(shift), 1000)


class LocationIngestTests(TestCase):
    def setUp(self):
        self.officer = make_user("officer2")

    def test_no_location_stored_without_an_active_shift(self):
        """§4.2 and §5 — the server half of 'tracking only while on duty'."""
        with self.assertRaises(services.ShiftError):
            services.ingest_pings(self.officer, [ping_row(34.4367, 35.8497, timezone.now())])
        self.assertEqual(LocationPing.objects.count(), 0)

    def test_reupload_of_the_same_batch_is_a_noop(self):
        """§4.3's offline cache guarantees duplicate uploads on retry."""
        services.start_shift(self.officer)
        rows = [ping_row(34.4367 + i * 0.001, 35.8497, timezone.now()) for i in range(5)]

        first = services.ingest_pings(self.officer, rows)
        second = services.ingest_pings(self.officer, rows)

        self.assertEqual(first.accepted, 5)
        self.assertEqual(second.accepted, 0)
        self.assertEqual(second.duplicates, 5)
        self.assertEqual(LocationPing.objects.count(), 5)

    def test_duplicate_uuid_inside_one_batch_is_collapsed(self):
        services.start_shift(self.officer)
        shared = uuid.uuid4()
        now = timezone.now()
        result = services.ingest_pings(
            self.officer,
            [
                ping_row(34.4367, 35.8497, now, client_uuid=shared),
                ping_row(34.4368, 35.8497, now, client_uuid=shared),
            ],
        )
        self.assertEqual(result.accepted, 1)
        self.assertEqual(LocationPing.objects.count(), 1)

    def test_pings_recorded_before_the_shift_are_dropped(self):
        """A stale queue from yesterday must not leak into today's trail."""
        services.start_shift(self.officer)
        stale = timezone.now() - timezone.timedelta(days=1)
        result = services.ingest_pings(self.officer, [ping_row(34.4367, 35.8497, stale)])
        self.assertEqual(result.rejected, 1)
        self.assertEqual(LocationPing.objects.count(), 0)

    def test_offline_sync_flag_is_stored(self):
        """§13 — how much of a trail was reconstructed must be answerable."""
        services.start_shift(self.officer)
        services.ingest_pings(
            self.officer,
            [ping_row(34.4367, 35.8497, timezone.now(), is_offline_sync=True)],
        )
        self.assertTrue(LocationPing.objects.get().is_offline_sync)

    def test_inaccurate_fixes_are_excluded_from_distance(self):
        services.start_shift(self.officer)
        now = timezone.now()
        services.ingest_pings(
            self.officer,
            [
                ping_row(34.4367, 35.8497, now, accuracy_m=5.0),
                ping_row(34.9999, 35.8497, now + timezone.timedelta(seconds=30), accuracy_m=900.0),
                ping_row(34.4368, 35.8497, now + timezone.timedelta(seconds=60), accuracy_m=5.0),
            ],
        )
        shift = services.end_shift(self.officer)
        self.assertLess(services.shift_distance_m(shift), 500)


class PermissionTests(TestCase):
    """§3 and §5 — role rules are enforced server-side, never just in the UI."""

    def setUp(self):
        self.client = APIClient()
        self.officer = make_user("officer3")
        self.other_officer = make_user("officer4")
        self.dispatcher = make_user("dispatcher1", role="dispatcher")

    def test_dispatcher_cannot_start_a_shift(self):
        self.client.force_authenticate(self.dispatcher)
        self.assertEqual(self.client.post("/api/v1/shifts/start/").status_code, 403)

    def test_officer_cannot_read_the_active_map(self):
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.get("/api/v1/shifts/active/").status_code, 403)

    def test_officer_may_read_their_own_trail(self):
        """§5 — officers can see their own location history."""
        self.client.force_authenticate(self.officer)
        response = self.client.get(f"/api/v1/officers/{self.officer.id}/trail/")
        self.assertEqual(response.status_code, 200)

    def test_officer_may_not_read_another_officers_trail(self):
        self.client.force_authenticate(self.officer)
        response = self.client.get(f"/api/v1/officers/{self.other_officer.id}/trail/")
        self.assertEqual(response.status_code, 403)

    def test_dispatcher_may_read_any_trail(self):
        self.client.force_authenticate(self.dispatcher)
        response = self.client.get(f"/api/v1/officers/{self.officer.id}/trail/")
        self.assertEqual(response.status_code, 200)


class ActiveShiftsContractTests(TestCase):
    """The response shape web builds against. If this test changes, web breaks."""

    def test_shape_matches_the_agreed_contract(self):
        officer = make_user("officer5", full_name="سامر عبد الله", badge_number="TP-1001")
        services.start_shift(officer)
        services.ingest_pings(officer, [ping_row(34.4367, 35.8497, timezone.now())])

        client = APIClient()
        client.force_authenticate(make_user("supervisor1", role="supervisor"))
        response = client.get("/api/v1/shifts/active/")

        self.assertEqual(response.status_code, 200)
        row = response.json()[0]
        self.assertEqual(
            set(row),
            {
                "officer",
                "status",
                "shift_started_at",
                "shift_duration_seconds",
                "distance_covered_m",
                "latest_ping",
                "current_mission",
            },
        )
        self.assertEqual(set(row["officer"]), {"id", "full_name", "badge_number"})
        self.assertEqual(row["officer"]["badge_number"], "TP-1001")
        self.assertIsNotNone(row["latest_ping"])

    def test_officer_with_no_pings_yet_still_appears(self):
        """Just started a shift, no GPS fix yet — must not vanish from the map."""
        services.start_shift(make_user("officer6"))

        client = APIClient()
        client.force_authenticate(make_user("supervisor2", role="supervisor"))
        row = client.get("/api/v1/shifts/active/").json()[0]
        self.assertIsNone(row["latest_ping"])
