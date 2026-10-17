# API contract - shifts

shifts/tests.py::HaversineTests, ShiftLifecycleTests, LocationIngestTests, PermissionTests, ActiveShiftsContractTests, ActiveShiftsMissionTests, DistanceCachingTests, ActiveShiftsQueryCountTests, TrailDayBoundaryTests, StartShiftRaceRecoveryTests, ActiveShiftsPanicTests, DailyDutySecondsTests, TodayDutyEndpointTests, EndExpiredShiftsTests, SimulateOfficersTests, DutyTargetReminderTests, StartShiftAfterForgottenShiftTests, ActiveShiftsDutyTotalsTests

`POST /api/v1/shifts/start/`

Officer only. Begins a duty period. The officer's position is optional — no GPS fix yet must not block going on duty.

```json
{ "latitude": 34.436700, "longitude": 35.849700 }
```

Omit the body entirely, or send `{}`, when no fix is available. Send both coordinates or neither — one alone is 400.

Returns 201 on a new shift, 200 when the officer already has an active shift. This endpoint is idempotent — a phone that loses the response and retries must not get an error. The existing active shift is returned unchanged. A partial unique index enforces one active shift per officer at the database level, so a race between two simultaneous requests is also safe: the losing INSERT is rolled back to a savepoint and the winner's shift is returned.

```json
{
  "id": 3,
  "status": "active",
  "started_at": "2026-09-07T07:00:00Z",
  "ended_at": null,
  "duration_seconds": 1800,
  "start_latitude": "34.436700",
  "start_longitude": "35.849700",
  "end_latitude": null,
  "end_longitude": null
}
```

Coordinates are strings (DecimalField, 9 digits, 6 decimal places) — call `parseFloat` before passing them to Leaflet. On input — here and on the ping batch — more than 6 decimals is rounded half-up to 6 rather than rejected, so a raw 7-decimal GPS fix is a valid body. `duration_seconds` is computed on every read from `started_at` to now, or to `ended_at` once the shift has ended.

`POST /api/v1/shifts/end/`

Officer only. Stops tracking and marks the officer offline. Position is optional.

```json
{ "latitude": 34.446700, "longitude": 35.849700 }
```

Returns 200 with the ended shift. No active shift returns 400. An officer who is actively on a mission (an open mission work period) also returns 400 (`Finish mission #{id} before ending your shift.`) and must complete the mission, or have it cancelled, first. A mission that is only assigned (not started), or one that is paused, does not block ending the shift. Ending a shift does not revoke the JWT; the client must also call `POST /api/v1/logout/` with the refresh token. The two are separate because a failed blacklist would otherwise leave a phone believing its session was revoked when it was not.

```json
{
  "id": 3,
  "status": "ended",
  "started_at": "2026-09-07T07:00:00Z",
  "ended_at": "2026-09-07T15:30:00Z",
  "duration_seconds": 30600,
  "start_latitude": "34.436700",
  "start_longitude": "35.849700",
  "end_latitude": "34.446700",
  "end_longitude": "35.849700"
}
```

`POST /api/v1/location-pings/bulk/`

Officer only. Batch ingest of location pings. One request per ping drains the battery — the batch is the required shape. Maximum 500 pings per request; an 8-hour offline queue arrives in several requests, not one.

```json
{
  "pings": [
    {
      "client_uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "latitude": 34.436700,
      "longitude": 35.849700,
      "accuracy_m": 12.5,
      "recorded_at": "2026-09-07T07:30:00Z",
      "battery_level": 72,
      "network_type": "mobile",
      "is_offline_sync": false
    }
  ]
}
```

`accuracy_m`, `battery_level`, `network_type`, and `is_offline_sync` are optional. `network_type` is one of `wifi`, `mobile`, `none`, `unknown`; defaults to `unknown`. `is_offline_sync` marks pings that were stored on the device and sent later — after an offline sync, `recorded_at` and `received_at` differ by hours; `recorded_at` is always the one used for display and ordering.

