"""
Business rules for shifts and location. Views stay thin; this is where the
rules that Android and web both depend on actually live.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from core.registry import get_setting
from notifications.services import notify_duty_target_approaching
from missions.models import MissionWork
from .models import DutyTargetReminder, LocationPing, Shift

logger = logging.getLogger(__name__)

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

    A forgotten shift already past max_shift_hours is ended first. Handing it
    back would leave the officer on a shift the next sweep ends under them —
    pings 409, panic 400 — while the app believes the start succeeded.
    """
    end_expired_shifts(officer=officer)

    existing = Shift.objects.filter(officer=officer, status=Shift.Status.ACTIVE).first()
    if existing is not None:
        return existing, False

    try:
        # A savepoint, so losing the race below rolls back only the failed
        # INSERT. Without it the surrounding transaction is aborted and the
        # recovery query raises TransactionManagementError instead of
        # returning the winner's shift — the retry this function promises
        # would never have worked.
        with transaction.atomic():
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
    current_mission_id = (
        MissionWork.objects.filter(officer=officer, ended_at__isnull=True)
        .values_list("mission_id", flat=True)
        .first()
    )
    if current_mission_id is not None:
        raise ShiftError(
            f"Finish mission #{current_mission_id} before ending your shift."
        )
    shift.ended_at = timezone.now()
    shift.status = Shift.Status.ENDED
    shift.end_latitude = _as_decimal(latitude)
    shift.end_longitude = _as_decimal(longitude)
    shift.save(update_fields=["ended_at", "status", "end_latitude", "end_longitude"])
    return shift



def end_expired_shifts(now=None, officer=None) -> list[Shift]:
    """
    Close active shifts that have run longer than max_shift_hours — the
    safety net for a phone that died mid-patrol and never sent End Shift.
    Nothing fires at the limit, so this runs as a sweep. Safe to call
    repeatedly. Pass officer to sweep only that officer's shifts.

    The daily duty target is not enforced here: an officer may work past it,
    in one stint or several. Only a single stint this long is assumed to be
    forgotten.
    """
    now = now or timezone.now()
    limit = timedelta(hours=get_setting("max_shift_hours"))
    overdue = Q(status=Shift.Status.ACTIVE, started_at__lt=now - limit)
    if officer is not None:
        overdue &= Q(officer=officer)
    candidate_ids = list(Shift.objects.filter(overdue).values_list("id", flat=True))

    ended = []
    for shift_id in candidate_ids:
        with transaction.atomic():
            shift = Shift.objects.select_for_update().filter(overdue, pk=shift_id).first()
            if shift is None:  # ended by the officer or another sweep meanwhile
                continue

            # End where the limit fell, not when the sweep noticed, so the
            # report credits max_shift_hours whether the next sweep runs a
            # minute later or the next morning.
            shift.ended_at = shift.started_at + limit
            shift.status = Shift.Status.ENDED
            shift.ended_automatically = True
            shift.save(update_fields=["ended_at", "status", "ended_automatically"])
            ended.append(shift)
    return ended


def local_day_bounds(day) -> tuple[datetime, datetime]:
    """Local midnight to the next local midnight (Asia/Beirut, per TIME_ZONE)."""
    start = timezone.make_aware(datetime.combine(day, time.min))
    return start, start + timedelta(days=1)


def _overlapping(start, end) -> Q:
    """Shifts that overlap [start, end), including one still active."""
    return Q(started_at__lt=end) & (Q(ended_at__isnull=True) | Q(ended_at__gt=start))


def shifts_touching(officer, start, end):
    """Shifts that overlap [start, end), including one still active."""
    return Shift.objects.filter(_overlapping(start, end), officer=officer)


def clipped_duty_seconds(shifts, start, end, now=None) -> int:
    """
    Seconds of duty inside [start, end). Each shift is clipped to the window,
    so one that crosses midnight counts towards each day only the part that
    fell on it. An active shift counts up to now.

    Same clipping as reports.services.generate_daily_officer_report.
    """
    now = now or timezone.now()
    total = timedelta()
    for shift in shifts:
        shift_start = max(shift.started_at, start)
        shift_end = min(shift.ended_at or now, end)
        if shift_end > shift_start:
            total += shift_end - shift_start
    return int(total.total_seconds())


