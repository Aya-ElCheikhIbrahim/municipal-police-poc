##contract - config

config/settings.py

The project configuration. Read this before setting up a new environment or debugging a configuration problem.

`Environment variables`

All secrets and environment-specific values come from a `.env` file read by `python-decouple`. Never hardcode these. A `.env.example` is committed with dummy values — copy it and fill in real values.

```
SECRET_KEY=letters-and-digits-only-no-dollar-signs
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=municipal_police
DB_USER=municipal_user
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5433

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

`SECRET_KEY` must contain only letters and digits. Docker Compose treats `$` as variable substitution, so a generated key full of symbols will be silently mangled. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`.

`DB_PORT` is 5433, not the default 5432. The Docker Compose file maps the container's 5432 to the host's 5433 to avoid collisions with any locally installed Postgres instance.

`CORS_ALLOWED_ORIGINS` is a comma-separated list. The default covers the Vite dev server (5173) and a generic React dev server (3000). Add the deployed frontend origin before going to staging.

`Token lifetimes`

```python
ACCESS_TOKEN_LIFETIME  = 1 hour
REFRESH_TOKEN_LIFETIME = 12 hours   # roughly one shift
ROTATE_REFRESH_TOKENS  = True
BLACKLIST_AFTER_ROTATION = True
AUTH_HEADER_TYPES = ("Bearer",)
```

Refresh tokens rotate on every use — calling `POST /api/v1/token/refresh/` returns a new pair and blacklists the old refresh token. A client that does not store the new refresh token will be locked out at the next rotation. `token_blacklist` is installed, which is what makes `POST /api/v1/logout/` actually revoke the token rather than just forgetting it locally.

`Password hashing`

Argon2 is first in `PASSWORD_HASHERS`, which makes it the default for all new passwords. PBKDF2 and BCrypt are listed as fallbacks so existing hashes from those algorithms still verify if the database is ever migrated from another system. `argon2-cffi` must be installed — it is in `requirements.txt`.

This was set deliberately before the first migration. Django silently defaults to PBKDF2 if `PASSWORD_HASHERS` is absent. A merged PR once deleted this block and Argon2 was quietly disabled until someone noticed.

`Timezone`

```python
TIME_ZONE = "Asia/Beirut"
USE_TZ = True
```

`USE_TZ = True` means all datetimes are stored in UTC in the database. `TIME_ZONE` sets the local timezone for display and for day-boundary calculations (daily reports, trail date filters). Without this, a night-shift officer's 01:00 pings fall on the previous calendar date.

Client teams convert UTC timestamps to Beirut time at render. The server never sends local time.

`User model`

```python
AUTH_USER_MODEL = "users.User"
```

Set before the first migration ever ran. Changing this after migrations exist means dropping the database — Django cannot rename the auth tables after the fact. The custom model removes `first_name`, `last_name`, and `email` (officers log in with badge number, not email) and adds `full_name`, `badge_number`, `phone`, `role`, and `preferred_language`.

`Media files`

```python
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
```

Mission photos are saved to `media/missions/<mission_id>/<filename>` in development. The `media/` folder is gitignored. In the POC staging environment this stays on local disk — a MinIO or S3 bucket is the production path but is not configured here.

`URL routing`

All API endpoints live under `/api/v1/`. The root router in `config/urls.py` delegates to each app's `urls.py` — no endpoint is defined in `config` itself.

Interactive API documentation is at `/api/docs/` (Swagger UI). The raw OpenAPI schema is at `/api/schema/`. Both are always current because drf-spectacular generates them from the code.

The admin panel is at `/admin/`. Superuser access only. Useful as a fallback for user management if the web dashboard is unavailable.
