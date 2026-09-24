# Documentation

- [SETUP.md](SETUP.md): Running backend, web and th Android app from a clean checkout- For eveyone.
- [CONTRIBUTINGmd](CONTRIBUTING.md): Git workflow, branch , and commit rules, ownership- Fro Everyone.
- [ARCHITECTURE.md](ARCHITECTURE.md): App layout and request flow- For everyone.
- [CONFIGURATION.md](CONFIGURATION.md): Environment varivbales and settings- For Backend.
- [PROGRESS.md](PROGRESS.md): What is built, decisions taken, what comes next- For everyone.
- [api/](api/): API contracts per app- For Android, Web
- [manuals/](manuals/): ---

## API 

Start with [api/README.md] for the rules that apply to every endpoint: base path,  authentication, errors, pagination.

The per-app contracts explain the behavior behind each endpoint: who may call it, what the rules are, and what the response means.

# CONTRACTS

[CONTRACT-users.md]: Users, deviceTokens
[CONTRACT-core.md]: System settings
[CONTRACT-shifts.md]: Shifts, location-pings, active map feed, trail
[CONTRACT-missions.md]: Mission lifecycle, photos, notes
[CONTRACT-panic.md]: Panic alerts
[CONTRACT-notifications.md]: Notification feed 
[CONTRACT-reports.md]: Daily officer reports, weekly summary, CSV and PDF export.

Field-level refrence lives in the code, not here
--> Swagger at `/api/docs/`
and the OpenAPI schema at `/api/schema/` are generated from the serializers and are always current.