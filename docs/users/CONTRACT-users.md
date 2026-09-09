##API contract - users

users/tests/test_users.py, test_auth.py, test_serializers.py, test_permissions.py

`GET /api/v1/users/`

Supervisor only. Returns all user accounts. No pagination — the roster of a municipal police unit is small enough that a bare array is fine.

Query parameters: `role` (officer, dispatcher, supervisor), `is_active` (true or false).

```json
[
  {
    "id": 4,
    "username": "TP-1001",
    "full_name": "سامر عبد الله",
    "badge_number": "TP-1001",
    "phone": "70123456",
    "role": "officer",
    "preferred_language": "ar",
    "is_active": true,
    "created_at": "2026-08-01T10:00:00Z",
    "last_login": "2026-09-07T07:00:00Z"
  }
]
```

`last_login` is null for an account that has never signed in. `username` is the login credential — what the officer types at the login screen. In this system it is set to the badge number at account creation so there is only one value to remember, but the two fields are stored separately.

`POST /api/v1/users/`

Supervisor only. Creates a new account. Returns 201 with the created user. There is no self-registration.

```json
{
  "username": "TP-1002",
  "password": "initial-password",
  "full_name": "نادين سمعان",
  "badge_number": "TP-1002",
  "phone": "71987654",
  "role": "officer",
  "preferred_language": "ar"
}
```

`password` is write-only — it is hashed with Argon2 before storage and never returned. Minimum 8 characters; Django's standard password validators apply. `phone` and `preferred_language` are optional. `preferred_language` is `ar` or `en`; defaults to `ar`. The Android app reads this on login to set the initial display language.

Returns the standard user object without the `password` field.

`GET /api/v1/users/{id}/`

Supervisor only. Returns one user by id.

`PATCH /api/v1/users/{id}/`

Supervisor only. Partial update — send only the fields to change. Editable fields: `full_name`, `phone`, `role`, `preferred_language`, `is_active`. PUT is not supported; the router is configured for PATCH only.

```json
{ "role": "dispatcher", "phone": "70000001" }
```

Returns the updated user object. Password is not in this serializer — use `POST /api/v1/password-reset/` to change a password.

`GET /api/v1/users/me/`

Any authenticated user. Returns the requesting user's own record in the standard user shape. Used by the web dashboard on load to confirm the session is still valid and to read the role for permission rendering.

`PATCH /api/v1/users/me/`

Any authenticated user. Updates the requesting user's own `preferred_language` and `phone` only. `role` is not in this serializer — the field is silently absent, so sending `{"role": "supervisor"}` is ignored rather than rejected. Clients must not offer the control in the first place.

```json
{ "preferred_language": "en" }
```

Returns the full user object after the update.

`POST /api/v1/users/{id}/deactivate/`

Supervisor only. Sets `is_active` to false. A deactivated account cannot log in. Its existing tokens expire naturally — deactivation does not revoke them immediately, so the officer's next request after the hour will fail. The account and all its associated records (shifts, missions, panic events) are kept — there is no delete endpoint. A supervisor cannot deactivate their own account; that returns 400.

Returns the updated user object.

`POST /api/v1/users/{id}/activate/`

Supervisor only. Sets `is_active` to true. Restores login access.

Returns the updated user object.

`POST /api/v1/device-tokens/`

Any authenticated user. Registers or updates an FCM push token for the requesting user's device. Idempotent on `token` — if the token already exists in the database it is updated in place (user, platform, metadata refreshed), not duplicated.

```json
{
  "token": "fcm-registration-token-from-the-phone",
  "platform": "android",
  "device_model": "Samsung Galaxy A54",
  "app_version": "1.0.3"
}
```

`platform` is `android` or `web`. `device_model` and `app_version` are optional. Returns the stored token object.

```json
{
  "id": 12,
  "token": "fcm-registration-token-from-the-phone",
  "platform": "android",
  "device_model": "Samsung Galaxy A54",
  "app_version": "1.0.3"
}
```

`DELETE /api/v1/device-tokens/{id}/`

Any authenticated user. Removes one of the requesting user's own device tokens — for example, on logout from a specific device. The queryset is scoped to `user=request.user`, so a token belonging to another user is not found and returns 404.

`User model`

The model is stored as `accounts_user`, not `users_user`. This name was fixed before the first migration and is shared with the Android and web squads; changing it would require dropping the database. `email`, `first_name`, and `last_name` are removed from `AbstractUser` — officers are identified by full Arabic name and badge number. There is no email field anywhere in the system.

`DeviceToken` is stored as `accounts_devicetoken`. `PasswordResetCode` is stored as `accounts_passwordresetcode`. All three follow the same override to keep the schema name consistent with the shared DBML contract.

An officer cannot change their own role. The `MeUpdateSerializer` does not include the `role` field at all — it is not validated or silently stripped, it simply does not exist for that operation.
