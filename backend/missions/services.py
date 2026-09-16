"""
The mission status machine.
 
Every transition lives here. Views call these functions and do nothing else,
which is what guarantees a `MissionEvent` is written for each one — an event
cannot be forgotten when a new path through the machine is added later,
because writing the event is part of making the transition.
"""
 
from __future__ import annotations
 
from decimal import Decimal
 
from django.db import IntegrityError, transaction
from django.utils import timezone
 
from core.registry import get_setting
from notifications.services import (
    notify_mission_assigned,
    notify_mission_cancelled,
    notify_mission_unacknowledged,
)
from .models import Mission, MissionEvent, MissionPhoto, MissionWork 
 
class MissionError(Exception):
    """A rule violation the API reports as 400."""
 
 
class MissionPermissionError(Exception):
    """Wrong person for this action; the API reports 403."""
 
 
# Which statuses each transition may be applied to. Keeping this as data
# rather than scattered `if` statements means the legal paths can be read in
# one place, and an illegal one fails the same way everywhere.
ALLOWED_FROM = {
    "assign": {Mission.Status.NEW},
    "reassign": {Mission.Status.ASSIGNED},
    "acknowledge": {Mission.Status.ASSIGNED},
    "start": {
        Mission.Status.ASSIGNED,
        Mission.Status.ACKNOWLEDGED,
        Mission.Status.IN_PROGRESS,
        Mission.Status.PAUSED,
    },
    "complete": {Mission.Status.IN_PROGRESS},
    "cancel": {
        Mission.Status.NEW,
        Mission.Status.ASSIGNED,
        Mission.Status.ACKNOWLEDGED,
        Mission.Status.IN_PROGRESS,
        Mission.Status.PAUSED,
    },
}
 
 
def _as_decimal(value):
    return None if value is None else Decimal(str(value))
 
 
def _require_status(mission: Mission, action: str) -> None:
    allowed = ALLOWED_FROM[action]
    if mission.status not in allowed:
        readable = ", ".join(sorted(allowed))
        raise MissionError(
            f"Cannot {action} a mission that is {mission.get_status_display().lower()}. "
            f"Allowed from: {readable}."
        )
 
 
def _require_assignee(mission: Mission, officer) -> None:
    """An officer acts on their own missions and nobody else's."""
    if not mission.assigned_to.filter(pk=officer.id).exists():
        raise MissionPermissionError("This mission is not assigned to you.")
 
 
def _log(mission: Mission, event_type: str, actor=None, **metadata) -> MissionEvent:
    return MissionEvent.objects.create(
        mission=mission,
        event_type=event_type,
        actor=actor,
        metadata=metadata,
    )
 
 
def _close_running_period(mission: Mission, now) -> None:
    """Fold the running work period into worked_seconds. The caller saves."""
    if mission.resumed_at is not None:
        mission.worked_seconds += max(0, int((now - mission.resumed_at).total_seconds()))
        mission.resumed_at = None


def _interrupt(work: MissionWork, now, *, officer, by_mission: Mission) -> None:
    """
    End an officer's work on their current mission because an urgent mission
    takes over. The mission pauses only if nobody else is still working it.
    """
    work.ended_at = now
    work.save(update_fields=["ended_at"])

    current = Mission.objects.select_for_update().get(pk=work.mission_id)
    someone_still_working = MissionWork.objects.filter(
        mission=current, ended_at__isnull=True
    ).exists()
    if someone_still_working or current.status != Mission.Status.IN_PROGRESS:
        return

    _close_running_period(current, now)
    current.status = Mission.Status.PAUSED
    current.save(update_fields=["status", "worked_seconds", "resumed_at"])
    _log(
        current,
        MissionEvent.EventType.PAUSED,
        actor=officer,
        interrupted_by_mission_id=by_mission.id,
    )


def _close_running_period(mission: Mission, now) -> None:
    """Fold the running work period into worked_seconds. The caller saves."""
    if mission.resumed_at is not None:
        mission.worked_seconds += max(0, int((now - mission.resumed_at).total_seconds()))
        mission.resumed_at = None


