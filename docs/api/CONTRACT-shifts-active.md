##API contract - location and shifts

shifts/tets.py::ActiveShiftsContractTests

`GET /api/v1/shifts/active/`
Dispatcher and Supervisor only. Poll every 15 seconds. 

[
  {
    "officer": {
      "id": 4,
      "full_name": "سامر عبد الله",
      "badge_number": "TP-1001"
    },
    "status": "available",
    "shift_started_at": "2026-08-29T09:00:00Z",
    "shift_duration_seconds": 8040,
    "distance_covered_m": 4800,
    "latest_ping": {
      "latitude": "34.436700",
      "longitude": "35.849700",
      "accuracy_m": 8.4,
      "battery_level": 72,
      "network_type": "mobile",
      "recorded_at": "2026-08-29T11:14:00Z",
      "received_at": "2026-08-29T11:14:03Z",
      "is_offline_sync": false
    },
    "current_mission": {
      "id": 31,
      "title": "Traffic obstruction on Al-Mina road",
      "priority": "high",
      "status": "in_progress"
    }
  }
]

- last_ping can be null. An officer who has just tapped Start Shift has no GPS fix yet. They must still appear in the list. Do not filter them out, show them as awaiting position.

- status is available or in_mission, driving the marker colour (green or blue). 
An officer counts on a mission once they have acknowledged one, merely being assigned is not enough, because they have not confirmed it yet and showing them as busy would hide a free officer from the deispatcher.

- current_mission  is null when the officer has no acknowledged or in-progress mission, When present it carries id, title, priority, and status. Call GET/missions/{id}/ for full record and its timeline.

- If an officer somehow holds more than one open mission, the most recently assigned one is showed.

- Coordinated are strings, not floats, DRF serialises DecimalField that way. Call parseFloat before handing them to leaflet.

- Timestamps are UTC. Convert at render.

- Officers whose shift has ended are simply absent. Grey "offline" markers come from the daashboard remembering who was there, not from this endpoint.

`POST /api/v1/shifts/start/`

Officer only. Returns 201 on a new shift, 200 if one was already active.

Idempotent by design. A phone that loses the response and retries must not get an error. Android should treat both codes as success.

Optional body: the position where the officer went on duty. Send both coordinates or neither, one alone is 400.

{ "latitude": 34.436700, "longitude": 35.849700 }

{
  "id": 12,
  "status": "active",
  "started_at": "2026-08-29T09:00:00Z",
  "ended_at": null,
  "duration_seconds": 0,
  "start_latitude": "34.436700",
  "start_longitude": "35.849700",
  "end_latitude": null,
  "end_longitude": null
}

`POST /api/v1/shifts/end/`

Officers only. Optional body: latitude and longitude for the end position, plus refresh, the session ends here, and blacklisting the refresh token is the only way to revoke a JWT. A bad or already-blacklisted token does not fail End Shift.

{ "latitude": 34.440000, "longitude": 35.850000, "refresh": "<refresh token>" }

400 if there is no active shift.

`POST /api/v1/location-pingss/bulk/`

Officer only. Maximum 500 pings per request.

{
  "pings": [
    {
      "client_uuid": "8b1f...e2",
      "latitude": 34.436700,
      "longitude": 35.849700,
      "accuracy_m": 8.4,
      "battery_level": 72,
      "network_type": "mobile",
      "recorded_at": "2026-08-29T11:14:00Z",
      "is_offline_sync": true
    }
  ]
}

Response 201:
{ "accepted": 48, "duplicates": 2, "rejected": 0 }

Rules for android team to know:
- client_uuid: is generated on the phone, before the row is written to Room not on upload. It requires 8 hours of offline caching, which guarantees duplicates upload on retry. Re-uploading a batch os a no-op and returns duplicates, not an error.

- recoreded_at: is when the phone captured the fix. The server adds received_at itself. After an offline sync these differ by hours. The trail is always drawm in recorded_at order.

- 409: means no active shift. Not an error to retry, storing location off duty is forbidden, and the server enforces it. Clear the queue or hold it until the next shift, do not loop.

- Pings recorder before the shift  started are counted in rejected and dropped, so a stale queue from yesterday cannot leak into today's trail. 

- is_offline_sync: is set by the phone: true when the row came out of the Room queue rather than uploading live. It defaults to false, so a client  that omits it still works, but tracks poor coverage in Tripoli, and this flag is what makes "how much  of this trail was reconstructed" answerable.

`GET /api/v1/officers/{id}/trails/?date==YYYY-MM-DD`

Dispatcher and Supervisor for any officer for themselves  only, it gives the officers the right to see their own history. Defaults to today. Day boundaries are Beirut local, not UTC.

{
  "officer_id": 4,
  "date": "2026-08-29",
  "point_count": 942,
  "distance_covered_m": 4800,
  "points": [ /* ordered by recorded_at, same fields as latest_ping */ ]
}

`GET /api/v1/settings`

Any signed-in user. PATCH is supervisor only.,

core-systemsetting is a key/value tanlem but the endpoint returns a flat object so Android does not have to walk a list of rows:

{
  "location_ping_interval_seconds": 30,
  "mission_ack_timeout_minutes": 5,
  "location_retention_days": 90
}

PATCH accepts a partial object of the same object shape and returns the full set. An unknown key is 400 rather than a silently ignored row. 

Android reads location_ping_interval_seconds when the shift starts, and should re-read it periodically so a change  from the dashboard takes effect without an app update. Boundars are 10-120, enforced in core/registry.py, the JSON column cannot enforce them itself.

`GET /api/v1/settings/schema/`

returns each key with its description, default, and bounds, so the supervisor settings screen can render inputs without hardcoding the limits. 