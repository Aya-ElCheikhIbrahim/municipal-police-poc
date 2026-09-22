"""
§4.2 — close shifts the officer never ended.

Refresh-token expiry is passive: nothing fires at hour 12, so a phone that
died mid-patrol leaves its shift active forever. ActiveShiftsView sweeps on
every poll, but that only runs while a dispatcher is watching. Run this from
cron so the sweep still happens overnight.
"""

from django.core.management.base import BaseCommand

from shifts import services


class Command(BaseCommand):
    help = "End active shifts whose officer has no live refresh token (§4.2)."

    def handle(self, *args, **options):
        ended = services.end_expired_shifts()
        self.stdout.write(self.style.SUCCESS(f"Ended {len(ended)} expired shifts."))
