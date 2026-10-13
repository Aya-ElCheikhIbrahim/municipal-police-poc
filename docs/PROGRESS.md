# Backend progress Log

Record of what has been built, the decisions behind it, and what comes next.
Written during phase 5 (panic, reports, polish). Last reviewed 2026-10-13.

> **[ACK-REMOVAL PENDING]** The Acknowledge step is cancelled. It is kept here only if the owner requires it again

## Current state

- PostgreSQL in Docker: done
- Custom User model, Argon2 hashing: done
- User management API + device tokens: done
- Auth API, login, logout, refresh, password reset: done
- SystemSettings registry (8 settings, cached 60s): done
- Shifts, location pings, active map feed, officer trail: done
- Location retention sweep (90-day rolling, §5): done - `shifts/management/commands/cleanup_location.py`
- Officer's own location history: backend endpoint done (`GET /officers/{id}/trail/`, self-scoped, §5); a dedicated Android screen is unverified (see open items)
- Missions: full lifecycle, events, photos, notes, category: done
- Multi-officer assignment (many-to-many): done (stretch goal)
- Panic button API (trigger, cancel, resolve, active feed): done
- Nearby-officer panic alert: backend done and wired - see "Decisions and why" and the flag in "What comes next"
- Notifications feed + unread count + mark read: done
- Push notifications to phones (FCM): backend done **and** integrated in the Android app
- Swagger at /api/docs/, CORS: done
- Web dashboard: login, users, live map, missions, panic: wired to the API
- Web reports: wired to the real API (`mockData.ts` is no longer used for reports)
- Android app: FCM push and the panic button are wired to the backend; the only
  remaining app work is removing the Acknowledge leftovers (see "Acknowledge removal")
- Reports backend: daily per officer and all-officers summary, weekly and custom
  range, activity feed, individual officer report, area filters, CSV and PDF
  export in Arabic: done

## Environment

- Django 5.2.17, DRF 3.18
- PostgreSQL 18 in Docker on port 5433
- Python 3.13, venv in /backend/venv/
- Packages pinned in `requirements.txt` (reportlab, arabic-reshaper and python-bidi
  for the Arabic PDF export; firebase-admin for FCM push)
- Run the test suite with `python manage.py test` (test count not re-verified in this pass)

Each developer runs their own container with their own empty database.
Structure comes from the committed migration files, data does not.

The API is documented separately: Swagger at `/api/docs/` and the per-app
contracts in `docs/api/`.

## Decisions and why

Earlier decisions (custom user model, Argon2, JWT, no PostGIS, `db_table`
overrides, Docker for the database only, serializer per operation, no user
DELETE) still hold, see git history for the reasoning. What follows is the
record since phase 2.

**No PostGIS; distances are haversine.**
`core/geo.py` and `shifts/services.py` compute great-circle distance in a few
lines. At POC scale this is accurate enough and avoids a GIS stack, its install
story and its deployment cost. This is a deliberate, standing decision.

**Live updates are polled, not pushed.**
The dashboard polls the API on a timer rather than opening a WebSocket or SSE
channel. The live map feed (`/shifts/active/`, hook `useActiveOfficers`) and the
panic feed (hook `usePanicAlerts`) both poll every 5s; the mission list polls
every 10s and the mission detail every 5s. There is no realtime layer, no
`channels`/Redis pub-sub and no `realtime` app. This is a deliberate decision:
polling meets the §4.6 refresh requirement without the infrastructure and
deployment story a socket layer would add. Revisit only if a requirement forces
it.
> ⚠ Discrepancy to resolve: the owner's note and several older docs say the map
> polls every **15s**, and `map_refresh_seconds` defaults to **20** in
> `core/registry.py`. The web code actually polls `/shifts/active/` every **5s**
> (`web/src/features/officers/useOfficers.ts`) and does not read
> `map_refresh_seconds`. Numbers above reflect the code as of 2026-10-13.

**A mission belongs to several officers.**
`Mission.assigned_to` is a many-to-many field. The API field keeps its name, so
the web did not have to rename anything; it carries a list now. Migrations
0002–0006 add the new field, copy the existing assignments, drop the old foreign
key and rename. The old check constraint "anything past new has an assignee" had
to go: a database check cannot look at a many-to-many field, so that rule now
lives in `services.assign_mission`. Multi-assign was a stretch goal in the
requirements, so this is a recorded scope change.

**One shared status for a shared mission.**
Any assigned officer can start, add photos and complete; all of them see the
result. Per-officer status would need a through-table and a much larger change
for a stretch goal.

**Acknowledge is cancelled (scope change vs requirements §4.5).**
> **[ACK-REMOVAL PENDING]** The Acknowledge step is cancelled. It is kept here only if the oqner requires it again later

