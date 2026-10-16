"""
Smoke tests for the rules that are expensive to get wrong.

Small on purpose — §10 asks only for manual test cases as a minimum. These
cover the handful of behaviours where a silent failure would corrupt data or
break a requirement, and they run in a few seconds.
"""

import uuid
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from io import StringIO
from unittest import mock
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.db.models import QuerySet
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from core.registry import get_setting, invalidate_cache, set_settings
from missions import services as mission_services
from missions.models import Mission, MissionWork
from notifications.models import Notification, NotificationType

from . import services
from .models import DutyTargetReminder, LocationPing, Shift
from panic import services as panic_services
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


def go_on_duty(officer, **kwargs):
    return services.start_shift(officer, **kwargs)


BEIRUT = ZoneInfo("Asia/Beirut")


def beirut(day, hour, minute=0):
    return datetime.combine(day, time(hour, minute), tzinfo=BEIRUT)


def make_shift(officer, started_at, ended_at=None):
    """A shift at exact instants, bypassing start_shift's use of now()."""
    return Shift.objects.create(
        officer=officer,
        started_at=started_at,
        ended_at=ended_at,
        status=Shift.Status.ACTIVE if ended_at is None else Shift.Status.ENDED,
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

    def test_end_shift_blocked_while_mission_in_progress(self):
        """An officer actively on a mission cannot go offline mid-task."""
        dispatcher = make_user("disp", role="dispatcher")
        services.start_shift(self.officer)
        mission = mission_services.create_mission(
            created_by=dispatcher,
            title="Pothole on Al-Mina road",
            latitude=34.4367,
            longitude=35.8497,
            priority=Mission.Priority.HIGH,
            officers=[self.officer],
        )
        mission_services.start_mission(mission, officer=self.officer)

        with self.assertRaises(services.ShiftError):
            services.end_shift(self.officer)

        # The shift must still be active — the end was rejected, not half-applied.
        self.assertTrue(
            Shift.objects.filter(
                officer=self.officer, status=Shift.Status.ACTIVE
            ).exists()
        )

    def test_end_shift_allowed_with_assigned_but_unstarted_mission(self):
        """A mission that was sent but never started does not pin the officer on duty."""
        dispatcher = make_user("disp", role="dispatcher")
        services.start_shift(self.officer)
        mission_services.create_mission(
            created_by=dispatcher,
            title="Not started yet",
            latitude=34.4367,
            longitude=35.8497,
            officers=[self.officer],
        )

        ended = services.end_shift(self.officer)
        self.assertEqual(ended.status, Shift.Status.ENDED)

    def test_end_shift_allowed_once_mission_no_longer_in_progress(self):
        """Closing the mission's work period frees the officer to end the shift."""
        dispatcher = make_user("disp", role="dispatcher")
        services.start_shift(self.officer)
        mission = mission_services.create_mission(
            created_by=dispatcher,
            title="Cleared elsewhere",
            latitude=34.4367,
            longitude=35.8497,
            officers=[self.officer],
        )
        mission_services.start_mission(mission, officer=self.officer)
        mission_services.cancel_mission(
            mission, actor=dispatcher, reason="Resolved on site."
        )

        ended = services.end_shift(self.officer)
        self.assertEqual(ended.status, Shift.Status.ENDED)

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
        go_on_duty(officer)
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
                "duty_seconds_today",
                "target_seconds",
                "distance_covered_m",
                "latest_ping",
                "position_source",
                "current_mission",
            },
        )
        self.assertEqual(set(row["officer"]), {"id", "full_name", "badge_number"})
        self.assertEqual(row["officer"]["badge_number"], "TP-1001")
        self.assertIsNotNone(row["latest_ping"])

    def test_officer_with_no_pings_yet_still_appears(self):
        """Just started a shift, no GPS fix yet — must not vanish from the map."""
        go_on_duty(make_user("officer6"))

        client = APIClient()
        client.force_authenticate(make_user("supervisor2", role="supervisor"))
        row = client.get("/api/v1/shifts/active/").json()[0]
        self.assertIsNone(row["latest_ping"])


