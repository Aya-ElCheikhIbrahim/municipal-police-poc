"""
Business rules for shifts and location. Views stay thin; this is where the
rules that Android and web both depend on actually live.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import LocationPing, Shift

EARTH_RADIUS_M = 6_371_000

# A phone sitting still still reports jitter. Below this, treat consecutive
# fixes as the same place so a parked officer does not accumulate kilometres.
MIN_SEGMENT_M = 10.0

# Above this, the fix is almost certainly bad. §4.3 records accuracy for
# exactly this reason.
MAX_ACCURACY_M = 100.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres. No PostGIS at POC scale."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def trail_distance_m(pings) -> int:
    """
    Total distance along an ordered ping sequence. Caller must order by
    recorded_at, not received_at, or an offline sync scrambles the path.

    shifts_shift has no distance column, so this runs per request. Fine at
    POC scale — a full shift is roughly a thousand rows.
    """
    total = 0.0
    previous = None
    for ping in pings:
        if ping.accuracy_m is not None and ping.accuracy_m > MAX_ACCURACY_M:
            continue
        if previous is not None:
            segment = haversine_m(
                float(previous.latitude),
                float(previous.longitude),
                float(ping.latitude),
                float(ping.longitude),
            )
            if segment >= MIN_SEGMENT_M:
                total += segment
                previous = ping
        else:
            previous = ping
    return int(total)


def shift_distance_m(shift: Shift) -> int:
    return trail_distance_m(shift.pings.order_by("recorded_at"))


class ShiftError(Exception):
    """Raised for rule violations the API should report as 400."""


@dataclass
class IngestResult:
    accepted: int
    duplicates: int
    rejected: int


def _as_decimal(value):
    return None if value is None else Decimal(str(value))


@transaction.atomic
def start_shift(officer, latitude=None, longitude=None) -> tuple[Shift, bool]:
    """
    §4.2 — begin a duty period.

    Idempotent on purpose: a phone that loses the response and retries must not
    get an error, so an existing active shift is returned rather than refused.
    Returns (shift, created).
    """
    existing = Shift.objects.filter(officer=officer, status=Shift.Status.ACTIVE).first()
    if existing is not None:
        return existing, False

    try:
        shift = Shift.objects.create(
            officer=officer,
            start_latitude=_as_decimal(latitude),
            start_longitude=_as_decimal(longitude),
        )
        return shift, True
    except IntegrityError:
        # Lost a race against the unique partial index; the other request won.
        existing = Shift.objects.filter(officer=officer, status=Shift.Status.ACTIVE).first()
        if existing is None:
            raise
        return existing, False


@transaction.atomic
def end_shift(officer, latitude=None, longitude=None) -> Shift:
    """§4.2 — stop tracking and mark the officer offline."""
    shift = (
        Shift.objects.select_for_update()
        .filter(officer=officer, status=Shift.Status.ACTIVE)
        .first()
    )
    if shift is None:
        raise ShiftError("You do not have an active shift.")

    shift.ended_at = timezone.now()
    shift.status = Shift.Status.ENDED
    shift.end_latitude = _as_decimal(latitude)
    shift.end_longitude = _as_decimal(longitude)
    shift.save(update_fields=["ended_at", "status", "end_latitude", "end_longitude"])
    return shift


def ingest_pings(officer, rows):
    """
    §4.3 — batch ingest.

    No active shift means no location is stored (§4.2, §5). A ping recorded
    before the shift started is dropped, so a stale offline queue from
    yesterday cannot leak into today's trail.
    """
    shift = Shift.objects.filter(officer=officer, status=Shift.Status.ACTIVE).first()
    if shift is None:
        raise ShiftError("No active shift. Start a shift before uploading locations.")

    fresh, rejected = {}, 0
    for row in rows:
        if row["recorded_at"] < shift.started_at:
            rejected += 1
            continue
        fresh[row["client_uuid"]] = row

    already_stored = set(
        LocationPing.objects.filter(client_uuid__in=list(fresh)).values_list(
            "client_uuid", flat=True
        )
    )

    objects = [
        LocationPing(
            client_uuid=client_uuid,
            shift=shift,
            officer=officer,
            latitude=_as_decimal(row["latitude"]),
            longitude=_as_decimal(row["longitude"]),
            accuracy_m=row.get("accuracy_m"),
            battery_level=row.get("battery_level"),
            network_type=row.get("network_type", LocationPing.NetworkType.UNKNOWN),
            recorded_at=row["recorded_at"],
            is_offline_sync=row.get("is_offline_sync", False),
        )
        for client_uuid, row in fresh.items()
        if client_uuid not in already_stored
    ]

    LocationPing.objects.bulk_create(objects, ignore_conflicts=True)

    return IngestResult(
        accepted=len(objects),
        duplicates=len(fresh) - len(objects),
        rejected=rejected,
    )