The Acknowledge step has been dropped from the mission flow. The flow is now
Start -> Complete (`assigned -> in_progress -> completed`): `start` is allowed
straight from `assigned`. The backend and docs treat Acknowledge as finished and
obsolete, and the Android app no longer shows it (the former Acknowledge button
is repurposed to Start, and the step rows are Start/Complete). The endpoint,
`acknowledged` status, `acknowledged_at` field, the "unacknowledged for X
minutes" sweep/notification, and the average-acknowledgement-time report metric
all still exist and still work; they are scheduled for removal, not removed. This
is a scope change against requirements §4.5 and is **pending Product Owner
sign-off**. See "Acknowledge removal" below for the full list of places it still
exists.

**Nearby-officer alert on panic (backend built; decision to reconcile).**
When a panic is triggered, `panic.services.trigger_panic` finds every on-duty
officer within `panic_nearby_radius_m` (a registered setting, default 2000m) via
`shifts.services.officers_near`, and `notifications.services.notify_nearby_officers_of_panic`
creates and pushes a `panic_alert` notification to each of them with their
distance from the alert. Dispatchers and supervisors are also notified
(`notify_panic_triggered`).
> ⚠ Discrepancy to resolve: the owner's note describes this as "decided, not
> built". In the code it **is** built in the backend (as above). What is *not*
> present: it alerts all officers inside the radius rather than only the single
> nearest; there is no explicit "tell dispatchers which officer was notified"
> feature; and there is no dedicated dispatcher/web UI for it - the alerts travel
> through the generic notifications feed. Needs Product Owner confirmation of what
> "built" should mean here before this is marked done or re-opened.

**Blue on the map means "working", not "notified".**
`/shifts/active/` counts only `in_progress` as on mission. Assigned officers stay
green, so a dispatcher is never shown a free officer as busy.

**Panic carries its own position.**
`/shifts/active/` uses the location sent with the panic when it is newer than the
last ping, so an officer whose phone has not synced still gets a red marker where
they pressed the button.

**Mission category stored as the form sends it.**
`Municipal`, `Sanitation`, `Traffic`, `Infrastructure`, capitalised exactly as
the dashboard's dropdown sends them. Optional, defaults to `Municipal`.

**Push is best effort, the database row is the record.**
`notifications/push.py` never raises: a Firebase outage or a dead phone token
must not fail assigning a mission. Pushes are sent after the transaction commits,
so a rolled-back assignment never reaches a phone. With `FCM_CREDENTIALS_FILE`
empty, push is simply off, so tests and teammates without a Firebase key are
unaffected.

## What comes next

### Android

- **Finish removing the Acknowledge leftovers.** The visible button and flow are
  already gone; what remains is dead plumbing - the `acknowledgeMission` API call,
  the `ACKNOWLEDGED` status value, the `acknowledgedAt` field, the `btnAcknowledge`
  view id, the acknowledge string resources, and the `== ACKNOWLEDGED` branches.
  See "Acknowledge removal".
- **Officer's own location-history screen (unverified).** The backend endpoint
  exists and is self-scoped; whether the Android app has a screen that consumes it
  is not verified in this pass. Confirm and build if missing (§5).

### Web / backend

- **Nearby-officer panic alert - reconcile with the Product Owner.** The backend
  behaviour is built (see "Decisions and why"). Decide whether the remaining work
  is only the dispatcher-facing "who was notified" view and any single-nearest
  refinement, or whether the current behaviour needs re-opening.
- **Finish the Acknowledge removal across backend and docs** once the Product
  Owner signs off the scope change (§4.5).

### Documentation / delivery (re-checked against the requirements)

- **Arabic user manuals (Officer, Dispatcher, Supervisor).** Not done -
  `docs/manuals/` holds only a stub `README.md`.
- The following requirement deliverables could not be found in the repo or docs
  and are listed as open/unverified rather than assumed done:
  - Test plan
  - Demo video
  - Signed release APK
  - Staging URL with test accounts

Already satisfied from a previous "what comes next" list (kept here so they are
not re-opened by mistake): 90-day location retention (done), the officer
location-history endpoint (backend done), the reports screens on real data
(done), and hiding the Reports tab for non-supervisors (the API is supervisor-only).

## Acknowledge removal

> **[ACK-REMOVAL PENDING]** The Acknowledge step is cancelled. It is kept here only until it is removed from the Android app; the flow is Start -> Complete.

Checklist of every place Acknowledge still exists, so each can be ticked off as
it is removed. File and line are as of 2026-10-13 (approximate - verify against
the current file when removing). The source code itself was deliberately left
untouched in this documentation pass; this list is the map for the future code
cleanup. Migrations and the generated `schema.yml` are listed for completeness
but must **not** be hand-edited (migrations are historical; `schema.yml`
regenerates from the serializers).