class ActiveShiftsMissionTests(TestCase):
    def setUp(self):
        self.officer = make_user("mission_officer")
        self.dispatcher = make_user("mission_dispatcher", role="dispatcher")
        go_on_duty(self.officer)
        self.client = APIClient()
        self.client.force_authenticate(self.dispatcher)

    def _assign(self, title, priority=Mission.Priority.HIGH):
        return mission_services.create_mission(
            created_by=self.dispatcher,
            title=title,
            latitude=34.4367,
            longitude=35.8497,
            priority=priority,
            officers=[self.officer],
        )

    def _row(self):
        response = self.client.get("/api/v1/shifts/active/")
        self.assertEqual(response.status_code, 200)
        return response.json()[0]

    def test_started_mission_makes_the_officer_in_mission(self):
        mission = self._assign("Traffic obstruction on Al-Mina road")
        mission_services.start_mission(mission, officer=self.officer)

        row = self._row()
        self.assertEqual(row["status"], "in_mission")
        # Exactly these four fields; the drawer fetches the rest by id.
        self.assertEqual(
            row["current_mission"],
            {
                "id": mission.id,
                "title": "Traffic obstruction on Al-Mina road",
                "priority": "high",
                "status": "in_progress",
            },
        )

    def test_assigned_but_not_started_officer_is_still_available(self):
        """Showing them as busy would hide a free officer from the dispatcher."""
        self._assign("Sent but not yet started")

        row = self._row()
        self.assertEqual(row["status"], "available")
        self.assertIsNone(row["current_mission"])
        
    def test_cancelled_mission_makes_the_officer_available_again(self):
        mission = self._assign("Finished job")
        mission_services.start_mission(mission, officer=self.officer)
        mission_services.cancel_mission(mission, actor=self.dispatcher, reason="Done elsewhere.")

        row = self._row()
        self.assertEqual(row["status"], "available")
        self.assertIsNone(row["current_mission"])

    def test_an_urgent_mission_takes_over_the_marker(self):
        routine = self._assign("Routine patrol", priority=Mission.Priority.LOW)
        mission_services.start_mission(routine, officer=self.officer)
        urgent = self._assign("Officer down", priority=Mission.Priority.URGENT)
        mission_services.start_mission(urgent, officer=self.officer)

        row = self._row()
        self.assertEqual(row["status"], "in_mission")
        self.assertEqual(row["current_mission"]["id"], urgent.id)

    def test_officer_on_a_paused_mission_is_available(self):
        routine = self._assign("Routine patrol", priority=Mission.Priority.LOW)
        mission_services.start_mission(routine, officer=self.officer)
        urgent = self._assign("Officer down", priority=Mission.Priority.URGENT)
        mission_services.start_mission(urgent, officer=self.officer)
        mission_services.cancel_mission(urgent, actor=self.dispatcher, reason="False alarm.")

        row = self._row()
        self.assertEqual(row["status"], "available")
        self.assertIsNone(row["current_mission"])
        self.assertFalse(MissionWork.objects.filter(officer=self.officer, ended_at__isnull=True).exists())
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
            go_on_duty(officer)
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


class ActiveShiftsPanicTests(TestCase):
    def setUp(self):
        self.officer = make_user("panic_officer")
        go_on_duty(self.officer)
        self.client = APIClient()
        self.client.force_authenticate(make_user("panic_dispatcher", role="dispatcher"))

    def _row(self):
        response = self.client.get("/api/v1/shifts/active/")
        self.assertEqual(response.status_code, 200)
        return response.json()[0]

    def test_panic_without_pings_puts_the_officer_on_the_map(self):
        panic_services.trigger_panic(self.officer, latitude=34.4367, longitude=35.8497)

        row = self._row()
        self.assertEqual(row["status"], "panic")
        self.assertEqual(row["position_source"], "panic")
        self.assertEqual(Decimal(row["latest_ping"]["latitude"]), Decimal("34.436700"))

    def test_a_newer_ping_wins_over_the_panic_position(self):
        panic_services.trigger_panic(self.officer, latitude=34.4367, longitude=35.8497)
        services.ingest_pings(
            self.officer,
            [ping_row(34.4400, 35.8500, timezone.now() + timedelta(seconds=30))],
        )

        row = self._row()
        self.assertEqual(row["status"], "panic")
        self.assertEqual(row["position_source"], "ping")

    def test_resolved_panic_no_longer_turns_the_marker_red(self):
        event, _ = panic_services.trigger_panic(
            self.officer, latitude=34.4367, longitude=35.8497
        )
        panic_services.resolve_panic(event, make_user("panic_supervisor", role="supervisor"))

        row = self._row()
        self.assertEqual(row["status"], "available")
        self.assertNotEqual(row["position_source"], "panic")


class SettingsCacheMixin:
    """
    get_setting() caches in a process-wide LocMemCache that outlives the
    rolled-back rows, so a test that changes a setting must not leak it.
    """

    def setUp(self):
        super().setUp()
        invalidate_cache()
        self.addCleanup(invalidate_cache)


