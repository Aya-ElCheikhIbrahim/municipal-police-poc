# Backend - Django REST Framework 

Django + DRF API for the Tripoli municipality field operations proof-of-concept.
Serves both the app and the web dashboard.

## Stack

Language: Python 3.13
Framwork: Django 5.2 LTS + Django REST framework
Auth
SimpleJWT
Password hashing: Argon2
Database: PostgreSQL 18 (Docker, host port 5433)
Cache/Channels: Redis 7 (Docker, port 5379)
API docs: drf-spectacular + Swagger UI

Django itself runs on thee host in a virtualenv, not in Docker.
Only PostgreSQL and Redis are containerised. 

## Prerequisites

Python 3.13
Docker Desktop (running)
Git

## API

Base path: /api/v1

Swagger UI: /api/docs
OpenAPI schema: /api/schema

Implemented:
- Auth: Login, token refresh, logout, password reset
- Users: full management (supervisors only), device-token register/remove
- Settings: GET/PATCH /settings/, GET /settings/schema/
- Areas: GET /areas/ (Tripoli districts)
- Shifts: start, end, active officers, officer trail
- Location: batch ping ingest with offline dedupe
- Missions: create, assign, acknowledge, start, complete, cancel, notes, photos, unacknowledged sweep
- Panic (Alerts): trigger, active feed, cancel (grace window), resolve, location
- Notifications: in-app feed, unread count, mark read / mark all read
- Reports: daily (per-officer + all-officer summary), weekly/custom range, activity feed, officer report; CSV + Arabic PDF export
- Push (FCM): backend delivery on mission assigned / cancelled / dispatcher message. Off while FCM_CREDENTIALS_FILE is empty; on once it points at the Firebase service-account key.

Not started / out of scope:
- WebSocket push: the map polls /shifts/active/ every 15s, which meets the refresh requirement without a socket layer.
- Android FCM integration: backend push is done and the Firebase project is configured; the officer app still needs to add the messaging SDK and register its device token via POST /device-tokens/.
## Common commands

python manage.py runserver
python manage.py makemigrations <app>
python manage.py migrate
python manage.py check
python manage.py createsuperuser
python manage.py shell

docker compose up -d
docker compose down
docker compose down -v

## Where to go next

docss/SETUP.md: Getting clean checkout running

docs/CONTRIBUTION.md: Git workflow and ownership

docs/ARCHIITECTURE.md: App layout, request flow, decisions

docs/SCHEMA.md: All ten tables

