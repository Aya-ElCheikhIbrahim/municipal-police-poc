from django.conf import settings
from django.db import models
from django.utils import timezone

class Shift(models.Model):

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ENDED = "ended", "Ended"

    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,  
        related_name="shifts",
    )
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.ACTIVE)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    
    start_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    start_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    end_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    end_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    distance_m = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "shifts_shift"
        ordering = ["-started_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["officer"],
                condition=models.Q(status="active"),
                name="unique_active_shift_per_officer",
            ),
            models.CheckConstraint(
                condition=models.Q(ended_at__isnull=True)
                | models.Q(ended_at__gte=models.F("started_at")),
                name="shift_ends_after_it_starts",
            ),
        ]
        indexes = [models.Index(fields=["status", "started_at"])]

    def __str__(self) -> str:
        return f"{self.officer.badge_number} — {self.started_at:%Y-%m-%d %H:%M}"

    @property
    def duration_seconds(self) -> int:
        return int(((self.ended_at or timezone.now()) - self.started_at).total_seconds())


class LocationPing(models.Model):
    

    class NetworkType(models.TextChoices):
        WIFI = "wifi", "Wi-Fi"
        MOBILE = "mobile", "Mobile data"
        NONE = "none", "No connection"
        UNKNOWN = "unknown", "Unknown"

    
    client_uuid = models.UUIDField(unique=True)

    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name="pings")
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="location_pings"
    )

    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = models.FloatField(null=True, blank=True)

    
    recorded_at = models.DateTimeField(help_text="When the phone captured it.")
    received_at = models.DateTimeField(auto_now_add=True, help_text="When the server stored it.")

    battery_level = models.PositiveSmallIntegerField(null=True, blank=True)
    network_type = models.CharField(
        max_length=8, choices=NetworkType.choices, default=NetworkType.UNKNOWN
    )

    
    is_offline_sync = models.BooleanField(default=False)

    class Meta:
        db_table = "shifts_locationping"
        ordering = ["recorded_at"]
        indexes = [
            models.Index(fields=["shift", "recorded_at"]),
            models.Index(fields=["officer", "recorded_at"]),
            models.Index(fields=["recorded_at"]),  # used by cleanup_locations
        ]

    def __str__(self) -> str:
        return f"{self.latitude},{self.longitude} @ {self.recorded_at:%H:%M:%S}"
