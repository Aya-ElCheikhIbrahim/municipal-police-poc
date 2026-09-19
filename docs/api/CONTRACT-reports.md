# API contract - reports

reports/tests.py — not yet written

`Status`

The reports app is a Django app shell. `views.py` and `tests.py` contain only the default Django placeholders. There are no URLs, no serializers, no services, and the app is not wired into `config/urls.py`. No endpoints are live.

`Intended scope`

`core/permissions.py` names `IsSupervisor` as the permission class for report export, establishing that reports are a Supervisor-only feature. No endpoint shape, filter set, or response format has been decided yet.

The `PROGRESS.md` and `README.md` do not list reports in the implemented or in-progress sections. This is a Phase 5+ deliverable.

`What the next developer needs to know`

The permission is already defined — `IsSupervisor` from `core/permissions.py` is what goes on every view here. The `MissionEvent` table is the source of truth for activity data: it is append-only, ordered, and carries an `actor` for every action, making it the natural backing store for any mission-level report. Shift data is in `shifts.Shift` and `shifts.LocationPing`. All foreign keys on those models use `PROTECT`, so every record referenced by a report row will still exist when the report runs.

Export format (CSV, PDF, JSON download) has not been decided.