# Away from either DST change, so every day here is 24 hours long.
DAY = date(2026, 9, 10)


class DailyDutySecondsTests(TestCase):
    """
    Duty is a daily target worked in as many stints as the officer needs, so
    the day's total has to add them up, clipped to the Beirut day.
    """

    def setUp(self):
        self.officer = make_user("duty_officer")

    def test_one_stint(self):
        make_shift(self.officer, beirut(DAY, 8), beirut(DAY, 12))

        self.assertEqual(services.daily_duty_seconds(self.officer, DAY), 4 * 3600)

    def test_three_stints_are_summed(self):
        make_shift(self.officer, beirut(DAY, 7), beirut(DAY, 9))
        make_shift(self.officer, beirut(DAY, 11), beirut(DAY, 14, 30))
        make_shift(self.officer, beirut(DAY, 18), beirut(DAY, 19, 15))
        # Someone else's duty is not this officer's.
        make_shift(make_user("other_officer"), beirut(DAY, 8), beirut(DAY, 16))

        self.assertEqual(
            services.daily_duty_seconds(self.officer, DAY), int(6.75 * 3600)
        )

    def test_an_active_stint_counts_up_to_now(self):
        make_shift(self.officer, beirut(DAY, 8), beirut(DAY, 10))
        make_shift(self.officer, beirut(DAY, 14))

        seconds = services.daily_duty_seconds(self.officer, DAY, now=beirut(DAY, 16, 30))

        self.assertEqual(seconds, int(4.5 * 3600))

    def test_a_shift_crossing_midnight_is_split_between_the_days(self):
        """Counted once in total, never in full on both days."""
        make_shift(self.officer, beirut(DAY, 20), beirut(DAY + timedelta(days=1), 2))

        self.assertEqual(services.daily_duty_seconds(self.officer, DAY), 4 * 3600)
        self.assertEqual(
            services.daily_duty_seconds(self.officer, DAY + timedelta(days=1)), 2 * 3600
        )

    def test_defaults_to_the_local_day_of_now(self):
        """01:00 Beirut is still the previous UTC day; the total must not be."""
        make_shift(self.officer, beirut(DAY, 0, 30), beirut(DAY, 1, 30))

        seconds = services.daily_duty_seconds(self.officer, now=beirut(DAY, 2))

        self.assertEqual(seconds, 3600)


class TodayDutyEndpointTests(SettingsCacheMixin, TestCase):
    """GET /shifts/today/ — what replaces the app's per-shift counter."""

    NOW = beirut(DAY, 15)

    def setUp(self):
        super().setUp()
        self.officer = make_user("today_officer")
        self.client = APIClient()
        self.client.force_authenticate(self.officer)
        patcher = mock.patch("django.utils.timezone.now", return_value=self.NOW)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _today(self, query=""):
        response = self.client.get(f"/api/v1/shifts/today/{query}")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_on_shift_counts_every_stint_and_the_active_one(self):
        make_shift(self.officer, beirut(DAY, 8), beirut(DAY, 10))
        make_shift(self.officer, beirut(DAY, 13))

        body = self._today()

        self.assertEqual(body["date"], DAY.isoformat())
        self.assertEqual(body["duty_seconds_today"], 4 * 3600)
        self.assertEqual(body["target_seconds"], 8 * 3600)
        self.assertEqual(
            datetime.fromisoformat(body["active_shift_started_at"]), beirut(DAY, 13)
        )
        self.assertEqual(body["active_shift_seconds"], 2 * 3600)

    def test_off_shift_after_a_split(self):
        make_shift(self.officer, beirut(DAY, 8), beirut(DAY, 10))
        make_shift(self.officer, beirut(DAY, 11), beirut(DAY, 12, 30))

        body = self._today()

        self.assertEqual(body["duty_seconds_today"], int(3.5 * 3600))
        self.assertIsNone(body["active_shift_started_at"])
        self.assertEqual(body["active_shift_seconds"], 0)

    def test_a_shift_from_last_night_counts_only_from_midnight(self):
        """The total is today's; the active shift's own length is not clipped."""
        # 23:00 to 15:00 is past the default max_shift_hours; raise it here.
        set_settings({"max_shift_hours": 24})
        make_shift(self.officer, beirut(DAY - timedelta(days=1), 23))

        body = self._today()

        self.assertEqual(body["duty_seconds_today"], 15 * 3600)
        self.assertEqual(body["active_shift_seconds"], 16 * 3600)

    def test_target_follows_the_setting(self):
        set_settings({"daily_duty_target_hours": 6})

        self.assertEqual(self._today()["target_seconds"], 6 * 3600)

    def test_a_forgotten_shift_is_closed_before_reporting(self):
        """Past max_shift_hours the officer is not told they are still on duty."""
        make_shift(self.officer, beirut(DAY, 3))

        body = self._today()

        self.assertEqual(body["duty_seconds_today"], 10 * 3600)
        self.assertIsNone(body["active_shift_started_at"])
        self.assertEqual(body["active_shift_seconds"], 0)

    def test_an_officer_cannot_read_another_officers_totals(self):
        other = make_user("today_other")
        make_shift(other, beirut(DAY, 9))

        body = self._today(f"?officer_id={other.id}")

        self.assertEqual(body["duty_seconds_today"], 0)
        self.assertIsNone(body["active_shift_started_at"])

    def test_dispatcher_is_refused(self):
        self.client.force_authenticate(make_user("today_dispatcher", role="dispatcher"))

        response = self.client.get("/api/v1/shifts/today/")

        self.assertEqual(response.status_code, 403)


