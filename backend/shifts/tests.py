"""
Smoke tests for the rules that are expensive to get wrong.

Small on purpose — §10 asks only for manual test cases as a minimum. These
cover the handful of behaviours where a silent failure would corrupt data or
break a requirement, and they run in a few seconds.
"""

import uuid
from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest import mock
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import QuerySet
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from missions import services as mission_services
from missions.models import Mission

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


class ActiveShiftsMissionTests(TestCase):
    """
    §4.6 marker colour. The contract counts an officer as busy only once they
    have acknowledged, so ASSIGNED must still read as available.
    """

    def setUp(self):
        self.officer = make_user("mission_officer")
        self.dispatcher = make_user("mission_dispatcher", role="dispatcher")
        services.start_shift(self.officer)
        self.client = APIClient()
        self.client.force_authenticate(self.dispatcher)

    def _assign(self, title, priority=Mission.Priority.HIGH):
        return mission_services.create_mission(
            created_by=self.dispatcher,
            title=title,
            latitude=34.4367,
            longitude=35.8497,
            priority=priority,
            assigned_to=self.officer,
        )

    def _row(self):
        response = self.client.get("/api/v1/shifts/active/")
        self.assertEqual(response.status_code, 200)
        return response.json()[0]

    def test_acknowledged_mission_makes_the_officer_in_mission(self):
        mission = self._assign("Traffic obstruction on Al-Mina road")
        mission_services.acknowledge_mission(mission, officer=self.officer)

        row = self._row()
        self.assertEqual(row["status"], "in_mission")
        # Exactly these four fields; the drawer fetches the rest by id.
        self.assertEqual(
            row["current_mission"],
            {
                "id": mission.id,
                "title": "Traffic obstruction on Al-Mina road",
                "priority": "high",
                "status": "acknowledged",
            },
        )

    def test_assigned_but_unacknowledged_officer_is_still_available(self):
        """Showing them as busy would hide a free officer from the dispatcher."""
        self._assign("Sent but not yet seen")

        row = self._row()
        self.assertEqual(row["status"], "available")
        self.assertIsNone(row["current_mission"])

    def test_two_open_missions_show_the_most_recently_assigned(self):
        older = self._assign("Assigned an hour ago")
        mission_services.acknowledge_mission(older, officer=self.officer)
        newer = self._assign("Assigned just now")
        mission_services.acknowledge_mission(newer, officer=self.officer)

        # Both were assigned in the same test tick; space them out so the
        # ordering under test is the one being asserted, not clock luck.
        now = timezone.now()
        Mission.objects.filter(pk=older.pk).update(
            assigned_at=now - timezone.timedelta(hours=1)
        )
        Mission.objects.filter(pk=newer.pk).update(assigned_at=now)

        row = self._row()
        self.assertEqual(row["status"], "in_mission")
        self.assertEqual(row["current_mission"]["id"], newer.id)


class DistanceCachingTests(TestCase):
    """shift.distance_m is now the read path; ingest is what keeps it correct."""

    def setUp(self):
        self.officer = make_user("officer7")

    def test_ingest_sets_distance_m_to_match_shift_distance_m(self):
        shift, _ = services.start_shift(self.officer)
        now = timezone.now()
        services.ingest_pings(
            self.officer,
            [
                ping_row(34.4367, 35.8497, now),
                ping_row(34.4467, 35.8497, now + timezone.timedelta(seconds=30)),
            ],
        )
        shift.refresh_from_db()
        self.assertGreater(shift.distance_m, 0)
        self.assertEqual(shift.distance_m, services.shift_distance_m(shift))

    def test_out_of_order_offline_batch_still_totals_correctly(self):
        """A second batch with pings recorded BEFORE the first batch's pings
        is the offline-sync case full recompute exists for: an incremental
        add would miss the earlier segment entirely."""
        shift, _ = services.start_shift(self.officer)
        now = timezone.now()

        services.ingest_pings(
            self.officer,
            [
                ping_row(34.4367, 35.8497, now + timezone.timedelta(seconds=60)),
                ping_row(34.4467, 35.8497, now + timezone.timedelta(seconds=90)),
            ],
        )
        services.ingest_pings(
            self.officer,
            [ping_row(34.4267, 35.8497, now)],
        )

        shift.refresh_from_db()
        expected = services.shift_distance_m(shift)
        self.assertEqual(shift.distance_m, expected)
        # Prove the earlier-recorded ping actually contributes: recomputing
        # from just the first batch would undercount.
        self.assertGreater(
            expected,
            services.trail_distance_m(
                shift.pings.filter(recorded_at__gt=now).order_by("recorded_at")
            ),
        )