def daily_duty_seconds(officer, date=None, now=None) -> int:
    """
    The officer's duty for one local calendar day, summed across every stint.
    Defaults to today.
    """
    now = now or timezone.now()
    day = date or timezone.localdate(now)
    start, end = local_day_bounds(day)
    return clipped_duty_seconds(shifts_touching(officer, start, end), start, end, now=now)


def daily_duty_seconds_by_officer(officer_ids, date=None, now=None) -> dict[int, int]:
    """
    daily_duty_seconds for many officers in one query, keyed by officer id.
    The live map lists every officer on duty and is polled continuously, so
    calling daily_duty_seconds per row would cost a query per officer.
    """
    now = now or timezone.now()
    day = date or timezone.localdate(now)
    start, end = local_day_bounds(day)

    by_officer = {officer_id: [] for officer_id in officer_ids}
    for shift in Shift.objects.filter(_overlapping(start, end), officer_id__in=list(by_officer)):
        by_officer[shift.officer_id].append(shift)

    return {
        officer_id: clipped_duty_seconds(shifts, start, end, now=now)
        for officer_id, shifts in by_officer.items()
    }


def remind_if_near_duty_target(officer, now=None) -> bool:
    """
    Remind the officer once per local day when today's duty — every stint,
    not just the current one — reaches daily_duty_target_hours minus
    duty_reminder_lead_minutes. Returns whether a reminder was sent.

    There is no scheduler, so this rides on ping ingest (~every 30s per
    officer on shift). The marker lookup comes first: once today's reminder
    is sent, this costs one query on the (officer, date) unique index.
    """
    now = now or timezone.now()
    today = timezone.localdate(now)
    if DutyTargetReminder.objects.filter(officer=officer, date=today).exists():
        return False

    target = get_setting("daily_duty_target_hours") * 3600
    threshold = target - get_setting("duty_reminder_lead_minutes") * 60
    duty = daily_duty_seconds(officer, date=today, now=now)
    if duty < threshold:
        return False

    # Marker and notification commit together: if the notification cannot be
    # written, the marker rolls back too and the next batch tries again.
    with transaction.atomic():
        _, created = DutyTargetReminder.objects.get_or_create(
            officer=officer, date=today, defaults={"sent_at": now}
        )
        if created:  # else a concurrent batch won and sent it
            notify_duty_target_approaching(officer, duty, target)
    return created


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

    # Full recompute, not an incremental add: an offline sync can deliver
    # pings recorded earlier than ones already stored, so adding new segments
    # to a running total would drift. This costs one scan per batch upload
    # (every few minutes per officer) instead of one scan per read of
    # /shifts/active/ (every 5s per officer, times every dispatcher watching).
    shift.distance_m = shift_distance_m(shift)
    shift.save(update_fields=["distance_m"])

    # The pings are already stored; a reminder is never worth losing them.
    try:
        remind_if_near_duty_target(officer)
    except Exception:
        logger.exception("Duty target reminder failed for officer %s", officer.pk)

    return IngestResult(
        accepted=len(objects),
        duplicates=len(fresh) - len(objects),
        rejected=rejected,
    )



def officers_near(latitude, longitude, radius_m, exclude_officer):
    """
    Officers on an active shift whose last known position is within radius_m.
    Returns [(officer, distance_m)], nearest first.

    Last known position is the newest ping, else where the shift was started.
    An officer with neither is skipped: there is no way to tell how far away
    they are, and guessing would send the wrong person.
    """
    shifts = list(
        Shift.objects.filter(status=Shift.Status.ACTIVE, officer__is_active=True)
        .exclude(officer=exclude_officer)
        .select_related("officer")
    )

    latest = {
        ping.shift_id: ping
        for ping in LocationPing.objects
            .filter(shift_id__in=[shift.id for shift in shifts])
            .order_by("shift_id", "-recorded_at")
            .distinct("shift_id")
    }

    nearby = []
    for shift in shifts:
        ping = latest.get(shift.id)
        if ping is not None:
            lat, lon = ping.latitude, ping.longitude
        elif shift.start_latitude is not None:
            lat, lon = shift.start_latitude, shift.start_longitude
        else:
            continue
        distance = haversine_m(float(latitude), float(longitude), float(lat), float(lon))
        if distance <= radius_m:
            nearby.append((shift.officer, distance))

    nearby.sort(key=lambda pair: pair[1])
    return nearby