def _interrupt(work: MissionWork, now, *, officer, by_mission: Mission) -> None:
    """
    End an officer's work on their current mission because an urgent mission
    takes over. The mission pauses only if nobody else is still working it.
    """
    work.ended_at = now
    work.save(update_fields=["ended_at"])

    current = Mission.objects.select_for_update().get(pk=work.mission_id)
    someone_still_working = MissionWork.objects.filter(
        mission=current, ended_at__isnull=True
    ).exists()
    if someone_still_working or current.status != Mission.Status.IN_PROGRESS:
        return

    _close_running_period(current, now)
    current.status = Mission.Status.PAUSED
    current.save(update_fields=["status", "worked_seconds", "resumed_at"])
    _log(
        current,
        MissionEvent.EventType.PAUSED,
        actor=officer,
        interrupted_by_mission_id=by_mission.id,
    )


@transaction.atomic
def create_mission(
    *,
    created_by,
    title: str,
    latitude,
    longitude,
    description: str = "",
    address: str = "",
    priority: str = Mission.Priority.MEDIUM,
    category: str = Mission.Category.MUNICIPAL,
    deadline=None,
    officers=(),
) -> Mission:
    """
    Create a mission, optionally assigning it in the same step.
 
    A dispatcher usually knows who they want, so creating and assigning
    separately would make the common case two requests and leave a window
    where the mission exists with nobody on it.
    """
    mission = Mission.objects.create(
        title=title,
        description=description,
        priority=priority,
        category=category,
        latitude=_as_decimal(latitude),
        longitude=_as_decimal(longitude),
        address=address,
        deadline=deadline,
        created_by=created_by,
    )
    _log(mission, MissionEvent.EventType.CREATED, actor=created_by, title=title)
 
    if officers:
        assign_mission(mission, officers=officers, actor=created_by)
        mission.refresh_from_db()

    return mission
 
 
@transaction.atomic
def assign_mission(mission: Mission, *, officers, actor) -> Mission:
    """Send a new mission to one or more officers."""
    _require_status(mission, "assign")
    if not officers:
        raise MissionError("Choose at least one officer.")
    for officer in officers:
        _require_officer_role(officer)

    mission.assigned_to.set(officers)
    mission.assigned_at = timezone.now()
    mission.status = Mission.Status.ASSIGNED
    mission.save(update_fields=["assigned_at", "status"])

    _log(
        mission,
        MissionEvent.EventType.ASSIGNED,
        actor=actor,
        officer_ids=[o.id for o in officers],
        badge_numbers=[o.badge_number for o in officers],
    )
    for officer in officers:
        notify_mission_assigned(mission, officer)
    return mission
 
 
@transaction.atomic
def reassign_mission(mission: Mission, *, officers, actor) -> Mission:
    """
    Move a mission to a different officer.
 
    Only before acknowledgement. Once an officer has confirmed receipt they may
    already be driving to it, so the honest options are to let them finish or
    cancel with a reason — silently moving it under them loses that fact.
 
    If the requirements turn out to allow reassignment after acknowledgement,
    widen ALLOWED_FROM["reassign"]; nothing else changes, and the `reassigned`
    event already records the previous officer either way.
    """
    _require_status(mission, "reassign")
    if not officers:
        raise MissionError("Choose at least one officer.")
    for officer in officers:
        _require_officer_role(officer)

    previous = list(mission.assigned_to.all())
    previous_ids = {o.id for o in previous}
    if previous_ids == {o.id for o in officers}:
        raise MissionError("Those officers are already assigned to this mission.")

    mission.assigned_to.set(officers)
    mission.assigned_at = timezone.now()
    mission.ack_alert_sent_at = None  # the new officers get a fresh clock
    mission.save(update_fields=["assigned_at", "ack_alert_sent_at"])

    _log(
        mission,
        MissionEvent.EventType.REASSIGNED,
        actor=actor,
        officer_ids=[o.id for o in officers],
        badge_numbers=[o.badge_number for o in officers],
        previous_officer_ids=[o.id for o in previous],
        previous_badge_numbers=[o.badge_number for o in previous],
    )
    for officer in officers:
        if officer.id not in previous_ids:  # officers already on it were told before
            notify_mission_assigned(mission, officer)
    return mission
 
 
