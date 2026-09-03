"""
notifications/services.py

All notification logic. Views stay thin; missions/panic call the notify_*
functions from inside their own transitions, the same way MissionEvent is
written from inside the mission status machine.

section 4.9 triggers covered here:
  - mission assigned            → the assigned officer
  - mission cancelled           → the assigned officer, if there was one
  - mission not acknowledged    → all active dispatchers and supervisors
  - dispatcher message          → a named officer (section 4.9 marks this optional)

Panic alerts are deliberately absent : the panic app has no model yet, and a
notify_panic_triggered() that cannot be called is dead code.
"""
from users.models import Role
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import Notification, NotificationType

User = get_user_model()


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def list_for_user(user, unread_only=False, notification_type=None):
    """
    select_related is not optional here: NotificationSerializer reads
    related_mission.title and .status, so without it the feed costs one extra
    query per row.
    """
    qs = (
        Notification.objects.filter(recipient=user)
        .select_related("related_mission")
    )
    if unread_only:
        qs = qs.filter(is_read=False)
    if notification_type:
        qs = qs.filter(notification_type=notification_type)
    return qs


def get_for_user(user, pk):
    """
    Returns None rather than raising, so the view owns the 404 and this layer
    stays free of DRF imports.

    Scoping by recipient rather than fetching then checking means a
    notification belonging to someone else is indistinguishable from one that
    does not exist : no existence leak.
    """
    return (
        Notification.objects.filter(pk=pk, recipient=user)
        .select_related("related_mission")
        .first()
    )


def unread_count(user):
    return Notification.objects.filter(recipient=user, is_read=False).count()


# ---------------------------------------------------------------------------
# Writes — read state
# ---------------------------------------------------------------------------

def mark_read(notification):
    """
    Idempotent: re-reading an already-read notification must not move
    read_at. Callers must have obtained the object via get_for_user(), which
    is where ownership is enforced.
    """
    if notification.is_read:
        return notification
    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save(update_fields=["is_read", "read_at"])
    return notification


def mark_all_read(user):
    """Returns the number of rows actually changed."""
    return Notification.objects.filter(recipient=user, is_read=False).update(
        is_read=True,
        read_at=timezone.now(),
    )


# ---------------------------------------------------------------------------
# Writes — creation (4.9 triggers)
# ---------------------------------------------------------------------------

def notify_mission_assigned(mission, officer):
    """Call from missions.services on assign and on reassign-before-ack."""
    return Notification.objects.create(
        recipient=officer,
        notification_type=NotificationType.MISSION_ASSIGNED,
        title="New mission assigned",
        body=mission.title,
        related_mission=mission,
    )


def notify_mission_cancelled(mission, officer, reason=""):
    """
    Call from missions.services on cancel. Officer may be None — §4.4 allows
    cancelling a mission that was never assigned, and there is nobody to tell.
    """
    if officer is None:
        return None
    return Notification.objects.create(
        recipient=officer,
        notification_type=NotificationType.MISSION_CANCELLED,
        title="Mission cancelled",
        body=f"{mission.title} — {reason}" if reason else mission.title,
        related_mission=mission,
    )


def notify_dispatcher_message(officer, sender, message, mission=None):
    return Notification.objects.create(
        recipient=officer,
        notification_type=NotificationType.DISPATCHER_MESSAGE,
        title=f"Message from {sender.full_name}",
        body=message,
        related_mission=mission,
    )


@transaction.atomic
def notify_mission_unacknowledged(mission):
    """
    Call from the existing ack-sweep, which already guards on
    ack_alert_sent_at — so this does not re-check it. Setting that field
    remains the sweep's job; doing it here would split one decision across
    two modules.

    bulk_create over a loop: the recipient set is every active dispatcher and
    supervisor, and this fires from a scheduled sweep that may process many
    overdue missions at once. The (role, is_active) index on accounts_user
    covers the filter.
    """
    recipients = User.objects.filter(
        role__in=[Role.DISPATCHER, Role.SUPERVISOR],
        is_active=True,
    )
    return Notification.objects.bulk_create([
        Notification(
            recipient=user,
            notification_type=NotificationType.MISSION_UNACKNOWLEDGED,
            title="Mission not acknowledged",
            body=f"{mission.title} has not been acknowledged.",
            related_mission=mission,
        )
        for user in recipients
    ])