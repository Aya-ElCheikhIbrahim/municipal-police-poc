# Backend Structure — Municipal Police Field Operations POC

Django 5 + DRF + PostgreSQL + Channels
Reference for the Backend squad. Agreed before any app code is written.

---

## The tree

```
backend/
│
├── manage.py
├── requirements.txt
├── .env                          # gitignored — never commit
├── .env.example                  # committed — every var name, dummy values
├── .gitignore
├── Dockerfile
├── docker-compose.yml            # web + postgres + redis
├── README.md                     # clean-checkout setup steps (Phase 6 deliverable)
│
├── config/                       # the project — owns no domain logic
│   ├── settings.py               # AUTH_USER_MODEL, Argon2, JWT, CORS, TIME_ZONE=UTC
│   ├── urls.py                   # root router, /api/v1/ namespace, one line per app
│   ├── asgi.py                   # entry point for WebSockets (Channels)
│   └── wsgi.py                   # entry point for normal HTTP (Gunicorn)
│
├── core/                         # shared plumbing + SystemSetting
│   ├── models.py                 # SystemSetting
│   ├── serializers.py
│   ├── views.py                  # GET /settings/ — app reads on login + shift start
│   ├── urls.py
│   ├── admin.py
│   ├── permissions.py            # IsOfficer, IsDispatcher, IsSupervisor
│   ├── pagination.py             # one page size for the whole API
│   ├── exceptions.py             # one error JSON shape for the whole API
│   └── management/
│       └── commands/
│           ├── cleanup_locations.py        # 90-day retention (section 5 Privacy)
│           ├── check_unacked_missions.py   # 5-min ack alarm (section 4.9)
│           └── seed_demo_data.py           # 3 officers + missions for demos
│
├── authentication/               # HOW users authenticate — owns no model
│   ├── serializers.py            # login, refresh, reset payloads
│   ├── views.py
│   ├── services.py               # issue/refresh tokens, generate + verify reset codes
│   ├── urls.py
│   └── tests.py
│
├── users/                        # WHO the users are
│   ├── models.py                 # User, DeviceToken, PasswordResetCode
│   ├── serializers.py
│   ├── views.py
│   ├── services.py               # create user, deactivate, register FCM token
│   ├── permissions.py            # only a Supervisor may create users
│   ├── urls.py
│   ├── admin.py                  # free user-management UI — Phase 2 fallback
│   ├── migrations/
│   └── tests.py
│
├── shifts/                       # Shift + LocationPing (kept together)
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   ├── services.py               # start/end shift, bulk ping ingest + dedupe
│   ├── urls.py
│   ├── admin.py
│   ├── migrations/
│   └── tests.py
│
├── missions/
│   ├── models.py                 # Mission, MissionPhoto, MissionEvent
│   ├── serializers.py
│   ├── views.py
│   ├── services.py               # status machine, audit writes, photo rules
│   ├── permissions.py            # officer sees only own; dispatcher sees all
│   ├── urls.py
│   ├── admin.py
│   ├── migrations/
│   └── tests.py
│
├── panic/
│   ├── models.py                 # PanicEvent
│   ├── serializers.py
│   ├── views.py
│   ├── services.py               # trigger, cancel within grace, resolve, fan-out
│   ├── urls.py
│   ├── admin.py
│   ├── migrations/
│   └── tests.py
│
├── reports/                      # owns no model — reads across apps
│   ├── views.py
│   ├── serializers.py
│   ├── services.py               # daily + weekly aggregation
│   ├── exporters.py              # CSV + PDF
│   ├── urls.py
│   └── tests.py
│
├── realtime/                     # owns no model — WebSocket layer
│   ├── consumers.py              # the "views" of WebSockets
│   ├── routing.py                # the "urls.py" of WebSockets
│   └── services.py               # broadcast helpers other apps import
│
├── notifications/                # owns no model — FCM push
│   ├── services.py               # send_to_user(), send_to_role()
│   └── tests.py
│
└── media/                        # gitignored — mission photos in dev only
```

Every app also has `__init__.py`, `apps.py`, and `tests.py`.
Apps that own models also have `migrations/` — **commit these to Git.**

---

## Which apps own tables

| App | Tables it creates |
|---|---|
| `users` | `users_user`, `users_devicetoken`, `users_passwordresetcode` |
| `shifts` | `shifts_shift`, `shifts_locationping` |
| `missions` | `missions_mission`, `missions_missionphoto`, `missions_missionevent` |
| `panic` | `panic_panicevent` |
| `core` | `core_systemsetting` |
| `authentication`, `reports`, `realtime`, `notifications` | none |

Four apps own no model. That is correct, not an oversight — they are behaviour,
not data.

---

## Decisions and why

**`authentication/` and `users/` stay separate.**
`users/` is *who they are* — the model, CRUD, admin. `authentication/` is *how
they prove it* — login, refresh, reset. Different squads can own them without
collision, and the auth flow changes far more often than the User model does.

**`shifts/` and `locations/` are merged.**
`LocationPing` has a mandatory FK to `Shift`, is never queried without shift
context, and is written by the same flow. Splitting would create two migration
histories that must stay in step for no benefit.

**Every app that owns a model gets `services.py`.**
Completing a mission means: validate the transition, confirm a photo exists,
stamp `completed_at` plus location, write a `MissionEvent`, broadcast over
WebSocket. That is not view code. With 12 people, a fat `views.py` is the
merge-conflict hotspot.

**`core/permissions.py` holds the role classes.**
`IsOfficer` / `IsDispatcher` / `IsSupervisor` are used by every app, so they
live in one place. `missions/permissions.py` and `users/permissions.py` hold
only rules specific to those domains.

**`realtime/` and `notifications/` are separate.**
Two different transports for two different clients — WebSocket to the browser,
FCM to the phone. Other apps import them; nothing calls them over HTTP.

---

## Naming — action needed

The folder names above produce table names that **do not match** the DBML
already sent to the Android and Web squads:

| Table Django will create | Current DBML says |
|---|---|
| `users_user` | `accounts_user` |
| `users_devicetoken` | `accounts_devicetoken` |
| `users_passwordresetcode` | `accounts_passwordresetcode` |
| `panic_panicevent` | `alerts_panicevent` |

`shifts_*`, `missions_*`, and `core_systemsetting` already match.

Regenerate the DBML to match these folder names, and send both squads the
corrected file in one message. Renaming a Django app after migrations exist
means a hand-written `db_table` on every model, or dropping the database.

---

## Build order

1. **`config/`** — set `AUTH_USER_MODEL = "users.User"` in `settings.py`
   **before the first `migrate` ever runs.** Changing it later means dropping
   the database.
2. **`docker-compose.yml`** — Postgres + Redis, ~20 lines. Do this in Week 3,
   not Week 8. Twelve laptops will otherwise burn days on environment problems,
   and a demo is the worst place to discover it.
3. **`core/`** — permissions, pagination, exceptions. Everything else imports
   these, so they must exist first.
4. **`users/` then `authentication/`** — Week 3-4.
5. **`shifts/` then `missions/`** — Week 5-7.
6. **`realtime/`, `notifications/`** — alongside missions.
7. **`panic/`, `reports/`** — Week 10-11.

## Settings checklist before the first migration

- `AUTH_USER_MODEL = "users.User"`
- Argon2 first in `PASSWORD_HASHERS`, and `pip install argon2-cffi`
- `USE_TZ = True`, `TIME_ZONE = "UTC"`
- `drf-spectacular` installed — Swagger at `/api/docs/` is a Phase 6 deliverable
  and unblocks both client squads in Week 3
- Seed `SystemSetting` in a data migration so no key is ever missing