Backend - live code:

- [ ] `backend/missions/models.py:23` : `Mission.Status.ACKNOWLEDGED` status value
- [ ] `backend/missions/models.py:80` : `acknowledged_at` field
- [ ] `backend/missions/models.py:180` : `MissionEvent.EventType.ACKNOWLEDGED`
- [ ] `backend/missions/models.py:188` : `MissionEvent.EventType.ACK_ALERT_SENT`
- [ ] `backend/missions/models.py:97` : `ack_alert_sent_at` field
- [ ] `backend/missions/services.py:40` : `"acknowledge"` transition in `ALLOWED_FROM`
- [ ] `backend/missions/services.py:268` : `acknowledge_mission()`
- [ ] `backend/missions/services.py:482` : `flag_unacknowledged()`
- [ ] `backend/missions/views.py:269` : `MissionAcknowledgeView` (endpoint)
- [ ] `backend/missions/views.py:409` : `UnacknowledgedSweepView` (endpoint)
- [ ] `backend/missions/urls.py:26` : `missions/<id>/acknowledge/` route
- [ ] `backend/missions/urls.py:19` : `missions/sweep-unacknowledged/` route
- [ ] `backend/missions/serializers.py:48,70,78` : `awaiting_acknowledgement`
- [ ] `backend/missions/serializers.py:94` : `acknowledged_at`
- [ ] `backend/missions/admin.py:42` : `acknowledged_at` admin column
- [ ] `backend/core/registry.py:57` : `mission_ack_timeout_minutes` setting
- [ ] `backend/notifications/models.py:26` : `MISSION_UNACKNOWLEDGED` type
- [ ] `backend/notifications/services.py:160` : `notify_mission_unacknowledged()`
- [ ] `backend/reports/services.py:164,495` : average-acknowledgement-time metric
- [ ] `backend/reports/serializers.py:47,58,156,171` : ack metric / `acknowledged_at` fields
- [ ] `backend/reports/views.py:378` : ack metric in PDF export
- [ ] `backend/reports/xlsx.py:107` : ack metric in XLSX export

Backend - do not hand-edit (listed only):

- [ ] `backend/missions/migrations/0001_initial.py` and `0009_mission_paused_and_working_time.py` - historical
- [ ] `backend/notifications/migrations/0001_initial.py` - historical
- [ ] `backend/schema.yml` - regenerates from serializers
- [ ] `backend/missions/tests.py`, `backend/notifications/tests.py`, `backend/shifts/tests.py` - update when behaviour is removed

Android - leftover plumbing (visible button already removed):

- [ ] `android/.../model/MissionStatus.java:14` - `ACKNOWLEDGED` enum value
- [ ] `android/.../model/Mission.java:35` - `acknowledged_at` / `acknowledgedAt`
- [ ] `android/.../data/MissionApiService.java:18` - `acknowledgeMission` endpoint call
- [ ] `android/.../data/MissionRepository.java:16` and `RetrofitMissionRepository.java:110` - repository method
- [ ] `android/.../data/FakeMissionRepository.java:87` - fake repository method
- [ ] `android/.../ui/missiondetail/MissionDetailActivity.java:189,593` - `btnAcknowledge` view id (repurposed to Start)
- [ ] `android/.../res/layout/activity_mission_detail.xml:220` - `btnAcknowledge` id
- [ ] `android/.../ui/missions/MissionListActivity.java`, `MissionAdapter.java`, `ui/settings/SettingsActivity.java` - `== ACKNOWLEDGED` branches
- [ ] `android/.../res/values/strings.xml:99,102,104,134,142,143` and `values-ar/strings.xml` - acknowledge strings
- [ ] `android/.../res/layout/item_step_row.xml:28` - `tools:text="Acknowledge"`

Web - leftover references:

- [ ] `web/src/features/missions/types.ts`, `MissionTable.tsx`, `MissionBadges.tsx`, `api.ts` - acknowledge status/handling
- [ ] `web/src/features/reports/types.ts` - ack metric type
- [ ] `web/src/features/reports/mockData.ts` - unused mock file still contains ack fields

Docs (markers added, text kept until removal):

- [ ] `docs/SCHEMA.md`, `docs/api/CONTRACT-missions.md`, `docs/api/CONTRACT-shifts.md`,
  `docs/api/CONTRACT-reports.md`, `docs/api/CONTRACT-core.md`,
  `docs/api/CONTRACT-notifications.md`, `docs/README.md`, `README.md`,
  `backend/README.md`, `docs/PROGRESS.md`

Run `grep -rn "ACK-REMOVAL PENDING"` from the repo root to find every marker in one search.
