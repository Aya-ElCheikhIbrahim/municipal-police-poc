# Backend progress Log

Record of what has been built, the decisions behind it, and what comes next.
Written at the end of phase 2.

## Current state

- PostgreSQL + Redis in Docker: done
- Custom User model, Argon2 hashing: done
- User management API (10 endpoints): done
- Auth API, login, refresh, passwrod reset: done
- Swagger at /api/docs/: done
- CORS configured: done
- Web dashboard login wired to the API: done
- Documentation (Setup, Contributing, srchitecture, schema, readme, progress, api-contractor): done
- Bakcend tests: done
- SystemtSettings model: not started
- Android app: not started

## Environment

- Django 5.2.17 
- PostgreSQL 18 in Docker onport 5433
- Redis 7 in Docker on port 6379
- Python 3.13, venv in /backend/venv/
- 25 packages pinned in 'requirements.txt'

Each developper runs their own container with their own empty database.
Structure comes from the committed migration files, data does not.

## Decisions and why

**Custom user model, set before the first migration.**
`AUTH_USER_MODEL = "users.User"`. Officers are identified by full Arabic name
and badge number, not email, so `first_name`/`last_name`/`email` were removed
and a custom `UserManager` added (Django's default assumes email exists and
`createsuperuser` crashes without it).

This cannot be changed after the first migration. We hit that — an early
`migrate` ran against Django's default User and the database had to be dropped
and recreated.

**Argon2 password hashing.**
§5 requires bcrypt or Argon2. Django silently defaults to PBKDF2, so
`PASSWORD_HASHERS` has to be set explicitly and before any user is created.

**JWT rather than sessions.**
Cookies work in a browser but not in an Android app. Access token 1 hour,
refresh 12 hours (~one shift). `token_blacklist` is installed because a JWT
cannot otherwise be revoked — and §4.2 requires the session to end when the
officer taps End Shift.

**No PostGIS.**
Coordinates are `DECIMAL(9,6)` (~11cm), distance via Haversine in Python.
PostGIS buys nothing at POC scale and complicates the Docker setup. The columns
do not change if we add it later.

**`db_table` overrides on the `users` app.**
Tables read `accounts_user`, `accounts_devicetoken`,
`accounts_passwordresetcode` while the folder keeps the clearer name `users`.
Done because the schema had already been shared with the client squads. The
`panic` app will need the same for `alerts_panicevent`.

**Docker for Postgres and Redis, not Django.**
Database setup was costing hours per person — PATH problems, schema
permissions, version drift. Python and venv setup costs five minutes and rarely
fails, so containerising Django solves a problem we do not have. Revisit in
Phase 5 when staging needs a Dockerfile anyway.

**Separate serializer per operation.**
`UserSerializer` (read), `UserCreateSerializer` (password write-only),
`UserUpdateSerializer` (no password at all), `MeUpdateSerializer` (language and
phone only). The last one is what stops an officer promoting themselves by
sending `{"role": "supervisor"}` — the field simply is not in the list.

**No DELETE on users.**
Accounts deactivate. Shifts, missions, and panic events reference them, and §5
requires mission data retained indefinitely.

## Problems hit, and the fixes

Worth knowing because they will recur on teammates' machines.

**`AUTH_USER_MODEL` set after migrating.** Database dropped and recreated. The
only real fix once data exists is hand-editing migration history — so set it
before the first `migrate`, always.

**PostgreSQL 15+ schema permissions.** `permission denied for schema public`.
A dedicated database user needs three grants: database owner, `GRANT ALL ON
SCHEMA public`, and `ALTER SCHEMA public OWNER TO`. Docker removes this
entirely.

**PostgreSQL 18 volume path.** The image now wants the volume at
`/var/lib/postgresql`, not `/var/lib/postgresql/data`. The container restart-
loops with a long explanatory error if you get it wrong.

**`$` in `.env` values.** Docker Compose treats `$` as variable substitution, so
a generated `SECRET_KEY` full of symbols gets mangled. Generate keys with
letters and digits only.

**A merged PR silently deleted `PASSWORD_HASHERS`.** The change was otherwise
correct and useful. `python manage.py check` passed. Argon2 was quietly
disabled until someone noticed. This is the argument for reading the red lines
in a diff.

**`super().get.queryset()` reached `main`.** A dot instead of an underscore.
`check` passes because the line lives inside a method body and is never
evaluated until the endpoint is called. Found by clicking through Swagger.
Tests would have caught it automatically.

**A PR merged before all commits were pushed.** A PR captures the branch at the
moment it is created; later pushes do not retroactively join it. Happened
twice. Finish the work, push, *then* open the PR.


---

## What Phase 3 needs

### Backend

Build in this order — steps 1–3 unblock Android, 4–5 unblock web:

1. `shifts/models.py` — Shift, LocationPing, and the migration
2. `POST /shifts/start/` and `POST /shifts/end/`
3. `POST /location-pings/bulk/` — batch ingest with dedupe
4. `GET /shifts/active/` — on-duty officers with latest positions
5. `GET /officers/{id}/trail/` — the day's path
6. WebSocket broadcast in `realtime/`
7. `cleanup_locations` command for 90-day retention

Then `missions/` — models, the status machine in `services.py`, photo upload.

**Three things to build in from the start**, all cheap now and expensive to
retrofit:

- **`client_uuid` generated on the phone.** §4.3 requires 8 hours of offline
  caching, which guarantees duplicate uploads on retry. Unique constraint plus
  `bulk_create(ignore_conflicts=True)` makes re-upload a no-op.
- **Batch uploads.** One request per ping drains the battery §13 warns about.
- **`recorded_at` vs `received_at`.** They differ by hours after an offline
  sync. Draw the trail in `recorded_at` order, always.

**One DB constraint worth having:** a partial unique index giving each officer
at most one `active` shift. Makes the bug impossible rather than merely
unlikely.

### Android

Produces the location data:
- Start/End Shift screen with shift timer
- Foreground service with persistent notification (Android requires it for
  background location, and it doubles as the visible indicator §5 asks for)
- Fused Location Provider at the interval from `SystemSetting`
- Write each ping to Room **first**, with a `client_uuid`
- Upload in batches, retry from the queue when the network returns

### Web

Displays the location data:
- Replace the mock officers array with `GET /shifts/active/`
- Real coordinates onto Leaflet markers, coloured by status (§4.6)
- Officer drawer → trail endpoint
- WebSocket so markers move without refreshing

**Can do right now, without waiting:** wire the Users screen to
`GET /api/v1/users/` and Add User to `POST /api/v1/users/`. Both endpoints
exist; that screen is still showing hardcoded names.

---

## Documentation

- docs/SETUP.md: clean checkout setup
- dcos/CONTRIBUTING.md: gti workflow, wonership rules, key decisions
- docs/ARCHITECTURE.md: app layout, request flow
- docs/SCHEMA/md: all database ten tables

