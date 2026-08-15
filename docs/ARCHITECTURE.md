# Architecture

Django 5.2 + PostgreSQL, split into nine apps by domain


## The tree components

Officer app
Dispatcher dashboard
Backend

**REST** for everything the client asks for. **FCM push** for things the server
must tell the phone (mission assigned). **WebSocket** for things the server must
tell the dashboard instantly (officer moved, panic alert).

The asymmetry is deliberate: a browser tab is awake so a socket is cheap; a
phone in a pocket has its radio off, so push is the only battery-sane option.

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
|--realtime/
|--notifications/

Four apps own no database tables.

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
and broadcast over WebSocket.

That is not view code. In `views.py` it becomes a 600-line file that four
people edit at once. In `services.py` the view is four lines and the rules are
testable without HTTP.

**Rule:** if you are writing an `if` about business logic in a view, it belongs
in a service.

