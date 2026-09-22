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

`GET /api/v1/reports/daily/summary/`

Supervisor only. The same day, every officer on duty, for the Daily Summary table. The per-officer report above answers for one person and backs the exports; this one answers for the whole shift.

Query parameters: `date` (required), `status` (optional), `area_id` (optional).

```json
{
  "date": "2026-09-22".
  "totals": {
    "officers_on_duty": 2, "hours_on_duty": 14.5, "distance_covered_m": 18420,
    "missions_assigned": 7, "missions_completed": 5, "missions_cancelled": 1, "panic_events": 1
},
  "officers": [
    {
      "officer_id": 3, "officer_name": "مصطفى زاهر (TP-29189)", "badge_number": "TP-29189",
      "shift_start": "2026-09-22T06:00:00+03:00", "shift_end": null, "still_on_duty": true,
      "hours_on_duty": 7.5, "distance_covered_m": 12840,
      "missions_assigned": 3, "missions_completed": 3, "missions_cancelled": 0, "panic_events": 1
    }
  ]
}
```

`shift_end` is null while the officer is still on duty, which `still_on_duty` says outright so a client does not have to guess why. An officer with two shifts in one day gets one row: the first start, the last end, and the hours added up. Hours and distance follow the same day-clipping rules as the per-officer report.

`area_id` asks "who worked in this district", so the table drops officers who were on duty elsewhere all day. An unknown `area_id` is a 400, not an empty report, so a stale dropdown shows up as a mistake.

`GET /api/v1/reports/activity/`

Supervisor only. What happened on one day, oldest first: mission transitions, panic alerts and shift changes merged into one timeline. Backs the Time Snapshot screen and the officer report's timeline; both are the same question with different filters.

Query parameters: `date` (required), `from_time` and `to_time` (HH:MM, optional), `officer_id` (optional), `area_id` (optional).

```json
[
  {
    "at": "2026-09-22T11:02:14+03:00",
    "activity": "mission_completed",
    "activity_label": "Mission completed",
    "officer": {"id": 3, "full_name": "مصطفى زاهر", "badge_number": "TP-29189"},
    "area": "Al Tall, Tripoli, Lebanon",
    "area_id": 6,
    "details": "زحمة سير",
    "mission_id": 41,
    "panic_id": null
  }
]
```

`officer` is who acted, and is null for what the system did by itself, such as the unacknowledged-mission alert. `officer_id` keeps the rows an officer took part in, **including the ones done to them**: a mission created and assigned by a dispatcher belongs on that officer's timeline, with the dispatcher shown as the actor. Without that the timeline would start mid-story.

Missions carry their area, so that filter is a plain lookup. Panic alerts and shifts carry a position instead, so they are matched against the area's circle. `area` is null when a position falls outside every district.

`mission_id` and `panic_id` let a row open the thing it describes. The feed is capped at 500 rows: a day for a small unit is a few hundred, so the cap is a guard against a runaway query, not paging.

`GET /api/v1/reports/officer/`

Supervisor only. One officer over a day, a week or any range: the page behind an officer's name in the other reports.

Query parameters: `officer_id`, `start_date` and `end_date` (all required; pass the same day twice for a single day), `status` (optional, narrows both the history and the counts).

```json
{
  "officer": {"id": 3, "full_name": "مصطفى زاهر", "badge_number": "TP-29189"},
  "start_date": "2026-09-22",
  "end_date": "2026-09-22",
  "summary": {
    "hours_on_duty": 7.5, "distance_covered_m": 12840,
    "missions_assigned": 3, "missions_completed": 1, "missions_cancelled": 1,
    "missions_in_progress": 1, "panic_events": 1
  },
  "performance": {"average_acknowledgement_seconds": 45.0, "average_completion_seconds": 600.0},
  "timeline": [],
  "missions": [
    {
      "mission_id": 41, "title": "زحمة سير", "status": "completed",
      "priority": "urgent", "category": "Traffic",
      "area": "Al Tall, Tripoli, Lebanon", "area_id": 6,
      "assigned_at": "2026-09-22T10:31:00+03:00",
      "acknowledged_at": "2026-09-22T10:31:45+03:00",
      "completed_at": "2026-09-22T11:02:14+03:00",
      "cancelled_at": null
    }
  ]
}
```

A **paused** mission counts as in progress: it is still work in hand, not a finished one. `performance` is this officer's own averages, not the period's.

