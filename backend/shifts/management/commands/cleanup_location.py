"""§5 — location data retention: 90 days rolling. Run daily from cron."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.registry import get_setting
from shifts.models import LocationPing


class Command(BaseCommand):
    help = "Delete location pings past the retention window (§5)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be deleted without deleting it.",
        )

    def handle(self, *args, **options):
        days = get_setting("location_retention_days")
        cutoff = timezone.now() - timezone.timedelta(days=days)

        # recorded_at, not received_at: retention is about when the officer was
        # there, not when the phone managed to upload it.
        stale = LocationPing.objects.filter(recorded_at__lt=cutoff)
        count = stale.count()

        if options["dry_run"]:
            self.stdout.write(f"Would delete {count} pings recorded before {cutoff:%Y-%m-%d}.")
            return

        stale.delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {count} pings recorded before {cutoff:%Y-%m-%d}.")
        )

