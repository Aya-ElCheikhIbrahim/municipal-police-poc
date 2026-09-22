"""
What happened, in order: mission transitions, panic alerts and shift changes
merged into one timeline.

Backs two screens. The Time Snapshot asks "what was going on in this area
between 14:00 and 16:00"; the officer report asks "what did this officer do
today". Both are the same question with different filters, so they are one
endpoint.

Nothing here writes. The sources are already append-only: MissionEvent is the
mission status machine's own log, and panic events are audit records that are
never deleted.
"""

from datetime import datetime, time, timedelta

from django.utils import timezone

from core.geo import haversine_m
from core.models import Area
from missions.models import MissionEvent
from panic.models import PanicEvent
from shifts.models import Shift

# A day of a small unit is a few hundred rows; this is a guard against a
# pathological query, not a paging mechanism.
MAX_ROWS = 500


def _brief(user):
    if user is None:
        return None
    return {
        "id": user.id,
        "full_name": user.full_name,
        "badge_number": user.badge_number,
    }


def _row(*, at, activity, activity_label, officer, concerns, area, details,
         mission_id=None, panic_id=None):
    return {
        "at": at,
        "activity": activity,
        "activity_label": activity_label,
        "officer": _brief(officer),
        "area": area.name if area is not None else None,
        "area_id": area.id if area is not None else None,
        "details": details,
        "mission_id": mission_id,
        "panic_id": panic_id,
        # Not serialised: who this row is about, for the officer filter. An
        # assignment is done by a dispatcher but concerns the officer.
        "_concerns": concerns,
    }


def _area_containing(areas, latitude, longitude):
    """The area a loose position falls in; panic alerts and shifts have no FK."""
    if latitude is None or longitude is None:
        return None
    best, best_distance = None, None
    for area in areas:
        distance = haversine_m(
            float(latitude), float(longitude), float(area.latitude), float(area.longitude)
        )
        if distance <= area.radius_m and (best_distance is None or distance < best_distance):
            best, best_distance = area, distance
    return best


def activity_feed(*, date, from_time=None, to_time=None, officer_id=None, area_id=None):
    """
    Every recorded action on `date`, oldest first.

    `from_time` and `to_time` narrow it to part of the day. `officer_id` keeps
    the rows an officer took part in, including the ones done to them, such as
    a mission being assigned. `area_id` keeps the rows that happened in one
    district.
    """
    day_start = timezone.make_aware(datetime.combine(date, from_time or time.min))
    day_end = (
        timezone.make_aware(datetime.combine(date, to_time))
        if to_time
        else timezone.make_aware(datetime.combine(date + timedelta(days=1), time.min))
    )

    areas = list(Area.objects.filter(is_active=True))
    rows = []

    mission_events = (
        MissionEvent.objects.filter(created_at__gte=day_start, created_at__lt=day_end)
        .select_related("actor", "mission", "mission__area")
        .prefetch_related("mission__assigned_to")
    )
    for event in mission_events:
        mission = event.mission
        assignees = list(mission.assigned_to.all())
        concerns = {officer.id for officer in assignees}
        if event.actor_id:
            concerns.add(event.actor_id)

        details = mission.title
        reason = event.metadata.get("reason") or event.metadata.get("text")
        if reason:
            details = f"{mission.title} - {reason}"

        rows.append(_row(
            at=event.created_at,
            activity=f"mission_{event.event_type}",
            activity_label=f"Mission {event.get_event_type_display().lower()}",
            officer=event.actor,
            concerns=concerns,
            area=mission.area,
            details=details,
            mission_id=mission.id,
        ))

    panics = PanicEvent.objects.select_related("officer", "resolved_by")
    for event in panics.filter(triggered_at__gte=day_start, triggered_at__lt=day_end):
        rows.append(_row(
            at=event.triggered_at,
            activity="panic_triggered",
            activity_label="Panic alert raised",
            officer=event.officer,
            concerns={event.officer_id},
            area=_area_containing(areas, event.latitude, event.longitude),
            details=f"{event.latitude}, {event.longitude}",
            panic_id=event.id,
        ))
    for event in panics.filter(resolved_at__gte=day_start, resolved_at__lt=day_end):
        rows.append(_row(
            at=event.resolved_at,
            activity="panic_resolved",
            activity_label="Panic alert resolved",
            officer=event.resolved_by,
            concerns={event.officer_id, event.resolved_by_id},
            area=_area_containing(areas, event.latitude, event.longitude),
            details=event.notes or f"Alert for {event.officer.full_name}",
            panic_id=event.id,
        ))
    for event in panics.filter(cancelled_at__gte=day_start, cancelled_at__lt=day_end):
        rows.append(_row(
            at=event.cancelled_at,
            activity="panic_cancelled",
            activity_label="Panic alert cancelled",
            officer=event.officer,
            concerns={event.officer_id},
            area=_area_containing(areas, event.latitude, event.longitude),
            details="Withdrawn by the officer",
            panic_id=event.id,
        ))

    shifts = Shift.objects.select_related("officer")
    for shift in shifts.filter(started_at__gte=day_start, started_at__lt=day_end):
        rows.append(_row(
            at=shift.started_at,
            activity="shift_started",
            activity_label="Shift started",
            officer=shift.officer,
            concerns={shift.officer_id},
            area=_area_containing(areas, shift.start_latitude, shift.start_longitude),
            details="On duty",
        ))
    for shift in shifts.filter(ended_at__gte=day_start, ended_at__lt=day_end):
        rows.append(_row(
            at=shift.ended_at,
            activity="shift_ended",
            activity_label="Shift ended",
            officer=shift.officer,
            concerns={shift.officer_id},
            area=_area_containing(areas, shift.end_latitude, shift.end_longitude),
            details="Off duty",
        ))

    if officer_id is not None:
        rows = [row for row in rows if officer_id in row["_concerns"]]
    if area_id is not None:
        rows = [row for row in rows if row["area_id"] == area_id]

    rows.sort(key=lambda row: row["at"])
    for row in rows:
        row.pop("_concerns")
    return rows[:MAX_ROWS]