@transaction.atomic
def acknowledge_mission(mission: Mission, *, officer) -> Mission:
    """The officer confirms they have seen it. Stops the section 4.9 alert clock."""
    _require_status(mission, "acknowledge")
    _require_assignee(mission, officer)
 
    mission.acknowledged_at = timezone.now()
    mission.status = Mission.Status.ACKNOWLEDGED
    mission.save(update_fields=["acknowledged_at", "status"])
 
    _log(mission, MissionEvent.EventType.ACKNOWLEDGED, actor=officer)
    return mission
 
 
@transaction.atomic
def start_mission(mission: Mission, *, officer, latitude=None, longitude=None) -> Mission:
    """
    The officer starts working on a mission: the first start, resuming a paused
    mission, or joining a shared mission another officer already started.

    One mission at a time. If the officer is already working on another
    mission, only an URGENT mission may interrupt it; the interrupted mission
    pauses unless another assigned officer is still working it.
    """
    Mission.objects.select_for_update().filter(pk=mission.pk).first()
    mission.refresh_from_db()
    _require_status(mission, "start")
    _require_assignee(mission, officer)

    now = timezone.now()
    current = (
        MissionWork.objects.select_for_update()
        .filter(officer=officer, ended_at__isnull=True)
        .first()
    )
    if current is not None:
        if current.mission_id == mission.id:
            raise MissionError("You are already working on this mission.")
        if mission.priority != Mission.Priority.URGENT:
            raise MissionError(
                f"You are already working on mission #{current.mission_id}. "
                "Complete it first; only urgent missions can interrupt it."
            )
        _interrupt(current, now, officer=officer, by_mission=mission)

    first_start = mission.started_at is None
    was_paused = mission.status == Mission.Status.PAUSED

    if first_start:
        mission.started_at = now
        mission.started_latitude = _as_decimal(latitude)
        mission.started_longitude = _as_decimal(longitude)
    if mission.resumed_at is None:
        mission.resumed_at = now
    mission.status = Mission.Status.IN_PROGRESS
    mission.save(
        update_fields=[
            "started_at",
            "started_latitude",
            "started_longitude",
            "resumed_at",
            "status",
        ]
    )

    try:
        # Savepoint: two taps racing past the check above hit the database's
        # one-open-period rule instead of creating a second running mission.
        with transaction.atomic():
            MissionWork.objects.create(mission=mission, officer=officer, started_at=now)
    except IntegrityError:
        raise MissionError("You are already working on another mission.")

    if first_start:
        _log(mission, MissionEvent.EventType.STARTED, actor=officer)
    elif was_paused:
        _log(mission, MissionEvent.EventType.RESUMED, actor=officer)
    else:
        _log(mission, MissionEvent.EventType.STARTED, actor=officer, joined=True)
    return mission
 
 
@transaction.atomic
def complete_mission(
    mission: Mission, *, officer, latitude=None, longitude=None, notes: str = ""
) -> Mission:
    """Officer finished. Position recorded so the report can show where."""
    _require_status(mission, "complete")
    _require_assignee(mission, officer)

    minimum = get_setting("mission_photo_min")
    if mission.photos.count() < minimum:
        raise MissionError(
            f"At least {minimum} photo(s) required before completing a mission."
        )
 
    now = timezone.now()
    mission.completed_at = now
    mission.completed_latitude = _as_decimal(latitude)
    mission.completed_longitude = _as_decimal(longitude)
    mission.status = Mission.Status.COMPLETED
    if notes:
        mission.notes = notes
    _close_running_period(mission, now)
    mission.save(
        update_fields=[
            "completed_at",
            "completed_latitude",
            "completed_longitude",
            "status",
            "notes",
            "worked_seconds",
            "resumed_at",
        ]
    )
    # Everyone working on it is free again.
    MissionWork.objects.filter(mission=mission, ended_at__isnull=True).update(ended_at=now)
 
    _log(mission, MissionEvent.EventType.COMPLETED, actor=officer)
    return mission
 
 
