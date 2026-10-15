"""
§4.2 — close shifts the officer never ended.

A phone that died mid-patrol never sends End Shift, so its shift would stay
active forever. Any single shift older than max_shift_hours is ended at
started_at + max_shift_hours. ActiveShiftsView and /shifts/today/ sweep on
every request, but those only run while someone is watching. Run this from
cron so the sweep still happens overnight.
"""

from django.core.management.base import BaseCommand

from shifts import services


class Command(BaseCommand):
    help = "End active shifts that have run longer than max_shift_hours (§4.2)."

    def handle(self, *args, **options):
        ended = services.end_expired_shifts()
        self.stdout.write(self.style.SUCCESS(f"Ended {len(ended)} expired shifts."))