`timeline` is filled only when `start_date` equals `end_date`, which is what the screen asks for. Over a longer range it is an empty array and the client asks `/reports/activity/` for whatever slice it needs, rather than the server building a month of rows nobody asked to see.

An id that is not an officer's returns 404. The figures come from the same helper the weekly and custom range tables use, so a number cannot disagree between two screens.

`GET /api/v1/reports/weekly/`

Supervisor only. Weekly summary (§4.8) **and** the custom range report: they take the same parameters over a different span, so they are one endpoint.

Query parameters: `start_date` and `end_date` (required), `officer_id` (optional), `area_id` (optional).

```json
{
  "start_date": "2026-09-16",
  "end_date": "2026-09-22",
  "missions_by_priority": {"low": 3, "medium": 7, "high": 5, "urgent": 3},
  "missions_by_category": {"Municipal": 6, "Sanitation": 4, "Traffic": 7, "Infrastructure": 1},
  "missions_by_status": {"new": 0, "assigned": 2, "acknowledged": 1, "in_progress": 3, "paused": 0, "completed": 11, "cancelled": 1},
  "average_acknowledgement_seconds": 134.0,
  "average_completion_seconds": 2466.0,
  "top_officers": [{"officer_id": 3, "officer_name": "مصطفى زاهر (TP-29189)", "completed_missions": 7}],
  "totals": {
    "officers": 5, "hours_on_duty": 162.25, "distance_covered_m": 84210,
    "missions_assigned": 18, "missions_completed": 11, "missions_cancelled": 1, "panic_events": 2
  },
  "officers": [
    {
      "officer_id": 3, "officer_name": "مصطفى زاهر (TP-29189)", "badge_number": "TP-29189",
      "hours_on_duty": 38.5, "distance_covered_m": 21400,
      "missions_assigned": 7, "missions_completed": 7, "missions_cancelled": 0,
      "average_acknowledgement_seconds": 98.5, "average_completion_seconds": 2100.0,
      "panic_events": 1
    }
  ]
}
```

`totals` fills the summary cards and `officers` fills the officer activity table, one row per officer who was on duty or held a mission in the range. Hours and distance are clipped to the range, so a shift starting the evening before counts only from midnight. Each officer's averages are their own, not the period's.

Mission breakdowns are keyed on when a mission was **created**; the per-officer rows are keyed on when it was **assigned** to them, the same as the daily report. `officer_id` and `area_id` narrow the whole report, breakdowns included.

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

All nine endpoints are Supervisor only, matching the roles table in section 4.8: generating reports is a supervisor permission, not a dispatcher one. A dispatcher or officer gets 403 with `{"detail": "Only supervisors can perform this action."}`. The web dashboard must hide the Reports tab for anyone who is not a supervisor; the server refusal is the enforcement, not the UI.

`What the next developer needs to know`

The reports app owns no models and no migrations. It reads `missions`, `shifts` and `panic`, so a change to those models can change report numbers without anything in `reports/` being touched.

Query parameters are parsed in `reports/params.py`, once for all nine views. A bad value raises DRF's `ParseError`, which is why every endpoint refuses in the same shape. Adding a parameter means editing one function, not nine views.

Arabic wording lives in one dictionary in `reports/arabic.py`, along with the digit, date and PDF-drawing helpers. An English version later means adding a second dictionary, not rewriting the views. The import `from bidi.algorithm import get_display` is deliberate: the newer `from bidi import get_display` does not mirror brackets, which turns `(TP-20028)` into `)TP-20028(`.

Distance reuses `shifts.services.trail_distance_m`, the same function the live map uses, so a report and the map cannot disagree about how far an officer walked.

Areas come from `core.Area`: a centre, a radius and a name, seeded with Tripoli's districts. Missions store theirs when they are created, so filtering by district is a plain query; panic alerts and shifts store a position, so they are measured against the circle. `GET /api/v1/areas/` serves the list behind the dropdowns.

The activity feed in `reports/activity.py` reads only append-only sources, so it can never disagree with what happened: `MissionEvent` is the mission status machine's own log, and panic events are audit records that are never deleted.

`reports/tests.py` is still the default Django stub. Nothing in this app is covered by automated tests, and the bugs fixed here; a 500 on every daily report after `assigned_to` became many-to-many, exports open to the wrong roles, distance counted twice, would all have been caught by them.
