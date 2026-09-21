# API contract - reports

reports/tests.py; not yet written

`GET /api/v1/reports/daily/`

Supervisor only. Daily activity for one officer (section 4.8): hours on duty, distance covered, missions assigned, completed and cancelled, and panic events.

Query parameters: `date` (YYYY-MM-DD, required), `officer_id` (required), `status` (optional, one of the mission statuses, and it narrows the mission counts only).

```json
{
  "officer_id": 21,
  "officer_name": "مصطفى زاهر (TP-29189)",
  "date": "2026-09-21",
  "hours_on_duty": 0.0,
  "distance_covered_m": 0,
  "missions_assigned": 1,
  "missions_completed": 1,
  "missions_cancelled": 0,
  "panic_events": 0
}
```

`hours_on_duty` counts only the part of a shift that falls inside the requested day, so a night shift is split across the two days it touches rather than counted twice. `distance_covered_m` is summed from that day's location pings for the same reason; `Shift.distance_m` holds the whole shift and would be counted in full on both days. Both use Beirut days, the timezone the server runs in.

Missions are the ones assigned to this officer on this date. `assigned_to` is many-to-many, so a mission sent to three officers appears in all three of their reports.

A non-numeric `officer_id` or an unknown `status` returns 400, not 500. An id that belongs to a dispatcher or supervisor returns 404; this report is about officers. Deactivated officers are still reported: a past day must stay readable after the account is closed, and section 5 keeps records rather than erasing them.

`GET /api/v1/reports/weekly/`

Supervisor only. Summary over a date range (section 4.8): missions by type and priority, average acknowledgement and completion time, and the top-performing officers. Despite the name it accepts any range, not only seven days.

Query parameters: `start_date` and `end_date`, both required and both YYYY-MM-DD.

```json
{
  "start_date": "2026-09-14",
  "end_date": "2026-09-21",
  "missions_by_priority": {"low": 0, "medium": 1, "high": 0, "urgent": 0},
  "missions_by_category": {"Municipal": 0, "Sanitation": 0, "Traffic": 1, "Infrastructure": 0},
  "average_acknowledgement_seconds": 0.02,
  "average_completion_seconds": 0.0,
  "top_officers": [
    {"officer_id": 21, "officer_name": "مصطفى زاهر (TP-29189)", "completed_missions": 1}
  ]
}
```

Missions are counted by creation date. Both breakdowns always list every priority and every category, including the ones with zero, so a client can render a fixed set of rows without checking which keys exist. The category keys are capitalised (`Municipal`, `Sanitation`, `Traffic`, `Infrastructure`) because that is how missions store them.

`average_completion_seconds` averages `Mission.worked_seconds`, not `completed_at - started_at`. An urgent mission pauses the one an officer is on, and paused time is not work. `average_acknowledgement_seconds` is the gap between assignment and acknowledgement, over missions that have both.

`top_officers` is the top five by completed missions, ties broken by name. A completed mission counts for every officer it was assigned to one of them presses Complete, but they all worked it. Deactivated officers stay in the ranking for the periods they worked.

`start_date` after `end_date` returns 400. A range with no missions is not an error: the counts are zero, the averages are `0`, and `top_officers` is an empty array.

`GET /api/v1/reports/daily/export/csv/`

Supervisor only. The daily report as a CSV file. Same query parameters and same rules as the JSON endpoint.

```
البند,القيمة
العنصر,مصطفى زاهر (TP-29189)
رقم المستخدم,21
التاريخ,2026-09-21
ساعات الخدمة,0.0
المسافة المقطوعة (متر),0
```

`GET /api/v1/reports/daily/export/pdf/`

Supervisor only. The same report as a PDF, laid out right to left.

`GET /api/v1/reports/weekly/export/csv/`

Supervisor only. The weekly summary as a CSV file: the period, missions by priority, missions by type, the two averages, then the top officers table.

`GET /api/v1/reports/weekly/export/pdf/`

Supervisor only. The same summary as a PDF.

`Export format`

The exported files are always in Arabic, whatever the user's `preferred_language` ; the municipality reads its reports in Arabic. The JSON endpoints are unaffected: field names and status values stay in English, and the dashboard labels them itself.

PDFs use Cairo, bundled in `reports/fonts/` under the SIL Open Font License with `OFL.txt` beside it, as the license requires. Text is right-aligned, numbers are Arabic-Indic (١٢٣) with `٫` as the decimal mark, and dates are written out in the month names used in Lebanon (١٩ أيلول ٢٠٢٦). reportlab draws characters in the order it is given and cannot join Arabic letters or reorder right-to-left text, so every line goes through `arabic.shape()` first: arabic-reshaper for the joined letter forms, then python-bidi for visual order. Text copied out of these PDFs comes back scrambled; that is the cost of drawing Arabic in display order, not a bug.

CSVs have Arabic headers but keep Western digits and numeric dates, so Excel can still sum, sort and chart them. Each file starts with a byte-order mark; without it Excel opens the file as ANSI and every Arabic letter arrives as garbage.

Badge numbers are identifiers and are never converted to Arabic-Indic digits, so they always match what is stored and what the dashboard shows.

Errors from the export endpoints are ordinary JSON (`{"detail": "..."}`), not a broken file, so a client can show the reason a download failed.

`Permissions`

All six endpoints are Supervisor only, matching the roles table in section 4.8: generating reports is a supervisor permission, not a dispatcher one. A dispatcher or officer gets 403 with `{"detail": "Only supervisors can perform this action."}`. The web dashboard must hide the Reports tab for anyone who is not a supervisor; the server refusal is the enforcement, not the UI.

`What the next developer needs to know`

The reports app owns no models and no migrations. It reads `missions`, `shifts` and `panic`, so a change to those models can change report numbers without anything in `reports/` being touched.

Query parameters are parsed in `reports/params.py`, once for all six views. A bad value raises DRF's `ParseError`, which is why every endpoint refuses in the same shape. Adding a parameter means editing one function, not six views.

Arabic wording lives in one dictionary in `reports/arabic.py`, along with the digit, date and PDF-drawing helpers. An English version later means adding a second dictionary, not rewriting the views. The import `from bidi.algorithm import get_display` is deliberate: the newer `from bidi import get_display` does not mirror brackets, which turns `(TP-20028)` into `)TP-20028(`.

Distance reuses `shifts.services.trail_distance_m`, the same function the live map uses, so a report and the map cannot disagree about how far an officer walked.

`reports/tests.py` is still the default Django stub. Nothing in this app is covered by automated tests, and the bugs fixed here; a 500 on every daily report after `assigned_to` became many-to-many, exports open to the wrong roles, distance counted twice, would all have been caught by them.