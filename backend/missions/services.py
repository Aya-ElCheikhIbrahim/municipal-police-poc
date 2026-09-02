"""
The mission status machine.
 
Every transition lives here. Views call these functions and do nothing else,
which is what guarantees a `MissionEvent` is written for each one — an event
cannot be forgotten when a new path through the machine is added later,
because writing the event is part of making the transition.
"""
 
from __future__ import annotations
 
from decimal import Decimal
 
from django.db import transaction
from django.utils import timezone
 
from core.registry import get_setting
 
from .models import Mission, MissionEvent, MissionPhoto
 
 
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
    "start": {Mission.Status.ACKNOWLEDGED},
    "complete": {Mission.Status.IN_PROGRESS},
    "cancel": {
        Mission.Status.NEW,
        Mission.Status.ASSIGNED,
        Mission.Status.ACKNOWLEDGED,
        Mission.Status.IN_PROGRESS,
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
    if mission.assigned_to_id != officer.id:
        raise MissionPermissionError("This mission is not assigned to you.")
 
 
def _log(mission: Mission, event_type: str, actor=None, **metadata) -> MissionEvent:
    return MissionEvent.objects.create(
        mission=mission,
        event_type=event_type,
        actor=actor,
        metadata=metadata,
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
    deadline=None,
    assigned_to=None,
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
        latitude=_as_decimal(latitude),
        longitude=_as_decimal(longitude),
        address=address,
        deadline=deadline,
        created_by=created_by,
    )
    _log(mission, MissionEvent.EventType.CREATED, actor=created_by, title=title)
 
    if assigned_to is not None:
        assign_mission(mission, officer=assigned_to, actor=created_by)
        mission.refresh_from_db()
 
    return mission
 
 
@transaction.atomic
def assign_mission(mission: Mission, *, officer, actor) -> Mission:
    """Send a new mission to an officer."""
    _require_status(mission, "assign")
    _require_officer_role(officer)
 
    mission.assigned_to = officer
    mission.assigned_at = timezone.now()
    mission.status = Mission.Status.ASSIGNED
    mission.save(update_fields=["assigned_to", "assigned_at", "status"])
 
    _log(
        mission,
        MissionEvent.EventType.ASSIGNED,
        actor=actor,
        officer_id=officer.id,
        badge_number=officer.badge_number,
    )
    return mission
 
 
@transaction.atomic
def reassign_mission(mission: Mission, *, officer, actor) -> Mission:
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
    _require_officer_role(officer)
 
    if mission.assigned_to_id == officer.id:
        raise MissionError("That officer is already assigned to this mission.")
 
    previous = mission.assigned_to
    mission.assigned_to = officer
    mission.assigned_at = timezone.now()
    mission.ack_alert_sent_at = None  # the new officer gets a fresh clock
    mission.save(update_fields=["assigned_to", "assigned_at", "ack_alert_sent_at"])
 
    _log(
        mission,
        MissionEvent.EventType.REASSIGNED,
        actor=actor,
        officer_id=officer.id,
        badge_number=officer.badge_number,
        previous_officer_id=previous.id if previous else None,
        previous_badge_number=previous.badge_number if previous else None,
    )
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
    """Officer is on scene or on the way. Records where they actually were."""
    _require_status(mission, "start")
    _require_assignee(mission, officer)
 
    mission.started_at = timezone.now()
    mission.started_latitude = _as_decimal(latitude)
    mission.started_longitude = _as_decimal(longitude)
    mission.status = Mission.Status.IN_PROGRESS
    mission.save(
        update_fields=["started_at", "started_latitude", "started_longitude", "status"]
    )
 
    _log(mission, MissionEvent.EventType.STARTED, actor=officer)
    return mission
 
 
@transaction.atomic
def complete_mission(
    mission: Mission, *, officer, latitude=None, longitude=None, notes: str = ""
) -> Mission:
    """Officer finished. Position recorded so the report can show where."""
    _require_status(mission, "complete")
    _require_assignee(mission, officer)
 
    mission.completed_at = timezone.now()
    mission.completed_latitude = _as_decimal(latitude)
    mission.completed_longitude = _as_decimal(longitude)
    mission.status = Mission.Status.COMPLETED
    if notes:
        mission.notes = notes
    mission.save(
        update_fields=[
            "completed_at",
            "completed_latitude",
            "completed_longitude",
            "status",
            "notes",
        ]
    )
 
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
 
    mission.cancelled_at = timezone.now()
    mission.cancellation_reason = reason
    mission.status = Mission.Status.CANCELLED
    mission.save(update_fields=["cancelled_at", "cancellation_reason", "status"])
 
    _log(mission, MissionEvent.EventType.CANCELLED, actor=actor, reason=reason)
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
        flagged.append(mission)
    return flagged
 
 
def _require_officer_role(user) -> None:
    if getattr(user, "role", None) != "officer":
        raise MissionError("Missions can only be assigned to officers.")
 