class ActiveShiftsQueryCountTests(TestCase):
    """Cost must not scale with officer count — that was the whole bug."""

    def _seed_active_officers(self, prefix, count):
        officers = []
        for i in range(count):
            officer = make_user(f"{prefix}_officer_{i}")
            services.start_shift(officer)
            services.ingest_pings(
                officer,
                [ping_row(34.4367, 35.8497, timezone.now())],
            )
            officers.append(officer)
        return officers

    def _query_count_for_active_shifts(self, prefix, officer_count):
        officers = self._seed_active_officers(prefix, officer_count)
        client = APIClient()
        client.force_authenticate(make_user(f"{prefix}_dispatcher", role="dispatcher"))
        with CaptureQueriesContext(connection) as ctx:
            response = client.get("/api/v1/shifts/active/")
        self.assertEqual(response.status_code, 200)
        # Reset to an empty active set so the next seeding measures exactly
        # its own officer count, not this batch plus the next one.
        for officer in officers:
            services.end_shift(officer)
        return len(ctx)

    def test_query_count_does_not_scale_with_officer_count(self):
        two_officers = self._query_count_for_active_shifts("qc2", 2)
        five_officers = self._query_count_for_active_shifts("qc5", 5)
        self.assertEqual(two_officers, five_officers)


class TrailDayBoundaryTests(TestCase):
    """
    §5 — "today" is a Beirut day, not a UTC one.

    Beirut runs UTC+2/+3, so a night-shift officer's 01:00 ping is stored at
    22:00 or 23:00 UTC the day before. Under TIME_ZONE = "UTC" both the default
    day and the window around it came out a day early, and the ping landed on
    yesterday's trail. §4.8 reports are per officer per day, so this boundary
    has to be the local one before they are built on top of it.
    """

    def setUp(self):
        self.officer = make_user("night_officer")
        self.client = APIClient()
        self.client.force_authenticate(self.officer)

    def _record_ping_at(self, when):
        """Store one ping at an exact instant, bypassing ingest's freshness
        rules — those are covered elsewhere and are not what this asserts."""
        shift, _ = services.start_shift(self.officer)
        Shift.objects.filter(pk=shift.pk).update(started_at=when - timedelta(hours=1))
        LocationPing.objects.create(
            client_uuid=uuid.uuid4(),
            shift=shift,
            officer=self.officer,
            latitude=Decimal("34.436700"),
            longitude=Decimal("35.849700"),
            recorded_at=when,
        )

    def _trail(self, query=""):
        response = self.client.get(f"/api/v1/officers/{self.officer.id}/trail/{query}")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_a_0100_beirut_ping_belongs_to_that_beirut_day(self):
        today = timezone.localdate()
        one_am = datetime.combine(today, time(1, 0), tzinfo=ZoneInfo("Asia/Beirut"))

        # The premise of the test: this instant really is the previous UTC day.
        # If it were not, the assertions below would pass under UTC too and
        # prove nothing about the boundary.
        self.assertEqual(
            one_am.astimezone(dt_timezone.utc).date(), today - timedelta(days=1)
        )

        self._record_ping_at(one_am)

        todays = self._trail()
        self.assertEqual(todays["date"], today.isoformat())
        self.assertEqual(todays["point_count"], 1)

        yesterday = (today - timedelta(days=1)).isoformat()
        self.assertEqual(self._trail(f"?date={yesterday}")["point_count"], 0)


class StartShiftRaceRecoveryTests(TestCase):
    """
    §4.2 — a retrying phone must not get an error, even when it loses a race.

    Two requests can both pass the "already on shift?" check before either
    inserts; the loser's INSERT then hits unique_active_shift_per_officer.
    Recovery means querying for the winner's shift, and on Postgres that only
    works if the failed INSERT was rolled back to a savepoint — otherwise the
    surrounding transaction is aborted and the recovery query raises
    TransactionManagementError instead.
    """

    def test_losing_the_race_returns_the_winners_shift(self):
        officer = make_user("racer")
        winner, created = services.start_shift(officer)
        self.assertTrue(created)

        # Stand in for the race without threads: blind the first "already
        # active?" lookup so the create runs against a shift that really is
        # there. The constraint fires for real and the recovery path is the
        # thing under test.
        real_first = QuerySet.first
        blinded = []

        def blind_first(self, *args, **kwargs):
            if not blinded and self.model is Shift:
                blinded.append(True)
                return None
            return real_first(self, *args, **kwargs)

        with mock.patch.object(QuerySet, "first", blind_first):
            shift, created = services.start_shift(officer)

        self.assertTrue(blinded, "the lookup was never blinded; the race never happened")
        self.assertFalse(created)
        self.assertEqual(shift.pk, winner.pk)
        self.assertEqual(Shift.objects.filter(officer=officer).count(), 1)
