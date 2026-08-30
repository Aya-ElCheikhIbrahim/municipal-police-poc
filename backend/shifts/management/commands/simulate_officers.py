"""
Drive fake officers around Tripoli so the dashboard has moving markers before
Android exists.

§11 requires a dispatcher to see at least three officers moving in real time.
This decouples the web squad from Android's schedule and doubles as the demo
harness on the day.

    python manage.py simulate_officers --officers 3 --minutes 30
    python manage.py simulate_officers --stop
"""

import math
import random
import time
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

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
            "--stop",
            action="store_true",
            help="End all simulated shifts and exit.",
        )

    def handle(self, *args, **options):
        if options["stop"]:
            return self._stop()

        count = min(options["officers"], len(SIM_NAMES))
        interval = options["interval"] or get_setting("location_ping_interval_seconds")
        officers = [self._ensure_officer(i) for i in range(count)]

        walkers = []
        for officer in officers:
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

        self.stdout.write(
            self.style.SUCCESS(
                f"{count} officers on shift, pinging every {interval}s. Ctrl-C to stop."
            )
        )

        deadline = timezone.now() + timedelta(minutes=options["minutes"])
        try:
            while timezone.now() < deadline:
                now = timezone.now()
                LocationPing.objects.bulk_create(
                    [w.step(now) for w in walkers], ignore_conflicts=True
                )
                self.stdout.write(f"  {now:%H:%M:%S}  {len(walkers)} pings")
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("\nInterrupted.")

        self.stdout.write("Done. Shifts left active — run --stop to end them.")

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

    def _stop(self):
        ended = 0
        for officer in User.objects.filter(username__startswith=SIM_USERNAME_PREFIX):
            if Shift.objects.filter(user=officer, status=Shift.Status.ACTIVE).exists():
                services.end_shift(officer)
                ended += 1
        self.stdout.write(self.style.SUCCESS(f"Ended {ended} simulated shifts."))


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
