from django.conf import settings
from django.db import models


class SystemSetting(models.Model):
    """
    Server-side configuration as key/value rows (`core_systemsetting`).

    The table cannot enforce the bounds §4.3 requires, so validation lives in
    `registry.py` instead. Never read `value` directly — go through
    `registry.get_setting()`, which applies the default and the bounds.
    """

    key = models.CharField(max_length=64, unique=True)
    value = models.JSONField()
    description = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="setting_updates",
    )

    class Meta:
        db_table = "core_systemsetting"
        ordering = ["key"]

    def __str__(self) -> str:
        return f"{self.key} = {self.value}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        from .registry import invalidate_cache

        invalidate_cache()

class Area(models.Model):
    """
    A named part of the city (`core_area`), used to answer "where did this
    happen" on the reports.

    A circle rather than a polygon: the POC needs to group missions and
    positions into recognisable districts, not to draw exact boundaries, and a
    centre with a radius is something a supervisor can adjust in the admin
    without GIS tooling. Overlapping circles are fine - the nearest centre that
    contains the point wins.

    Seeded from the district list the dashboard already uses, with approximate
    centres; tune them in the admin against real mission positions.
    """

    name = models.CharField(max_length=120, unique=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    radius_m = models.PositiveIntegerField(
        default=800,
        help_text="How far from the centre still counts as this area, in metres.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "core_area"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