class EndExpiredShiftsTests(SettingsCacheMixin, TestCase):
    """
    §4.2 — a phone that dies mid-patrol never sends End Shift, so the officer
    would stay on the map for days. No single stint runs past
    max_shift_hours; the daily target is never enforced here.
    """

    def setUp(self):
        super().setUp()
        self.officer = make_user("expiry_officer")
        self.now = timezone.now()

    def test_a_shift_past_the_limit_ends_at_the_limit(self):
        """Not when the sweep noticed — the report must show real hours."""
        shift = make_shift(self.officer, self.now - timedelta(hours=11))

        ended = services.end_expired_shifts(now=self.now)

        self.assertEqual([s.pk for s in ended], [shift.pk])
        shift.refresh_from_db()
        self.assertEqual(shift.status, Shift.Status.ENDED)
        self.assertTrue(shift.ended_automatically)
        self.assertEqual(
            shift.ended_at,
            shift.started_at + timedelta(hours=get_setting("max_shift_hours")),
        )

    def test_the_limit_follows_the_setting(self):
        set_settings({"max_shift_hours": 6})
        shift = make_shift(self.officer, self.now - timedelta(hours=7))

        services.end_expired_shifts(now=self.now)

        shift.refresh_from_db()
        self.assertEqual(shift.ended_at, shift.started_at + timedelta(hours=6))

    def test_a_shift_under_the_limit_is_left_alone(self):
        """Past the 8-hour target is fine; only the safety net ends a shift."""
        shift = make_shift(self.officer, self.now - timedelta(hours=9))

        ended = services.end_expired_shifts(now=self.now)

        self.assertEqual(ended, [])
        shift.refresh_from_db()
        self.assertEqual(shift.status, Shift.Status.ACTIVE)
        self.assertIsNone(shift.ended_at)
        self.assertFalse(shift.ended_automatically)

    def test_an_ended_shift_is_left_alone(self):
        """end_shift() is the officer's own record; the sweep must not rewrite it."""
        shift = make_shift(
            self.officer,
            self.now - timedelta(hours=14),
            self.now - timedelta(hours=12),
        )
        original_end = shift.ended_at

        ended = services.end_expired_shifts(now=self.now)

        self.assertEqual(ended, [])
        shift.refresh_from_db()
        self.assertEqual(shift.ended_at, original_end)
        self.assertFalse(shift.ended_automatically)

    def test_running_the_sweep_twice_ends_nothing_the_second_time(self):
        """ActiveShiftsView calls this on every poll — it has to be a no-op."""
        make_shift(self.officer, self.now - timedelta(hours=11))

        first = services.end_expired_shifts(now=self.now)
        second = services.end_expired_shifts(now=self.now)

        self.assertEqual(len(first), 1)
        self.assertEqual(second, [])


class SimulateOfficersTests(TestCase):
    """The demo harness still issues tokens; the sweep no longer reads them."""

    def test_simulated_officers_stay_on_duty_and_stop_cleanly(self):
        out = StringIO()
        call_command(
            "simulate_officers", officers=2, minutes=0, backfill_minutes=30, stdout=out
        )

        active = Shift.objects.filter(
            officer__username__startswith="sim_officer_", status=Shift.Status.ACTIVE
        )
        self.assertEqual(active.count(), 2)

        self.assertEqual(services.end_expired_shifts(), [])
        self.assertEqual(active.count(), 2)

        call_command("simulate_officers", stop=True, stdout=out)
        self.assertEqual(active.count(), 0)


