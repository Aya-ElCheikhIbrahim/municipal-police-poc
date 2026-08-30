from django.conf import settings
from django.db import models


def mission_photo_path(instance, filename: str) -> str:
    """Photos land under mission id and date, so a folder listing is navigable."""
    return f"missions/{instance.mission_id}/{filename}"


class Mission(models.Model):
    """
    A task a dispatcher sends to an officer.

    The timestamp columns are the source of truth for the lifecycle; `status`
    is a denormalised convenience so the list endpoint does not have to derive
    it. Both are written together in `services.py`, never separately.
    """

    class Status(models.TextChoices):
        NEW = "new", "New"  # created, nobody assigned yet
        ASSIGNED = "assigned", "Assigned"  # sent to an officer, not yet seen
        ACKNOWLEDGED = "acknowledged", "Acknowledged"  # officer confirmed receipt
        IN_PROGRESS = "in_progress", "In progress"  # officer is on it
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)

    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    address = models.CharField(max_length=255, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,  # mission history is retained
        related_name="missions_created",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="missions_assigned",
        null=True,
        blank=True,
    )
    deadline = models.DateTimeField(null=True, blank=True)

    # One timestamp per transition. Null means it has not happened.
    created_at = models.DateTimeField(auto_now_add=True)
    assigned_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    started_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    started_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    completed_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    completed_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    notes = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)

    # Set when the dashboard has warned about a missed acknowledgement, so the
    # sweep does not alert on the same mission every time it runs.
    ack_alert_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "missions_mission"
        ordering = ["-created_at"]
        constraints = [
            # A cancelled mission must say why. Enforced here rather than in a
            # serializer so a shell or admin edit cannot skip it.
            models.CheckConstraint(
                condition=~models.Q(status="cancelled") | ~models.Q(cancellation_reason=""),
                name="cancelled_mission_has_a_reason",
            ),
            # Anything past "new" has an officer on it.
            models.CheckConstraint(
                condition=models.Q(status__in=["new", "cancelled"])
                | models.Q(assigned_to__isnull=False),
                name="active_mission_has_an_assignee",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["assigned_to", "status"]),
            models.Index(fields=["priority", "status"]),
        ]

    def __str__(self) -> str:
        return f"#{self.pk} {self.title}"

    @property
    def is_open(self) -> bool:
        return self.status not in {self.Status.COMPLETED, self.Status.CANCELLED}


class MissionPhoto(models.Model):
    """Evidence attached on completion. Deduped the same way as location pings."""

    # Generated on the phone before the row is written to Room, so a retried
    # upload over a bad connection does not create a second copy.
    client_uuid = models.UUIDField(unique=True)

    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="photos")
    image = models.FileField(upload_to=mission_photo_path)

    # Where and when the camera fired, which is not where the upload came from.
    captured_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    captured_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="mission_photos"
    )

    class Meta:
        db_table = "missions_missionphoto"
        ordering = ["uploaded_at"]
        indexes = [models.Index(fields=["mission", "uploaded_at"])]

    def __str__(self) -> str:
        return f"photo for mission {self.mission_id}"


class MissionEvent(models.Model):
    """
    Append-only audit trail. One row per transition.

    Written from inside the status machine in `services.py`, never by a view,
    so an event cannot be forgotten when a new path through the machine is
    added. This is what the mission drawer's lifecycle timeline reads.
    """

    class EventType(models.TextChoices):
        CREATED = "created", "Created"
        ASSIGNED = "assigned", "Assigned"
        REASSIGNED = "reassigned", "Reassigned"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        PHOTO_ADDED = "photo_added", "Photo added"
        NOTE_ADDED = "note_added", "Note added"
        ACK_ALERT_SENT = "ack_alert_sent", "Acknowledgement alert sent"

    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=16, choices=EventType.choices)

    # Null for events the system raised rather than a person, such as the
    # unacknowledged-mission alert.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mission_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # Whatever the transition needs to be reconstructed later: the previous
    # assignee on a reassign, the reason on a cancel, the note text. Free-form
    # on purpose, so a new event type does not need a migration.
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "missions_missionevent"
        ordering = ["created_at"]
        indexes = [models.Index(fields=["mission", "created_at"])]

    def __str__(self) -> str:
        return f"{self.event_type} on mission {self.mission_id}"
