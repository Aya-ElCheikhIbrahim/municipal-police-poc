"""
panic/models.py

§4.7 — the officer's panic button.

One model, `PanicEvent`, and it is an audit record before it is anything else.
SCHEMA.md marks `alerts_panicevent` exempt from the 90-day cleanup that
location pings are subject to: a panic alert is evidence of what happened to a
person on duty, so nothing here is ever deleted or cascaded away.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class PanicEvent(models.Model):
    """
    An officer pressed the panic button.

    `cancelled` and `resolved` are different outcomes and must never be
    collapsed into one "closed" state — SCHEMA.md says so explicitly, and the
    distinction is the whole point of the record:

      cancelled — the officer withdrew it themselves, inside the grace period.
                  Nobody was dispatched. Kept anyway, because a pattern of
                  cancellations is itself something a supervisor needs to see.
      resolved  — a dispatcher or supervisor dealt with it. `resolved_by` says
                  who, `resolved_at` says when, `notes` says what happened.

    Every foreign key is PROTECT. These rows outlive the shift they belong to
    and the accounts of everyone involved; deactivating an officer (§5, and
    the reason there is no delete-user endpoint) must not be able to take an
    alert record with it.
    """

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

    # Where the officer was when they pressed it. Not optional: an alert
    # without a position tells the dispatcher nothing they can act on.
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy_m = models.FloatField(null=True, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    # Server time, not phone time. The grace window in `services.cancel_panic`
    # is measured from this, so a phone with a wrong clock cannot widen it.
    triggered_at = models.DateTimeField(auto_now_add=True)

    cancelled_at = models.DateTimeField(null=True, blank=True)

    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="panic_events_resolved",
    )

    notes = models.TextField(blank=True)

    battery_level = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Percentage, 0-100. A dying battery explains a trail that stops.",
    )

    class Meta:
        # `alerts_panicevent`, not `panic_panicevent`. The name is fixed by the
        # DBML contract already shared with the Android and web squads, and it
        # must not be "corrected" to match the app label — same reason users/
        # overrides to accounts_*. Changing it silently breaks both clients.
        # This comment is load-bearing: a merged PR in this repo has already
        # deleted a settings line that looked redundant on its own.
        db_table = "alerts_panicevent"
        ordering = ["-triggered_at"]
        constraints = [
            # Two live alerts for one person are meaningless to a dispatcher —
            # same reasoning, and the same partial-index shape, as
            # unique_active_shift_per_officer.
            models.UniqueConstraint(
                fields=["officer"],
                condition=models.Q(status="active"),
                name="unique_active_panic_per_officer",
            ),
            # The outcome columns must agree with the status. Enforced in the
            # database rather than only in services.py so a shell or an admin
            # edit cannot leave a "resolved" alert with nobody's name on it.
            models.CheckConstraint(
                condition=~models.Q(status="cancelled")
                | models.Q(cancelled_at__isnull=False),
                name="cancelled_panic_has_a_cancelled_at",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="resolved")
                | models.Q(resolved_at__isnull=False, resolved_by__isnull=False),
                name="resolved_panic_has_a_resolver",
            ),
        ]
        indexes = [
            models.Index(fields=["officer", "triggered_at"]),
            # GET /panic/active/ is polled by every open dashboard.
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"panic {self.get_status_display().lower()} — {self.officer.badge_number}"
