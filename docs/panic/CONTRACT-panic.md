##API contract - panic

panic/tests.py::TriggerTests, CancelTests, GraceWindowSettingTests, ResolveTests, ConstraintTests, ActiveFeedTests

`POST /api/v1/panic/`

Officer only. Raises a panic alert. Position is required — an alert the dispatcher cannot place on the map is not actionable. `accuracy_m` and `battery_level` are optional; the phone may not have them, and waiting for a better GPS fix before sending is the wrong trade-off for this button.

```json
{
  "latitude": 34.436700,
  "longitude": 35.849700,
  "accuracy_m": 12.5,
  "battery_level": 38
}
```

Returns 201 on a new alert, 200 when the officer already has an active alert. This endpoint is idempotent — an officer in trouble taps the button more than once, and a phone on a bad connection retries the request. Neither may produce a second alert, because two rows for one person would put two red markers on the dispatcher map. The officer must have an active shift; a request without one returns 400. Returns the full event object.

```json
{
  "id": 7,
  "shift": 3,
  "status": "active",
  "latitude": "34.436700",
  "longitude": "35.849700",
  "accuracy_m": 12.5,
  "battery_level": 38,
  "triggered_at": "2026-09-07T10:15:00Z",
  "cancelled_at": null,
  "resolved_at": null,
  "resolved_by": null,
  "notes": ""
}
```

Coordinates are stored as strings (DecimalField, 9 digits, 6 decimal places) — call `parseFloat` before passing them to Leaflet. `triggered_at` is server time, not phone time. The grace window in cancel is measured from this, so a phone with a wrong clock cannot widen it.

`GET /api/v1/panic/active/`

Dispatcher and Supervisor only. Returns every alert still in `active` status. Cancelled and resolved alerts are kept forever as audit records but must never appear here. Ordered oldest-first — the alert that has been waiting longest appears first.

```json
[
  {
    "id": 7,
    "officer": {
      "id": 4,
      "full_name": "سامر عبد الله",
      "badge_number": "TP-1001"
    },
    "shift": 3,
    "latitude": "34.436700",
    "longitude": "35.849700",
    "accuracy_m": 12.5,
    "battery_level": 38,
    "triggered_at": "2026-09-07T10:15:00Z"
  }
]
```

This is the feed that drives the red pulsing marker on the map (§4.6). The response is deliberately narrow — outcome columns are all null on an active alert and are omitted here. `officer` is expanded with name and badge so the dashboard can render the marker label without a second request.

`POST /api/v1/panic/{id}/cancel/`

Officer only. The officer withdraws their own alert, inside the grace window. No request body.

The grace window is `panic_cancel_grace_seconds` from `GET /api/v1/settings/` (default 10 seconds). Past the window the dispatcher has already seen the alert and may be responding — only a resolve closes it at that point. A request past the window returns 400 with a message naming the window length. An officer attempting to cancel another officer's alert returns 403. Cancelling an already-cancelled or resolved alert returns 400.

Cancelling frees the officer to raise a new alert — the database constraint `unique_active_panic_per_officer` covers only active alerts, so a cancelled one is not a block.

Returns the updated event object.

```json
{
  "id": 7,
  "shift": 3,
  "status": "cancelled",
  "latitude": "34.436700",
  "longitude": "35.849700",
  "accuracy_m": 12.5,
  "battery_level": 38,
  "triggered_at": "2026-09-07T10:15:00Z",
  "cancelled_at": "2026-09-07T10:15:07Z",
  "resolved_at": null,
  "resolved_by": null,
  "notes": ""
}
```

`POST /api/v1/panic/{id}/resolve/`

Dispatcher and Supervisor only. Closes the alert after dealing with it. `notes` is optional.

```json
{ "notes": "Reached the officer by radio; false alarm, no unit sent." }
```

Returns the updated event object.

```json
{
  "id": 7,
  "shift": 3,
  "status": "resolved",
  "latitude": "34.436700",
  "longitude": "35.849700",
  "accuracy_m": 12.5,
  "battery_level": 38,
  "triggered_at": "2026-09-07T10:15:00Z",
  "cancelled_at": null,
  "resolved_at": "2026-09-07T10:22:00Z",
  "resolved_by": {
    "id": 2,
    "full_name": "نور حداد",
    "badge_number": "DP-0012"
  },
  "notes": "Reached the officer by radio; false alarm, no unit sent."
}
```

`select_for_update` is used inside the service so two dispatchers watching the same alert and clicking resolve at the same time do not overwrite each other's name and notes. Resolving an already-cancelled or resolved alert returns 400. An officer attempting to resolve any alert returns 403.

`Status machine`

`active` is the only state a new alert enters. From `active`, the officer may cancel (inside the grace window) and a dispatcher or supervisor may resolve at any time. Cancelled and resolved are terminal — neither can be turned into the other after the fact. A pattern of cancellations is itself something a supervisor needs to see, which is why cancelled alerts are kept and never removed.

The database enforces the outcome columns: a `resolved` row without `resolved_at` and `resolved_by` is refused by a check constraint, and a `cancelled` row without `cancelled_at` is likewise refused. These constraints catch shell and admin edits that bypass the service layer.

`Database table`

The model is stored as `alerts_panicevent`, not `panic_panicevent`. This name is fixed by the DBML contract shared with the Android and web squads and must not be changed. All foreign keys use `PROTECT` — panic records outlive the shifts and accounts they reference and are never deleted or cascaded away.