The phone generates `client_uuid` before writing the row to Room. This makes retries idempotent — the same UUID arriving twice is a no-op, not a second row. Dedup is applied both within the batch (a UUID appearing twice in one request is stored once) and against the database (a UUID already stored is silently skipped).

Pings with `recorded_at` before the shift's `started_at` are dropped — a stale offline queue from a previous shift must not leak into the current one.

No active shift returns 409.

```json
{
  "accepted": 47,
  "duplicates": 3,
  "rejected": 1
}
```

`accepted` is the number of new rows written. `duplicates` is the number skipped because the UUID was already stored. `rejected` is the number dropped because `recorded_at` predates the shift. The phone clears only the rows whose UUIDs appear in the batch once it receives any 2xx — it does not inspect the counts.

After every ingest, `shift.distance_m` is recomputed in full from the complete ping sequence ordered by `recorded_at`. Incremental addition is not used because an offline sync can deliver pings recorded earlier than ones already stored, which would leave earlier segments uncounted. The full recompute runs once per batch upload (every few minutes per officer) rather than on every read of `/shifts/active/` (every map refresh, across all dispatchers), so the cost is acceptable.

Distance computation excludes pings with `accuracy_m` greater than 100m (bad fix). Consecutive pings less than 10m apart are treated as the same place (GPS jitter on a parked officer) and do not accumulate distance.

`GET /api/v1/shifts/active/`

Dispatcher and Supervisor only. Returns every officer currently on duty, with their latest position and current mission. This is the data source for the live map (§4.6).

> ⚠ As of 2026-10-13 the web dashboard polls this endpoint every **5s** (`web/src/features/officers/useOfficers.ts`) and does not read `map_refresh_seconds`. The `map_refresh_seconds` setting (default 20) and the "15–30 seconds" figure are not what the client currently uses. See docs/PROGRESS.md.

```json
[
  {
    "officer": {
      "id": 4,
      "full_name": "سامر عبد الله",
      "badge_number": "TP-1001"
    },
    "status": "in_mission",
    "shift_started_at": "2026-09-07T07:00:00Z",
    "shift_duration_seconds": 5400,
    "duty_seconds_today": 12600,
    "target_seconds": 28800,
    "distance_covered_m": 3200,
    "latest_ping": {
      "latitude": "34.436700",
      "longitude": "35.849700",
      "accuracy_m": 12.5,
      "battery_level": 72,
      "network_type": "mobile",
      "recorded_at": "2026-09-07T08:30:00Z",
      "received_at": "2026-09-07T08:30:05Z",
      "is_offline_sync": false
    },
    "position_source": "ping",
    "current_mission": {
      "id": 31,
      "title": "Traffic obstruction on Al-Mina road",
      "priority": "high",
      "status": "in_progress"
    }
  }
]
```

`status` is `in_mission` only when the officer has an `in_progress` mission, and `available` otherwise (a `panic` status outranks both when the officer has an open alert). An officer who has been assigned a mission but has not yet started it is still `available` - showing them as busy would hide a free officer from the dispatcher. This is the same rule that controls map marker colour: blue means "working", not "notified".

`current_mission` carries exactly four fields: `id`, `title`, `priority`, and `status`. The dispatcher drawer calls `GET /api/v1/missions/{id}/` for the full record; sending more here would duplicate data that is already one request away.

`latest_ping` is null when the officer has just started a shift and no ping has arrived yet. An officer with no pings still appears in the list.

