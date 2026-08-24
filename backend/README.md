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

Currently implemented: user management and authentication (login, token refresh, passwrod reset).
Shifts, location pings, missions and panic events are Phase 3.

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

PROGRESS.md: What is built, what is left, open risks. 