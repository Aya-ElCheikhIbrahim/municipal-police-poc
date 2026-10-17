# Backend progress Log

Record of what has been built, the decisions behind it, and what comes next.
Written during phase 5 (panic, reports, polish). Last reviewed 2026-10-13.

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
- Android app: FCM push and the panic button are wired to the backend; the
  Acknowledge step has been fully removed
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

**Acknowledge removed (scope change vs requirements §4.5).**

The Acknowledge step has been removed from the mission flow. The flow is now
Start -> Complete (`assigned -> in_progress -> completed`): `start` is allowed
straight from `assigned`. The endpoint, the `acknowledged` status, the
`acknowledged_at` / `ack_alert_sent_at` columns, the "unacknowledged for X
minutes" sweep and notification, and the average-acknowledgement-time report
metric have all been removed across the backend, the web dashboard, and the
Android app (where the former Acknowledge button is now the Start button). This
is a scope change against requirements §4.5.

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

- **Officer's own location-history screen (unverified).** The backend endpoint
  exists and is self-scoped; whether the Android app has a screen that consumes it
  is not verified in this pass. Confirm and build if missing (§5).

### Web / backend

- **Nearby-officer panic alert - reconcile with the Product Owner.** The backend
  behaviour is built (see "Decisions and why"). Decide whether the remaining work
  is only the dispatcher-facing "who was notified" view and any single-nearest
  refinement, or whether the current behaviour needs re-opening.

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

Done. The Acknowledge step has been fully removed across the backend (code,
migrations, tests), the web dashboard, and the Android app, and every
removal marker in the docs has been cleared. See the "Acknowledge
removed" decision note above for what the change covered.
