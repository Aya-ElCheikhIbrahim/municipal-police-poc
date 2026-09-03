"""
notifications/models.py
 
The durable in-app notification feed (§4.9).
 
Scope note: §4.9 names the triggers — mission assigned, mission cancelled,
mission not acknowledged within X minutes, panic alert — but §7's data model
does not define a Notification entity. This table is a design decision
derived from those triggers, not something the requirements document
mandates. See docs/decisions/.
 
Division of labour with `users.DeviceToken`:
  - DeviceToken  = WHERE to push (FCM registration, per device)
  - Notification = WHAT was sent, to WHOM, and whether they have seen it
Push delivery is fire-and-forget; this table is the record that survives it
and backs the dashboard's notification list and unread badge.
"""
 
from django.conf import settings
from django.db import models
 
 
class NotificationType(models.TextChoices):
    MISSION_ASSIGNED = "mission_assigned", "Mission Assigned"
    MISSION_CANCELLED = "mission_cancelled", "Mission Cancelled"
    MISSION_UNACKNOWLEDGED = "mission_unacknowledged", "Mission Not Acknowledged"
    DISPATCHER_MESSAGE = "dispatcher_message", "Dispatcher Message"
    PANIC_ALERT = "panic_alert", "Panic Alert"
 
 
class Notification(models.Model):
    """
    One row per recipient, not one row per event.
 
    §4.7 requires a panic alert to reach *all* dispatchers and supervisors.
    Fanning out to one row each — rather than one row with many readers —
    means each recipient's read state is independent, which is what an
    unread badge actually needs.
    """
 
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
 
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
 
    # Nullable: not every notification concerns a mission. String reference
    # keeps this app free of a hard import on `missions`.
    related_mission = models.ForeignKey(
        "missions.Mission",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
 
    # Uncomment once panic/models.py defines PanicEvent. Verify the app label
    # is `panic` — the table is alerts_panicevent, so it may be overridden
    # the same way accounts_user is.
    # related_panic_event = models.ForeignKey(
    #     "panic.PanicEvent",
    #     null=True,
    #     blank=True,
    #     on_delete=models.CASCADE,
    #     related_name="notifications",
    # )
 
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["recipient", "-created_at"]),
        ]
 
    def __str__(self):
        return f"{self.get_notification_type_display()} → {self.recipient.badge_number}"
 