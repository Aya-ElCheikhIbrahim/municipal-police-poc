# API contract - notifications

notifications/tests.py::CreationTests, ReadStateTests, ScopingTests, ApiTests

`GET /api/v1/notifications/`

All roles. Every authenticated user has their own notification feed — this endpoint is not role-gated. The response is paginated: the list uses `generics.ListAPIView` and returns `{count, next, previous, results}`, not a bare array. Clients must read from `results`.

Query parameters: `unread` (pass `true` to exclude already-read notifications), `type` (filter by `notification_type` value).

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 14,
      "notification_type": "mission_assigned",
      "notification_type_display": "Mission Assigned",
      "title": "New mission assigned",
      "body": "Traffic obstruction on Al-Mina road",
      "mission_id": 31,
      "mission_title": "Traffic obstruction on Al-Mina road",
      "mission_status": "assigned",
      "is_read": false,
      "read_at": null,
      "created_at": "2026-09-07T09:01:00Z"
    }
  ]
}
```

`mission_id`, `mission_title`, and `mission_status` are `null` when the notification is not linked to a mission — for example, a `dispatcher_message` sent without a mission context. `notification_type` is one of `mission_assigned`, `mission_cancelled`, `mission_unacknowledged`, `dispatcher_message`, `panic_alert`. Notifications are ordered newest-first. Page size is 25.

`GET /api/v1/notifications/unread-count/`

All roles. Returns the unread count for the requesting user only. This endpoint exists separately from the list because the dashboard badge polls it far more often than the full list is opened — no serialisation of rows the caller discards.

```json
{ "unread_count": 3 }
```

`POST /api/v1/notifications/{id}/read/`

All roles. Marks one notification as read and returns the updated object. The notification must belong to the requesting user. A notification belonging to another user is indistinguishable from one that does not exist — the response is 404, never 403. This prevents confirming that a row exists at all.

No request body.

```json
{
  "id": 14,
  "notification_type": "mission_assigned",
  "notification_type_display": "Mission Assigned",
  "title": "New mission assigned",
  "body": "Traffic obstruction on Al-Mina road",
  "mission_id": 31,
  "mission_title": "Traffic obstruction on Al-Mina road",
  "mission_status": "in_progress",
  "is_read": true,
  "read_at": "2026-09-07T09:05:00Z",
  "created_at": "2026-09-07T09:01:00Z"
}
```

`mark_read` is idempotent. Calling it on an already-read notification does not move `read_at` — the first timestamp is preserved.

`POST /api/v1/notifications/mark-all-read/`

All roles. Marks every unread notification belonging to the requesting user as read in a single bulk update. Returns the number of rows actually changed — zero is a valid and normal response when the feed is already clear. Does not touch other users' notifications.

No request body.

```json
{ "marked_read": 5 }
```

`Notification types and triggers`

Notifications are created by `notifications/services.py` in response to domain events. Clients never POST a notification directly.

`mission_assigned` — written by `notify_mission_assigned()` when a mission is assigned or reassigned before acknowledgement. Recipient is the assigned officer.

`mission_cancelled` — written by `notify_mission_cancelled()` when a mission is cancelled. Recipient is the officer who was assigned at the time of cancellation. If the mission was never assigned `officer` is `None` and the function returns `None` without writing a row — there is nobody to tell.

`mission_unacknowledged` — written by `notify_mission_unacknowledged()` from inside the unacknowledged sweep. Fans out to every active dispatcher and supervisor. Officers are not notified — this alert belongs on the dashboard, not the officer's phone. `bulk_create` is used so one sweep that covers many overdue missions does not issue N×recipients individual inserts. Inactive users are excluded from the fan-out.

`dispatcher_message` — written by `notify_dispatcher_message()`. Recipient is a named officer. The related mission is optional.

`panic_alert` — the type is defined in the model but no trigger is wired yet. The panic app has no model at this point in the POC.

`Scoping`

Every service function that reads notifications filters by `recipient=user` before any other condition. `get_for_user()` uses `filter(pk=pk, recipient=user).first()` rather than `get(pk=pk)` followed by an ownership check — a foreign notification is indistinguishable from a missing one at the query level, not just the response level. This is the property the 404-not-403 test verifies.
