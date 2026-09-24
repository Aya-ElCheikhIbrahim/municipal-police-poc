"""
Drive fake officers around Tripoli so the dashboard has moving markers before
Android exists.

§11 requires a dispatcher to see at least three officers moving in real time.
This decouples the web squad from Android's schedule and doubles as the demo
harness on the day.

    python manage.py simulate_officers --officers 3 --minutes 30
    python manage.py simulate_officers --badges TP-20028,TP-012AT8 --backfill-minutes 90
    python manage.py simulate_officers --stop --badges TP-20028,TP-012AT8

--backfill-minutes writes the route an officer "already walked" before the
live loop starts, so the day's trail has a shape to show from the first second
of a demo instead of being a single dot until the command has run a while.

--badges drives officers who already exist, so the officer carrying a mission
in the demo is the same one leaving the trail on the map.
"""

import math
import random
import time
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from core.registry import get_setting
from shifts import services
from shifts.models import LocationPing, Shift

User = get_user_model()

# Central Tripoli. Each simulated officer patrols a small area around this.
TRIPOLI_LAT = 34.4367
TRIPOLI_LNG = 35.8497

SIM_USERNAME_PREFIX = "sim_officer_"

SIM_NAMES = [
    "أحمد الخوري",
    "محمد المصري",
    "خالد الحسن",
    "عمر الصايغ",
    "يوسف كرامي",
]


def _split_badges(raw: str) -> list[str]:
    return [badge.strip() for badge in raw.split(",") if badge.strip()]


def _has_live_token(officer) -> bool:
    """The test end_expired_shifts() applies: unexpired and not blacklisted."""
    return OutstandingToken.objects.filter(
        user=officer,
        expires_at__gt=timezone.now(),
        blacklistedtoken__isnull=True,
    ).exists()


