# Databse Schema

PostgreSQL. 100 tables.

## accounts-user : users

Every person who can log in.

Field- Type- Notes
id- bigint PK
username- varchar (150) unique 
passwrod- varchar (128)- Argon2 hash, neevr returneed by any enpoint
full_name- varchar (150)- Arabic name
badge_number - varchar(20) unique
phone- varcahr (20)- may be blank
role- varcahr (20)- officer, dispatcher, supervisor
preferred_language- varchar(2)- ar, en, default is ar
is_active- boolean
created_by_id- FK aself- which supervisor created the account
created_at- timestamptz
updated_at - timestamptz
last_login - timestamptz

No self registartion, supersisors create accounts. No delete endpoint.
Account deactivate, because shofts and mission refernece them. 

## accounts_devicetoken : users

FCM push tokens. The client POSTs on every login.

Field - Type - Notes
id - bigint PK
user_id - FK user
token - varchar(255) unique - FCM registration token
platform - varchar(10) - android, web
device_model - varchar(100) - optional, helps debugging
app_version - varchar(20) - optional
is_active - boolean - set false when FCM reports a stale token
created_at - timestamptz
last_seen_at - timestamptz

One user may have several, reinstalls, new phones.

## accounts_passwordresetcode : users

Supervisor-issued reset codes. SMS is out of scope.

Field - Type - Notes
id - bigint PK
user_id - FK user
code_hash - varchar(128) - hash only, never the plain code
issued_by_id - FK user - which supervisor generated it
created_at - timestamptz
expires_at - timestamptz
used_at - timestamptz - null until redeemed

## shifts_shift

One row per duty period.

Field - Type - Notes
id - bigint PK
officer_id - FK user
status - varchar(10) - active, ended
started_at - timestamptz - server-set
ended_at - timestamptz
start_latitude - decimal(9,6) - where Start Shift was tapped
start_longitude - decimal(9,6)
end_latitude - decimal(9,6)
end_longitude - decimal(9,6)

DB constraint: one active shift per officer. A second Start Shift returns 409, not a new row.

This table is the on/off switch for location tracking. No active shift, no pings.

## shifts_locationping

The high-volume table — roughly 960 rows per officer per 8-hour shift.

Field - Type - Notes
id - bigint PK
client_uuid - uuid unique - generated on the phone, makes offline replay idempotent
shift_id - FK shift
officer_id - FK user - denormalised, avoids a join on the map query
latitude - decimal(9,6)
longitude - decimal(9,6)
accuracy_m - float - from Fused Location Provider
recorded_at - timestamptz - phone clock at GPS fix, draw the trail in THIS order
received_at - timestamptz - server clock at insert
battery_level - smallint - 0 to 100
network_type - varchar(10) - wifi, mobile, none, unknown
is_offline_sync - boolean - replayed from the offline queue

§4.3 requires caching 8 hours of pings offline, which guarantees duplicate uploads on retry. client_uuid makes re-upload a no-op instead of a duplicate row.

Batch uploads. One request per ping drains the battery §13 warns about.

Deleted after 90 days.

## missions_mission

Field - Type - Notes
id - bigint PK
title - varchar(200)
description - text
priority - varchar(10) - low, medium, high, urgent
status - varchar(15) - new, acknowledged, in_progress, completed, cancelled
latitude - decimal(9,6) - where the officer must go
longitude - decimal(9,6)
address - varchar(300) - free text, may be blank
created_by_id - FK user - the dispatcher
assigned_to_id - FK user - the officer
deadline - timestamptz - optional
created_at - timestamptz
assigned_at - timestamptz
acknowledged_at - timestamptz
started_at - timestamptz
completed_at - timestamptz
cancelled_at - timestamptz
started_latitude - decimal(9,6) - where the officer was at Start
started_longitude - decimal(9,6)
completed_latitude - decimal(9,6) - where the officer was at Complete
completed_longitude - decimal(9,6)
notes - text - officer's notes, Arabic and English
cancellation_reason - text
ack_alert_sent_at - timestamptz - stops the 5-min alarm repeating

Status flow: new → acknowledged → in_progress → completed. Cancel is reachable from new, acknowledged, or in_progress.

Reassignment allowed only while status is new (§4.4).
Complete requires at least one photo already uploaded, otherwise 400.
assigned_at is separate from created_at — the report averages, depend on it.

## missions_missionphoto

Field - Type - Notes
id - bigint PK
client_uuid - uuid unique - same dedupe pattern as location pings
mission_id - FK mission
image - varchar - file path, the API returns a full URL
captured_latitude - decimal(9,6)
captured_longitude - decimal(9,6)
captured_at - timestamptz - phone clock at capture
uploaded_at - timestamptz - server clock
uploaded_by_id - FK user

1 to 5 per mission — the 6th returns 400. Camera only, never the gallery.

## missions_missionevent

Append-only audit log. Never updated, never deleted.

Field - Type - Notes
id - bigint PK
mission_id - FK mission
event_type - varchar(20) - created, assigned, reassigned, acknowledged, started, completed, cancelled, photo_added, note_updated
actor_id - FK user - null for system-generated events
created_at - timestamptz
metadata - jsonb - e.g. {"from_officer": 4, "to_officer": 7}

Build the dashboard timeline from this table, not from the Mission timestamp columns, it's the only place reassignments and note edits appear.

## alerts_panicevent : panic

Field - Type - Notes
id - bigint PK
officer_id - FK user
shift_id - FK shift
latitude - decimal(9,6)
longitude - decimal(9,6)
accuracy_m - float
status - varchar(10) - active, cancelled, resolved
triggered_at - timestamptz
cancelled_at - timestamptz - officer cancelled inside the 10s grace period
resolved_at - timestamptz
resolved_by_id - FK user
notes - text
battery_level - smallint
Cancelled alerts are kept, requires permanent audit logging. Exempt from the 90-day cleanup.

cancelled and resolved are different outcomes. Don't collapse them.

## core_systemsetting

Field - Type - Notes
id - bigint PK
key - varchar(60) unique
value - jsonb - holds numbers, strings, or lists
description - varchar(200) - what it does, for the admin screen
updated_at - timestamptz
updated_by_id - FK user

Keys and defaults:
location_ping_interval_seconds - 30, clamp 10 to 120
mission_ack_timeout_minutes - 5
location_retention_days - 90
panic_cancel_grace_seconds - 10
mission_photo_min - 1
mission_photo_max - 5
map_refresh_seconds - 20

Supervisor edits; the app fetches on login and at shift start. Changes take effect on the officer's next shift.