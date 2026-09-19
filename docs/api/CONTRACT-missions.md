# API contract - missions

missions/tests.py::ApiPermissionTests, DetailContractTests, TransitionTests

`GET /api/v1/missions/`

All roles. Officers receive only their own missions — the server filters by assigned_to, not the client. Dispatchers and supervisors receive everything.

Query parameters: `status` (new, assigned, acknowledged, in_progress, completed, cancelled), `priority` (low, medium, high, urgent), `officer_id` (dispatcher/supervisor only), `date` (YYYY-MM-DD, missions created on that day, Beirut local time), `open` (pass `true` to exclude completed and cancelled missions).

Events and photos are not included in the list response. Call `GET /api/v1/missions/{id}/` for the full record.

```json
[
  {
    "id": 31,
    "title": "Traffic obstruction on Al-Mina road",
    "priority": "high",
    "status": "in_progress",
    "latitude": "34.436700",
    "longitude": "35.849700",
    "address": "Al-Mina, Tripoli",
    "assigned_to": {
      "id": 4,
      "full_name": "سامر عبد الله",
      "badge_number": "TP-1001"
    },
    "deadline": "2026-09-07T14:00:00Z",
    "created_at": "2026-09-07T09:00:00Z",
    "assigned_at": "2026-09-07T09:01:00Z",
    "is_overdue": false,
    "awaiting_acknowledgement": false
  }
]
```

`assigned_to` is null when the mission is still new and has no officer. `is_overdue` is true when a deadline exists, the mission is still open, and the deadline is in the past — computed on every read, not stored. `awaiting_acknowledgement` is true when the mission is assigned and the unacknowledged sweep has already flagged it. Coordinates are strings — call `parseFloat` before passing them to Leaflet. Timestamps are UTC, convert at render.

`POST /api/v1/missions/`

Dispatcher and Supervisor only. Returns 201 with the full detail object.

Creates a mission and optionally assigns it to an officer in the same step. A dispatcher usually knows who they want, so creating and assigning separately would make the common case two requests. `description`, `address`, `deadline`, and `assigned_to_id` are optional. `priority` defaults to `medium`. Send both latitude and longitude or neither — one alone is 400.

```json
{
  "title": "Traffic obstruction on Al-Mina road",
  "description": "Abandoned vehicle blocking the right lane.",
  "latitude": 34.436700,
  "longitude": 35.849700,
  "address": "Al-Mina, Tripoli",
  "priority": "high",
  "deadline": "2026-09-07T14:00:00Z",
  "assigned_to_id": 4
}
```

`GET /api/v1/missions/{id}/`

All roles. Officers may only open a mission assigned to them — any other id returns 403.

Returns the full detail object: all list-row fields plus description, all lifecycle timestamps, officer positions at start and completion, notes, cancellation reason, the full event timeline, and all photos.

```json
{
  "id": 31,
  "title": "Traffic obstruction on Al-Mina road",
  "priority": "high",
  "status": "completed",
  "latitude": "34.436700",
  "longitude": "35.849700",
  "address": "Al-Mina, Tripoli",
  "assigned_to": { "id": 4, "full_name": "سامر عبد الله", "badge_number": "TP-1001" },
  "created_by": { "id": 2, "full_name": "نور حداد", "badge_number": "DP-0012" },
  "deadline": null,
  "created_at": "2026-09-07T09:00:00Z",
  "assigned_at": "2026-09-07T09:01:00Z",
  "acknowledged_at": "2026-09-07T09:04:00Z",
  "started_at": "2026-09-07T09:20:00Z",
  "completed_at": "2026-09-07T10:05:00Z",
  "cancelled_at": null,
  "started_latitude": "34.437100",
  "started_longitude": "35.850200",
  "completed_latitude": "34.437400",
  "completed_longitude": "35.850500",
  "is_overdue": false,
  "awaiting_acknowledgement": false,
  "ack_alert_sent_at": null,
  "notes": "Vehicle towed, lane reopened.",
  "cancellation_reason": "",
  "description": "Abandoned vehicle blocking the right lane.",
  "events": [
    { "id": 1, "event_type": "created",      "actor": { "id": 2, "full_name": "نور حداد", "badge_number": "DP-0012" }, "created_at": "2026-09-07T09:00:00Z", "metadata": { "title": "Traffic obstruction on Al-Mina road" } },
    { "id": 2, "event_type": "assigned",     "actor": { "id": 2, "full_name": "نور حداد", "badge_number": "DP-0012" }, "created_at": "2026-09-07T09:01:00Z", "metadata": { "officer_id": 4, "badge_number": "TP-1001" } },
    { "id": 3, "event_type": "acknowledged", "actor": { "id": 4, "full_name": "سامر عبد الله", "badge_number": "TP-1001" }, "created_at": "2026-09-07T09:04:00Z", "metadata": {} },
    { "id": 4, "event_type": "started",      "actor": { "id": 4, "full_name": "سامر عبد الله", "badge_number": "TP-1001" }, "created_at": "2026-09-07T09:20:00Z", "metadata": {} },
    { "id": 5, "event_type": "photo_added",  "actor": { "id": 4, "full_name": "سامر عبد الله", "badge_number": "TP-1001" }, "created_at": "2026-09-07T10:03:00Z", "metadata": { "photo_id": 17 } },
    { "id": 6, "event_type": "completed",    "actor": { "id": 4, "full_name": "سامر عبد الله", "badge_number": "TP-1001" }, "created_at": "2026-09-07T10:05:00Z", "metadata": {} }
  ],
  "photos": [
    {
      "id": 17,
      "client_uuid": "8b1f4a2e-...",
      "image": "/media/missions/31/evidence.jpg",
      "captured_latitude": "34.437400",
      "captured_longitude": "35.850500",
      "captured_at": "2026-09-07T10:03:00Z",
      "uploaded_at": "2026-09-07T10:03:05Z"
    }
  ]
}
```

