# API contract - core

core/tests.py

`GET /api/v1/settings/`

Any signed-in user.

Returns all system settings as a flat object. A missing row in the database is not an error — it means the setting is still at its default. The response is always the full set.

```json
{
  "location_ping_interval_seconds": 30,
  "mission_ack_timeout_minutes": 5,
  "location_retention_days": 90,
  "panic_cancel_grace_seconds": 10,
  "mission_photo_min": 1,
  "mission_photo_max": 5,
  "map_refresh_seconds": 20
}
```

The Android app reads `location_ping_interval_seconds` when the shift starts and should re-read it periodically so a change from the dashboard takes effect without an app update. The web dashboard reads `map_refresh_seconds` on load to set its polling interval, and reads `mission_ack_timeout_minutes` to know how long to wait before alerting on an unacknowledged mission.

Settings are cached server-side for 60 seconds. A change from the dashboard reaches every client within one cache cycle.

`PATCH /api/v1/settings/`

Supervisor only. Partial update — send only the keys you want to change. Returns the full updated settings object.

```json
{ "location_ping_interval_seconds": 60 }
```

```json
{
  "location_ping_interval_seconds": 60,
  "mission_ack_timeout_minutes": 5,
  "location_retention_days": 90,
  "panic_cancel_grace_seconds": 10,
  "mission_photo_min": 1,
  "mission_photo_max": 5,
  "map_refresh_seconds": 20
}
```

An unknown key returns 400. A value outside the bounds for that key returns 400. The bounds are enforced in `core/registry.py`, not the database — the JSON column cannot enforce them itself.

`GET /api/v1/settings/schema/`

Any signed-in user.

Returns the definition for each setting — its description, default, and bounds. The supervisor settings screen uses this to render inputs without hardcoding the limits in the frontend.

```json
[
  {
    "key": "location_ping_interval_seconds",
    "description": "How often the officer app records a location, in seconds.",
    "default": 30,
    "minimum": 10,
    "maximum": 120
  },
  {
    "key": "mission_ack_timeout_minutes",
    "description": "Minutes before an unacknowledged mission is flagged.",
    "default": 5,
    "minimum": 1,
    "maximum": 60
  },
  {
    "key": "location_retention_days",
    "description": "Location pings older than this are deleted.",
    "default": 90,
    "minimum": 1,
    "maximum": 365
  },
  {
    "key": "panic_cancel_grace_seconds",
    "description": "Seconds an officer has to cancel their own panic alert.",
    "default": 10,
    "minimum": 5,
    "maximum": 60
  },
  {
    "key": "mission_photo_min",
    "description": "Photos required before a mission can be completed.",
    "default": 1,
    "minimum": 1,
    "maximum": 5
  },
  {
    "key": "mission_photo_max",
    "description": "Photos allowed on one mission.",
    "default": 5,
    "minimum": 1,
    "maximum": 10
  },
  {
    "key": "map_refresh_seconds",
    "description": "How often the dispatcher dashboard reloads the map, in seconds.",
    "default": 20,
    "minimum": 10,
    "maximum": 60
  }
]
```

`Permission classes`

All role checks are defined in `core/permissions.py` and used across every app. They are enforced server-side — a client that omits a restricted field does not get a silent pass, the endpoint returns 403.

`IsOfficer` — the user must have `role: officer`. Applied to shift start/end, location ping upload, mission acknowledge/start/complete, photo upload, and panic trigger.

`IsDispatcher` — the user must have `role: dispatcher`.

`IsSupervisor` — the user must have `role: supervisor`. Applied to user management writes, settings PATCH, and report export.

`IsDispatcherOrSupervisor` — either role passes. Applied to mission creation, assignment, cancellation, the active shifts map feed, and the unacknowledged sweep.

`IsSupervisorOrReadOnly` — supervisors can write, any authenticated user can read. Used on settings.

An officer cannot change their own role. The self-update serializer does not include the `role` field at all, so sending `{"role": "supervisor"}` is silently ignored rather than rejected — the field simply does not exist for that operation. Clients should not offer the control in the first place.
