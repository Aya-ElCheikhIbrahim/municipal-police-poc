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