@transaction.atomic
def cancel_mission(mission: Mission, *, actor, reason: str) -> Mission:
    """
    Cancel an open mission. The reason is mandatory — a database constraint
    enforces it too, so this cannot be bypassed from a shell or the admin.
    """
    _require_status(mission, "cancel")
 
    reason = (reason or "").strip()
    if not reason:
        raise MissionError("A cancellation reason is required.")
 
    now = timezone.now()
    mission.cancelled_at = now
    mission.cancellation_reason = reason
    mission.status = Mission.Status.CANCELLED
    _close_running_period(mission, now)
    mission.save(
        update_fields=[
            "cancelled_at",
            "cancellation_reason",
            "status",
            "worked_seconds",
            "resumed_at",
        ]
    )
    # Everyone working on it is free again.
    MissionWork.objects.filter(mission=mission, ended_at__isnull=True).update(ended_at=now)
 
    _log(mission, MissionEvent.EventType.CANCELLED, actor=actor, reason=reason)
    for officer in mission.assigned_to.all():
        notify_mission_cancelled(mission, officer, reason=reason)
    return mission
 
 
@transaction.atomic
def add_photo(
    mission: Mission,
    *,
    officer,
    client_uuid,
    image,
    captured_latitude=None,
    captured_longitude=None,
    captured_at=None,
) -> tuple[MissionPhoto, bool]:
    """
    Attach a photo. Returns (photo, created).
 
    Deduped on `client_uuid` exactly like location pings: the phone generates
    it before the row reaches its upload queue, so a retry over a bad
    connection is a no-op rather than a second copy. Returning created=False
    lets the app clear its queue without treating a retry as an error.
    """
    _require_assignee(mission, officer)
    if not mission.is_open:
        raise MissionError("This mission is closed.")
 
    existing = MissionPhoto.objects.filter(client_uuid=client_uuid).first()
    if existing is not None:
        return existing, False

    maximum = get_setting("mission_photo_max")
    if mission.photos.count() >= maximum:
        raise MissionError(f"A mission may have at most {maximum} photos.")
 
    photo = MissionPhoto.objects.create(
        client_uuid=client_uuid,
        mission=mission,
        image=image,
        captured_latitude=_as_decimal(captured_latitude),
        captured_longitude=_as_decimal(captured_longitude),
        captured_at=captured_at,
        uploaded_by=officer,
    )
    _log(mission, MissionEvent.EventType.PHOTO_ADDED, actor=officer, photo_id=photo.id)
    return photo, True
 
 
@transaction.atomic
def add_note(mission: Mission, *, actor, text: str) -> MissionEvent:
    """
    Append a note to the timeline.
 
    The note lives on the event, not on `mission.notes`, so several notes from
    different people are all kept with who wrote each and when.
    """
    text = (text or "").strip()
    if not text:
        raise MissionError("A note cannot be empty.")
    return _log(mission, MissionEvent.EventType.NOTE_ADDED, actor=actor, text=text)
 
 
def flag_unacknowledged(now=None) -> list[Mission]:
    """
    section 4.9 — find missions an officer has not acknowledged in time.
 
    Marks each one so the dashboard alerts once rather than on every poll.
    Returns the missions newly flagged. Run from the polling endpoint or a
    scheduled command; it is safe to call repeatedly.
    """
    now = now or timezone.now()
    timeout = get_setting("mission_ack_timeout_minutes")
    cutoff = now - timezone.timedelta(minutes=timeout)
 
    stale = Mission.objects.filter(
        status=Mission.Status.ASSIGNED,
        assigned_at__lt=cutoff,
        ack_alert_sent_at__isnull=True,
    )
 
    flagged = []
    for mission in stale:
        with transaction.atomic():
            mission.ack_alert_sent_at = now
            mission.save(update_fields=["ack_alert_sent_at"])
            _log(
                mission,
                MissionEvent.EventType.ACK_ALERT_SENT,
                actor=None,  # the system raised this, not a person
                timeout_minutes=timeout,
            )
            notify_mission_unacknowledged(mission)
        flagged.append(mission)
    return flagged
 
 
def _require_officer_role(user) -> None:
    if getattr(user, "role", None) != "officer":
        raise MissionError("Missions can only be assigned to officers.")
 