class Command(BaseCommand):
    help = "Create simulated officers on shift and stream location pings (§11)."

    def add_arguments(self, parser):
        parser.add_argument("--officers", type=int, default=3)
        parser.add_argument(
            "--minutes", type=int, default=30, help="How long to run for."
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=None,
            help="Seconds between pings. Defaults to the SystemSetting value.",
        )
        parser.add_argument(
            "--backfill-minutes",
            type=int,
            default=0,
            help="Minutes of past route to write before going live, for the trail.",
        )
        parser.add_argument(
            "--backfill-interval",
            type=int,
            default=30,
            help="Seconds between backfilled pings. Separate from --interval, which "
            "is usually shortened for the camera.",
        )
        parser.add_argument(
            "--badges",
            default="",
            help="Comma-separated badge numbers of existing officers to drive "
            "instead of creating simulated ones.",
        )
        parser.add_argument(
            "--stop",
            action="store_true",
            help="End simulated shifts, and any --badges shifts, then exit.",
        )

    def handle(self, *args, **options):
        badges = _split_badges(options["badges"])

        if options["stop"]:
            return self._stop(badges)

        interval = options["interval"] or get_setting("location_ping_interval_seconds")

        if badges:
            officers = [self._existing_officer(badge) for badge in badges]
        else:
            count = min(options["officers"], len(SIM_NAMES))
            officers = [self._ensure_officer(i) for i in range(count)]

        walkers = []
        for officer in officers:
            # A simulated officer never logs in, so nothing would issue them a
            # refresh token — and end_expired_shifts() would close the shift on
            # the dispatcher's next poll. Issuing one gives them a live session
            # for the same 12 hours a real login would. An officer already
            # signed in on a phone has one, and a second would outlive the
            # session their shift belongs to.
            if not _has_live_token(officer):
                RefreshToken.for_user(officer)
            shift, _ = services.start_shift(officer)
            walkers.append(
                Walker(
                    user=officer,
                    shift=shift,
                    lat=TRIPOLI_LAT + random.uniform(-0.01, 0.01),
                    lng=TRIPOLI_LNG + random.uniform(-0.01, 0.01),
                    heading=random.uniform(0, 2 * math.pi),
                )
            )

        self._backfill(
            walkers,
            minutes=options["backfill_minutes"],
            spacing=max(options["backfill_interval"], 1),
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"{len(walkers)} officers on shift, pinging every {interval}s. "
                "Ctrl-C to stop."
            )
        )
        # Badges only, never full_name: a Windows console is cp1252 and an
        # Arabic name raises UnicodeEncodeError, which would kill the run
        # after the shifts had already been started.
        for walker in walkers:
            self.stdout.write(f"  {walker.user.badge_number}")

        deadline = timezone.now() + timedelta(minutes=options["minutes"])
        try:
            while timezone.now() < deadline:
                now = timezone.now()
                LocationPing.objects.bulk_create(
                    [w.step(now) for w in walkers], ignore_conflicts=True
                )
                # bulk_create bypasses services.ingest_pings, which is what
                # normally persists the distance, so recompute it here the
                # same way — otherwise every simulated officer reads as 0 m.
                for walker in walkers:
                    walker.shift.distance_m = services.shift_distance_m(walker.shift)
                    walker.shift.save(update_fields=["distance_m"])
                self.stdout.write(f"  {now:%H:%M:%S}  {len(walkers)} pings")
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("\nInterrupted.")

        self.stdout.write("Done. Shifts left active — run --stop to end them.")

    def _backfill(self, walkers, minutes: int, spacing: int):
        """
        Walk each officer from `minutes` ago up to now, so the trail already
        has a shape the moment the dispatcher clicks them.

        Two clamps on how far back that reaches: local midnight, because the
        trail endpoint serves one calendar day and anything earlier would be
        stored but never shown; and the shift, whose start is pulled back to
        match so the trail does not predate the duty period it belongs to. A
        shift that has been running longer already keeps its own start.
        """
        if minutes <= 0:
            return

        now = timezone.now()
        midnight = timezone.localtime(now).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        earliest = max(now - timedelta(minutes=minutes), midnight)

        rows = []
        for walker in walkers:
            if walker.shift.started_at > earliest:
                walker.shift.started_at = earliest
                walker.shift.save(update_fields=["started_at"])

            start = max(earliest, walker.shift.started_at)
            steps = int((now - start).total_seconds() // spacing)
            rows.extend(
                walker.step(start + timedelta(seconds=step * spacing))
                for step in range(steps)
            )

        LocationPing.objects.bulk_create(rows, ignore_conflicts=True)
        for walker in walkers:
            walker.shift.distance_m = services.shift_distance_m(walker.shift)
            walker.shift.save(update_fields=["distance_m"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Backfilled {len(rows)} pings covering the last "
                f"{int((now - earliest).total_seconds() // 60)} minutes."
            )
        )

    def _existing_officer(self, badge: str) -> "User":
        officer = User.objects.filter(badge_number__iexact=badge, role="officer").first()
        if officer is None:
            known = ", ".join(
                User.objects.filter(role="officer", is_active=True)
                .order_by("badge_number")
                .values_list("badge_number", flat=True)[:20]
            )
            raise CommandError(f"No officer with badge {badge}. Known badges: {known}")
        return officer

    def _ensure_officer(self, index: int) -> "User":
        username = f"{SIM_USERNAME_PREFIX}{index + 1}"
        officer = User.objects.filter(username=username).first()
        if officer:
            return officer
        return User.objects.create_user(
            username=username,
            password="simulated-officer",
            full_name=SIM_NAMES[index],
            badge_number=f"SIM-{1000 + index + 1}",
            phone="+961 00 000 000",
            role="officer",
        )

    def _stop(self, badges):
        officers = list(User.objects.filter(username__startswith=SIM_USERNAME_PREFIX))
        # Only the badges asked for: ending every officer's shift would put a
        # real officer off duty on the strength of a demo command.
        for badge in badges:
            officers.append(self._existing_officer(badge))

        ended = 0
        for officer in officers:
            if Shift.objects.filter(officer=officer, status=Shift.Status.ACTIVE).exists():
                services.end_shift(officer)
                ended += 1
        self.stdout.write(self.style.SUCCESS(f"Ended {ended} shifts."))


class Walker:
    """A random walk with momentum, so the track looks like patrolling rather
    than teleporting."""

    STEP_M = 40.0

    def __init__(self, user, shift, lat: float, lng: float, heading: float):
        self.user = user
        self.shift = shift
        self.lat = lat
        self.lng = lng
        self.heading = heading
        self.battery = random.randint(60, 100)

    def step(self, now) -> LocationPing:
        self.heading += random.uniform(-0.6, 0.6)
        dlat = (self.STEP_M * math.cos(self.heading)) / 111_320
        dlng = (self.STEP_M * math.sin(self.heading)) / (
            111_320 * math.cos(math.radians(self.lat))
        )
        self.lat += dlat
        self.lng += dlng

        if random.random() < 0.05:
            self.battery = max(1, self.battery - 1)

        return LocationPing(
            client_uuid=uuid.uuid4(),
            shift=self.shift,
            officer=self.user,
            latitude=round(self.lat, 6),
            longitude=round(self.lng, 6),
            accuracy_m=round(random.uniform(4, 25), 1),
            battery_level=self.battery,
            network_type=random.choice(["wifi", "mobile", "mobile"]),
            recorded_at=now,
            is_offline_sync=False,
        )