class DutyTargetReminderTests(SettingsCacheMixin, TestCase):
    """
    The officer is warned once a day as they approach the daily target
    (default 8h, reminded 15 minutes before). It rides on ping ingest, since
    there is no scheduler.
    """

    def setUp(self):
        super().setUp()
        self.officer = make_user("reminder_officer")
        patcher = mock.patch("django.utils.timezone.now", return_value=beirut(DAY, 8))
        self.clock = patcher.start()
        self.addCleanup(patcher.stop)

    def _ingest_at(self, when):
        self.clock.return_value = when
        return services.ingest_pings(self.officer, [ping_row(34.4367, 35.8497, when)])

    def _reminders(self):
        return Notification.objects.filter(
            notification_type=NotificationType.DUTY_TARGET_REMINDER
        )

    def test_below_the_threshold_nothing_is_sent(self):
        make_shift(self.officer, beirut(DAY, 8))

        self._ingest_at(beirut(DAY, 15, 44))

        self.assertFalse(self._reminders().exists())
        self.assertFalse(DutyTargetReminder.objects.exists())

    @mock.patch("notifications.push.send_push")
    def test_crossing_the_threshold_sends_exactly_one(self, send_push):
        make_shift(self.officer, beirut(DAY, 8))

        with self.captureOnCommitCallbacks(execute=True):
            self._ingest_at(beirut(DAY, 15, 45))

        reminder = self._reminders().get()
        self.assertEqual(reminder.recipient, self.officer)
        self.assertIn("7h 45m", reminder.body)
        send_push.assert_called_once()
        self.assertEqual(send_push.call_args.args[0], self.officer)

    def test_further_ingests_that_day_send_nothing_more(self):
        make_shift(self.officer, beirut(DAY, 8))

        self._ingest_at(beirut(DAY, 15, 45))
        self._ingest_at(beirut(DAY, 16, 30))
        self._ingest_at(beirut(DAY, 19))  # past the target, still only one

        self.assertEqual(self._reminders().count(), 1)

    def test_the_next_day_sends_again(self):
        make_shift(self.officer, beirut(DAY, 8), beirut(DAY, 17))
        self.clock.return_value = beirut(DAY, 17)
        services.remind_if_near_duty_target(self.officer)

        tomorrow = DAY + timedelta(days=1)
        make_shift(self.officer, beirut(tomorrow, 8))
        self._ingest_at(beirut(tomorrow, 15, 45))

        self.assertEqual(self._reminders().count(), 2)
        self.assertEqual(
            set(DutyTargetReminder.objects.values_list("date", flat=True)),
            {DAY, tomorrow},
        )

    def test_the_daily_total_counts_not_the_current_stint(self):
        """7h, a break, then 45 minutes more: reminded, though this stint is short."""
        make_shift(self.officer, beirut(DAY, 7), beirut(DAY, 14))
        make_shift(self.officer, beirut(DAY, 15))

        self._ingest_at(beirut(DAY, 15, 45))

        self.assertEqual(self._reminders().count(), 1)

    def test_a_notification_failure_does_not_cost_location_data(self):
        make_shift(self.officer, beirut(DAY, 8))

        with mock.patch(
            "shifts.services.notify_duty_target_approaching",
            side_effect=RuntimeError("notification store down"),
        ), self.assertLogs("shifts.services", level="ERROR"):
            result = self._ingest_at(beirut(DAY, 15, 45))

        self.assertEqual(result.accepted, 1)
        self.assertEqual(LocationPing.objects.filter(officer=self.officer).count(), 1)
        # The marker rolled back with the failure, so the next batch retries.
        self.assertFalse(DutyTargetReminder.objects.exists())
        self._ingest_at(beirut(DAY, 15, 46))
        self.assertEqual(self._reminders().count(), 1)

    def test_a_lower_target_moves_the_threshold(self):
        set_settings({"daily_duty_target_hours": 6})
        make_shift(self.officer, beirut(DAY, 8))

        self._ingest_at(beirut(DAY, 13, 44))
        self.assertFalse(self._reminders().exists())

        self._ingest_at(beirut(DAY, 13, 45))
        self.assertEqual(self._reminders().count(), 1)

    def test_a_longer_lead_moves_the_threshold(self):
        set_settings({"duty_reminder_lead_minutes": 60})
        make_shift(self.officer, beirut(DAY, 8))

        self._ingest_at(beirut(DAY, 14, 59))
        self.assertFalse(self._reminders().exists())

        self._ingest_at(beirut(DAY, 15))
        self.assertEqual(self._reminders().count(), 1)


