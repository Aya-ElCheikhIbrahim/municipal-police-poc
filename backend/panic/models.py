from django.db import models
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator

class PanicEvent(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"
        RESOLVED = "resolved", "Resolved"

    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="panic_events",
    )
    shift = models.ForeignKey(
        "shifts.Shift",
        on_delete=models.PROTECT,
        related_name="panic_events",
    )
    
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = models.FloatField(null=True, blank=True)
    
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    
    triggered_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="panic_events_resolved",
        null=True,
        blank=True,
    )
    
    notes = models.TextField(blank=True)
    battery_level = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Percentage, 0-100. A dying battery explains a trail that stops.",
    )

    class Meta:
        db_table = "alerts_panicevent"
        ordering = ["-triggered_at"]
        indexes = [
            models.Index(fields=["officer", "triggered_at"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["officer"],
                condition=models.Q(status="active"),
                name="unique_active_panic_per_officer",
            ),
            models.CheckConstraint(
                condition=models.Q(models.Q(status="cancelled", _negated=True) | models.Q(cancelled_at__isnull=False)),
                name="cancelled_panic_has_a_cancelled_at",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    models.Q(status="resolved", _negated=True) | 
                    models.Q(resolved_at__isnull=False, resolved_by__isnull=False)
                ),
                name="resolved_panic_has_a_resolver",
            ),
        ]

    def __str__(self):
        return f"Panic by {self.officer.badge_number} at {self.triggered_at}"