The `events` array is ordered oldest-first and is the source of truth for the dispatcher drawer's lifecycle timeline. `actor` is null on system-raised events such as `ack_alert_sent`. `started_latitude` and `started_longitude` are where the officer was when they tapped Start, not where the mission is. Both can be null if no GPS fix was available. `cancellation_reason` is an empty string when the mission was not cancelled.

`POST /api/v1/missions/{id}/assign/`

Dispatcher and Supervisor only. Assigns a new mission to an officer, or reassigns it before the officer has acknowledged. The same endpoint handles both — the correct path is chosen based on the current status.

```json
{ "officer_id": 4 }
```

Reassignment after acknowledgement is refused with 400. At that point the officer may already be driving to the mission, so the only options are to let them finish or cancel with a reason. Reassignment resets the unacknowledged alert clock so the new officer gets the full timeout.

`POST /api/v1/missions/{id}/acknowledge/`

Officer only. No request body.

The officer confirms they have seen the mission. This is what changes the map marker from green to blue — not assignment. An officer being assigned a mission does not mean they have seen it yet.

`POST /api/v1/missions/{id}/start/`

Officer only. Marks the officer as on scene or on the way. Position is optional but recommended — this is where the trail shows the officer beginning the job.

```json
{ "latitude": 34.437100, "longitude": 35.850200 }
```

Send both coordinates or neither. One alone is 400. Omit the body entirely if no GPS fix is available — the transition still succeeds.

`POST /api/v1/missions/{id}/complete/`

Officer only. Closes the mission. The server does not enforce a photo requirement — that check lives on the Android app, which must refuse to show the Complete button until at least one photo has been uploaded.

```json
{
  "latitude": 34.437400,
  "longitude": 35.850500,
  "notes": "Vehicle towed, lane reopened."
}
```

`notes` is optional. Send both coordinates or neither.

`POST /api/v1/missions/{id}/cancel/`

Dispatcher and Supervisor only. Allowed from: new, assigned, acknowledged, in_progress. A completed mission cannot be cancelled.

`reason` is mandatory. A database constraint enforces it — a blank reason is refused even from a shell or the admin.

```json
{ "reason": "Duplicate of mission #12." }
```

`POST /api/v1/missions/{id}/notes/`

All roles. Officers may only add notes to their own missions.

The note lives on the `note_added` event, not on `mission.notes`, so notes from different people are all kept with who wrote each and when.

```json
{ "text": "Officer on site, situation under control." }
```

`POST /api/v1/missions/{id}/photos/`

Officer only. Multipart form data, not JSON.

Deduped on `client_uuid` the same way location pings are — the phone generates the uuid before the row is written to Room, so a retry over a bad connection is a no-op. Returns 201 on a new photo, 200 when the uuid was already seen. Treat both as success.

Fields: `client_uuid` (UUID generated on the phone), `image` (the photo file), `captured_latitude`, `captured_longitude`, `captured_at` (all optional but send them).

```json
{
  "id": 17,
  "client_uuid": "8b1f4a2e-...",
  "image": "/media/missions/31/evidence.jpg",
  "captured_latitude": "34.437400",
  "captured_longitude": "35.850500",
  "captured_at": "2026-09-07T10:03:00Z",
  "uploaded_at": "2026-09-07T10:03:05Z"
}
```

`captured_at` is when the camera fired. `uploaded_at` is when the server received it. After an offline sync they differ by hours. Use `captured_at` for display. Photos can be uploaded at any point while the mission is open. The maximum of 5 photos is a UI rule enforced by the Android app, not the server.

`POST /api/v1/missions/sweep-unacknowledged/`

Dispatcher and Supervisor only. No request body.

Finds missions that have been assigned but not acknowledged within `mission_ack_timeout_minutes` (from `GET /api/v1/settings/`), flags each one, and returns the newly flagged missions. Safe to call on every dashboard poll — each mission is flagged only once. An empty list means nothing new was flagged this sweep.

The status machine is: new → assigned → acknowledged → in_progress → completed. Any open status can transition to cancelled. An illegal transition returns 400 with a message naming the allowed statuses, never 500. `reassign` is a sideways move within assigned — it moves the mission to a different officer without changing the status.

Event types written by the machine: `created`, `assigned`, `reassigned`, `acknowledged`, `started`, `completed`, `cancelled`, `photo_added`, `note_added`, `ack_alert_sent` (actor is null — raised by the system, not a person).