`position_source` says where `latest_ping` was taken from, since it is not always a real ping. It is one of: `ping` (the latest location ping); `panic` (the position of an open panic alert — used while the officer is panicking and no newer ping has arrived since the alert was triggered); `shift_start` (no ping yet, so the shift's start coordinates are shown, with `accuracy_m` and `battery_level` null and `network_type` `unknown`); or `null` when there is no position at all, in which case `latest_ping` is also null. This is independent of `status`: an officer can be `status: "panic"` while `position_source` is `ping` when a fresh ping arrived after the alert — the marker stays red, but it sits on the newer position.

`distance_covered_m` is read directly from `shift.distance_m`, which ingest keeps current. The query is fixed-cost regardless of how many officers are on duty — it does not scale with officer count.

`shift_duration_seconds` is the length of the current shift (stint) only, measured from `shift_started_at` to now. An officer works their day in as many stints as they need, so this resets to zero each time they start a new shift. It is not clipped to the day: a shift that began before midnight counts in full.

`duty_seconds_today` is every stint the officer has worked today, the current one included, with each stint clipped to Beirut local midnight (Asia/Beirut). A shift that crossed midnight counts only its part after midnight, so it is never counted on both days. For an officer on their first stint of the day, both fields are equal. In the sample above, the officer worked a 2-hour stint earlier and is 1.5 hours into the current one. This is the field to read when judging how close an officer is to their daily target. All listed officers' totals come from one query, so this field does not add a query per officer either.

`target_seconds` is the daily duty target, from the `daily_duty_target_hours` setting (default 8 hours, so 28800). It is the same for every row. It is a target, not a cap: nothing ends a shift when it is reached, and an officer may exceed it.

`GET /api/v1/officers/{id}/trail/`

All roles, with scoping. An officer may only request their own trail — any other `officer_id` returns 403. Dispatchers and supervisors may request any officer's trail.

Query parameter: `date` (YYYY-MM-DD, the Beirut local date to return). Omit to get today's trail. The day boundary is Beirut local time (Asia/Beirut), not UTC — a night-shift officer's 01:00 ping is stored at 22:00 or 23:00 UTC the previous calendar day, but it belongs to the Beirut day in which it was recorded.

Points are ordered by `recorded_at`, never `received_at`. After an offline sync the two may differ by hours; ordering by receipt time would scramble the path.

```json
{
  "officer_id": 4,
  "date": "2026-09-07",
  "point_count": 312,
  "distance_covered_m": 8450,
  "points": [
    {
      "latitude": "34.436700",
      "longitude": "35.849700",
      "accuracy_m": 12.5,
      "battery_level": 72,
      "network_type": "mobile",
      "recorded_at": "2026-09-07T07:00:30Z",
      "received_at": "2026-09-07T07:00:35Z",
      "is_offline_sync": false
    }
  ]
}
```

`distance_covered_m` in this response is recomputed from the filtered ping sequence rather than read from `shift.distance_m`, because the trail endpoint can be asked for a past date whose shift is no longer active. The same filtering rules apply — fixes with `accuracy_m` above 100m are excluded, and segments shorter than 10m are not counted.


`GET /api/v1/shifts/today/`

Officer only. Returns the caller's own duty total for today. There is no way to ask about another officer; a dispatcher or supervisor gets 403.

This is the source for the app's on-screen duty counter. It cannot be derived on the phone by counting from the active shift's start, because duty is a daily target worked across as many stints as the officer needs, and that count would reset to zero every time they split and start a new shift.

Reading this endpoint first closes a forgotten shift (the same `max_shift_hours` safety-net sweep the reports use), so an officer who ran past the limit is not told they are still on duty.

```json
{
  "date": "2026-09-10",
  "duty_seconds_today": 14400,
  "target_seconds": 28800,
  "active_shift_started_at": "2026-09-10T13:00:00+03:00",
  "active_shift_seconds": 7200
}
```

`date` is the Beirut local date (Asia/Beirut). `duty_seconds_today` is every stint worked today, the active one included, each clipped to Beirut local midnight — the same figure as `duty_seconds_today` on `/shifts/active/`. `target_seconds` is the `daily_duty_target_hours` setting (default 8h, so 28800); it is a target, not a cap. `active_shift_started_at` and `active_shift_seconds` describe the current stint only; off shift they are `null` and `0` respectively.

```json
{
  "date": "2026-09-10",
  "duty_seconds_today": 7200,
  "target_seconds": 28800,
  "active_shift_started_at": null,
  "active_shift_seconds": 0
}
```

