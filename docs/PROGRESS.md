# Backend progress Log

Record of what has been built, the decisions behind it, and what comes next.
Written during phase 5 (panic, reports, polish).

## Current state

- PostgreSQL in Docker: done
- Custom User model, Argon2 hashing: done
- User management API + device tokens: done
- Auth API, login, logout, refresh, password reset: done
- SystemSettings registry (7 settings, cached 60s): done
- Shifts, location pings, active map feed, officer trail: done
- Missions: full lifecycle, events, photos, notes, category: done
- Multi-officer assignment (many-to-many): done
- Panic button API (trigger, cancel, resolve, active feed): done
- Notifications feed + unread count + mark read: done
- Push notifications to phones (FCM): backend done, not merged yet
- Swagger at /api/docs/, CORS: done
- Web dashboard: login, users, live map, missions, panic: wired to the API
- Web reports: still mock data
- Android app: builds and works, but three gaps (see What comes next)
- Reports backend: not implemented yet (empty app)

## Environment

- Django 5.2.17, DRF 3.18
- PostgreSQL 18 in Docker on port 5433
- Python 3.13, venv in /backend/venv/
- 26 packages pinned in `requirements.txt` (firebase-admin added for push)
- 160 tests, all passing (`python manage.py test`)

Each developer runs their own container with their own empty database.
Structure comes from the committed migration files, data does not.

The API is documented separately: Swagger at `/api/docs/` and the per-app
contracts in `docs/api/`.

## Decisions and why

Earlier decisions (custom user model, Argon2, JWT, no PostGIS, `db_table`
overrides, Docker for the database only, serializer per operation, no user
DELETE) still hold, see git history for the reasoning. What changed since
phase 2:

**A mission belongs to several officers.**
`Mission.assigned_to` is now a many-to-many field. The API field keeps its
name, so the web did not have to rename anything; it just carries a list now.
Migrations 0002–0006 add the new field, copy the existing assignments, drop the
old foreign key and rename. The old check constraint "anything past new has an
assignee" had to go: a database check cannot look at a many-to-many field, so
that rule now lives in `services.assign_mission`. lists multi-assign as a
stretch goal, so this is a recorded scope change.

**One shared status for a shared mission.**
Any assigned officer can acknowledge, start, add photos and complete; all of
them see the result. Per-officer status would need a through-table and a much
larger change for a stretch goal.

**Acknowledging is optional.**
`start` is allowed from `assigned` as well as `acknowledged`. The endpoint and
the status stay so the current Android build keeps working, but an officer can
go straight to Start. When they do, `acknowledged_at` stays empty rather than
being filled with a made-up time.

**Blue on the map means "working", not "notified".**
`/shifts/active/` counts only `in_progress` as on mission. Assigned or
acknowledged officers stay green, so a dispatcher is never shown a free officer
as busy.

**Panic carries its own position.**
`/shifts/active/` uses the location sent with the panic when it is newer than
the last ping, so an officer whose phone has not synced still gets a red marker
where they pressed the button (asks for the alert to show a location).

**Mission category stored as the form sends it.**
`Municipal`, `Sanitation`, `Traffic`, `Infrastructure`, capitalised exactly as
the dashboard's dropdown sends them. Lowercase values would have meant a
mapping layer on the web for no gain. Optional, defaults to `Municipal`.

**Push is best effort, the database row is the record.**
`notifications/push.py` never raises: a Firebase outage or a dead phone token
must not fail assigning a mission. Pushes are sent after the transaction
commits, so a rolled-back assignment never reaches a phone. With
`FCM_CREDENTIALS_FILE` empty, push is simply off, tests and teammates without
a Firebase key are unaffected.

**Polling for live updates.**
The map polls `/shifts/active/` every 15s (asks for 15–30s) and the panic
feed every 5s (asks for 10s). Both requirements are met without adding a
realtime layer, its infrastructure and its deployment story. Revisit only if a
requirement forces it.

## What comes next

### Android

- **Integrate FCM push notifications.** The backend now pushes on mission
  assigned, cancelled and dispatcher message; the app needs the Firebase
  messaging library, `google-services.json`, a `missions` notification channel,
  and it must register its device token with `POST /device-tokens/` after
  login. Roughly 1–2 days of work.
- **Connect the panic button to the backend.** Holding the button only opens a
  local confirmation screen today; it must call `POST /panic/`, and Cancel
  Alert must call `/panic/{id}/cancel/` inside the 10-second window.
- **Remove the acknowledge step.** The backend already allows starting straight
  from `assigned`, so the mission screen should go Start → Complete and drop
  the Acknowledge button.

### Web

- **Connect the reports screens to real data.** They still read
  `mockData.ts`; this depends on the reports API below.

### Backend

- **Reports API**, daily activity per officer, weekly summary, CSV and PDF
  export. The `reports/` app is still empty stubs.
- **Nearest-officer alert on panic**, still under discussion: when a panic is
  triggered, also notify the closest on-duty officer and tell dispatchers who
  was notified. Not in the requirements (names only dispatchers and
  supervisors), so it needs Product Owner sign-off before it is built.