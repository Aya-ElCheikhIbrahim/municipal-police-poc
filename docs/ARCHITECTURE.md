# Architecture

Django 5.2 + PostgreSQL, split into nine apps by domain


## The three components

Officer app
Dispatcher dashboard
Backend

**REST** for everything the client asks for. **FCM push** for things the server
must tell the phone (mission assigned, panic alert to nearby officers). The
dispatcher dashboard gets its live updates (officer moved, panic alert) by
**polling** the REST API on a short timer, not over a WebSocket.

The asymmetry is deliberate: a phone in a pocket has its radio off, so push is
the only battery-sane way to reach it; a browser tab is awake and polling a
couple of endpoints every few seconds is cheap enough that it is not worth a
realtime layer, its infrastructure and its deployment story at POC scale. See
`docs/PROGRESS.md` for the polling decision and the current intervals.

# Backend layout

backend/
|--config/
|--core/
pagination, commands
|--authentication/
|--users/
|--shifts/
|--missions/
|--panic/
|--reports/
model
|--notifications/

Several apps own no database tables of their own - for example `reports`, which
reads from `missions`, `shifts` and `panic` and owns no models or migrations.

## Files in an app

models.py
serializers.py
views.py
services.py
permissions.py
urls.py

A request travels:

config/urls.py -> app/urls.py -> views.py -> permissions.py ->
    serializers.py -> services.py -> models.py -> PostgreSQL

    ## Why `services.py` exists

Completing a mission means: validate the status transition, confirm a photo
exists, stamp `completed_at` and location, write a `MissionEvent` audit row,
and send any notifications (the dashboard sees the change on its next poll).

That is not view code. In `views.py` it becomes a 600-line file that four
people edit at once. In `services.py` the view is four lines and the rules are
testable without HTTP.

**Rule:** if you are writing an `if` about business logic in a view, it belongs
in a service.