class StartShiftAfterForgottenShiftTests(SettingsCacheMixin, TestCase):
    """
    start_shift returns an existing active shift, so it must not return one
    already past max_shift_hours: the next sweep would end it under the
    officer, and their pings would 409 while the app thinks they are on duty.
    """

    def setUp(self):
        super().setUp()
        self.officer = make_user("forgotten_officer")
        self.client = APIClient()
        self.client.force_authenticate(self.officer)

    def test_a_shift_past_the_limit_is_ended_and_a_new_one_started(self):
        forgotten = make_shift(self.officer, timezone.now() - timedelta(hours=11))

        shift, created = services.start_shift(self.officer)

        self.assertTrue(created)
        self.assertNotEqual(shift.pk, forgotten.pk)
        self.assertEqual(shift.status, Shift.Status.ACTIVE)
        forgotten.refresh_from_db()
        self.assertEqual(forgotten.status, Shift.Status.ENDED)
        self.assertTrue(forgotten.ended_automatically)
        self.assertEqual(
            forgotten.ended_at,
            forgotten.started_at + timedelta(hours=get_setting("max_shift_hours")),
        )

    def test_the_api_answers_201_for_the_new_shift(self):
        make_shift(self.officer, timezone.now() - timedelta(hours=11))

        response = self.client.post("/api/v1/shifts/start/", {}, format="json")

        self.assertEqual(response.status_code, 201)
        live = Shift.objects.get(officer=self.officer, status=Shift.Status.ACTIVE)
        self.assertEqual(response.json()["id"], live.id)

    def test_a_shift_within_the_limit_is_returned_as_is(self):
        current = make_shift(self.officer, timezone.now() - timedelta(hours=9))

        shift, created = services.start_shift(self.officer)

        self.assertFalse(created)
        self.assertEqual(shift.pk, current.pk)
        current.refresh_from_db()
        self.assertEqual(current.status, Shift.Status.ACTIVE)
        self.assertFalse(current.ended_automatically)

    def test_a_retry_after_a_lost_response_gets_the_same_shift(self):
        first = self.client.post("/api/v1/shifts/start/", {}, format="json")
        retry = self.client.post("/api/v1/shifts/start/", {}, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json()["id"], first.json()["id"])

    def test_only_the_starting_officers_shifts_are_swept(self):
        other = make_shift(make_user("other_forgotten"), timezone.now() - timedelta(hours=11))

        services.start_shift(self.officer)

        other.refresh_from_db()
        self.assertEqual(other.status, Shift.Status.ACTIVE)


class ActiveShiftsDutyTotalsTests(SettingsCacheMixin, TestCase):
    """
    The live map has to show the day's duty, not just the current stint:
    under split shifts an officer back from a break would read "0h 00m".
    """

    NOW = beirut(DAY, 15)

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(make_user("duty_dispatcher", role="dispatcher"))
        # Both fields are measured to now; pin it so they cannot straddle a
        # second boundary between the two calculations.
        patcher = mock.patch("django.utils.timezone.now", return_value=self.NOW)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _rows(self):
        response = self.client.get("/api/v1/shifts/active/")
        self.assertEqual(response.status_code, 200)
        return {row["officer"]["id"]: row for row in response.json()}

    def test_several_stints_sum_while_the_shift_duration_stays_current(self):
        officer = make_user("split_officer")
        make_shift(officer, beirut(DAY, 7), beirut(DAY, 9))
        make_shift(officer, beirut(DAY, 10), beirut(DAY, 11, 30))
        make_shift(officer, beirut(DAY, 13))

        row = self._rows()[officer.id]

        self.assertEqual(row["shift_duration_seconds"], 2 * 3600)
        self.assertEqual(row["duty_seconds_today"], int(5.5 * 3600))
        self.assertEqual(row["target_seconds"], 8 * 3600)

    def test_a_first_stint_reports_the_same_value_in_both(self):
        officer = make_user("first_stint_officer")
        make_shift(officer, beirut(DAY, 12))

        row = self._rows()[officer.id]

        self.assertEqual(row["shift_duration_seconds"], 3 * 3600)
        self.assertEqual(row["duty_seconds_today"], row["shift_duration_seconds"])


