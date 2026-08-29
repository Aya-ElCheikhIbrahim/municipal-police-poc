"""
The known system settings, their defaults, and their bounds.

`core_systemsetting` stores arbitrary JSON under a string key, so nothing at
the database level stops a phone being told to ping every 2 seconds. This
module is where the constraints from the requirements actually live. A key not
listed here is rejected.

Adding a setting means adding one entry below — no migration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from django.core.cache import cache

CACHE_KEY = "system_settings"
CACHE_TTL = 60  # A change from the dashboard reaches phones within a minute.


class SettingError(ValueError):
    """Raised for an unknown key or an out-of-range value."""


@dataclass(frozen=True)
class Definition:
    default: Any
    description: str
    coerce: Callable[[Any], Any]
    minimum: Any = None
    maximum: Any = None

    def clean(self, raw: Any) -> Any:
        try:
            value = self.coerce(raw)
        except (TypeError, ValueError):
            raise SettingError(f"Expected {self.coerce.__name__}, got {raw!r}.")
        if self.minimum is not None and value < self.minimum:
            raise SettingError(f"Must be at least {self.minimum}.")
        if self.maximum is not None and value > self.maximum:
            raise SettingError(f"Must be at most {self.maximum}.")
        return value


DEFINITIONS: dict[str, Definition] = {
    # §4.3 — default 30s, configurable server-side between 10s and 120s.
    "location_ping_interval_seconds": Definition(
        default=30,
        description="How often the officer app records a location, in seconds.",
        coerce=int,
        minimum=10,
        maximum=120,
    ),
    # §4.9 — dashboard warns when a mission is not acknowledged in time.
    "mission_ack_timeout_minutes": Definition(
        default=5,
        description="Minutes before an unacknowledged mission is flagged.",
        coerce=int,
        minimum=1,
        maximum=60,
    ),
    # §5 — location data retention: 90 days rolling.
    "location_retention_days": Definition(
        default=90,
        description="Location pings older than this are deleted.",
        coerce=int,
        minimum=1,
        maximum=365,
    ),
}


def invalidate_cache() -> None:
    cache.delete(CACHE_KEY)


def all_settings() -> dict[str, Any]:
    """
    Every known setting, with stored values overriding defaults.

    A missing row is not an error — it means "still the default". Rows are only
    written when a supervisor changes something, so a fresh database and a
    configured one behave identically.
    """
    cached = cache.get(CACHE_KEY)
    if cached is not None:
        return dict(cached)

    from .models import SystemSetting

    stored = dict(SystemSetting.objects.values_list("key", "value"))
    resolved = {}
    for key, definition in DEFINITIONS.items():
        raw = stored.get(key, definition.default)
        try:
            resolved[key] = definition.clean(raw)
        except SettingError:
            # A bad row must not take the officer app down; fall back and
            # let it be visible in the admin.
            resolved[key] = definition.default

    cache.set(CACHE_KEY, resolved, CACHE_TTL)
    return dict(resolved)


def get_setting(key: str) -> Any:
    if key not in DEFINITIONS:
        raise SettingError(f"Unknown setting {key!r}.")
    return all_settings()[key]


def set_settings(values: dict[str, Any], actor=None) -> dict[str, Any]:
    """Validate and persist a partial update. Raises SettingError on any key."""
    from .models import SystemSetting

    unknown = set(values) - set(DEFINITIONS)
    if unknown:
        raise SettingError(f"Unknown setting(s): {', '.join(sorted(unknown))}.")

    cleaned = {key: DEFINITIONS[key].clean(raw) for key, raw in values.items()}

    for key, value in cleaned.items():
        SystemSetting.objects.update_or_create(
            key=key,
            defaults={
                "value": value,
                "description": DEFINITIONS[key].description,
                "updated_by": actor,
            },
        )

    invalidate_cache()
    return all_settings()