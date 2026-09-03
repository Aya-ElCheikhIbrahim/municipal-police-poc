# API Contract - Municipal Poslice PocC Backend

What the android and Web squads can rely on.
Read this before writing a client agains the API.

This file is not and endpoint refrence. Endpoints fields and request bodies  are generated from the code at '/api/docs/' and are always current.

## 1. Basics

Base path: /api/v1/
Interactive docs: /api/docs/
OpenAPI schema: /api/schema/
Content type: application/json
character encoding: UTF-8, officer namesare Arabic
Timestamps: ISO 8601
Coordinates: Decimal degrees, 6 decimal places


## 2.Authentication

### Token lifetimes

Access Token: 1 hours, Sent on every request
Refresh Tiken: 12 hours, Roughly 1 shift.

### What each client must do on 401

### Logout

POST /api/v1/logout/ takes the refresh token in the body (`{"refresh": "<token>"}`) and blacklists it server-side (token_blacklist is installed). A client that only deletes its local copy leaves a valid token alive for up to 12 hours, so it must call the endpoint. No access token is required, so a client can still log out after its access token has expired.

The access token caannot be revoked, it simply expires. This is accepted at PoC scale.

POST /api/v1/shifts/end/ does not revoke the session. It ends the duty period and nothing else, so a client that wants §4.1's "session ends when the officer taps End Shift" must call POST /api/v1/logout/ separately, and check its response. End Shift used to accept a `refresh` field and blacklist it, but it returned 200 even when the blacklisting failed, which told the client its session was gone when it was not.


## 3. Roles and Permissions

permission.py

Roles: Officer, Dispatcher, Supervisor
All have permission to:
- Login, refresh, logout
- Read own profile
- Update own language and phone
- Chnage own password

Only Supervisor and Dispatcher have permission to:
- List all users
- Read another user

Only Supervisor have permission to:
- Update another user
- Chnage another user's role
- Deactivate a user

An officer cannot change their own role.
The endpoint for self-update uses a serializer that does not contain the 'role' field at all, so sending '{"role": "supervisor"} is silently ignored raather than rejected, it is not a validation error, the field simple does not exist for that operation.
Clients ashould not offer the control in the first place. 

## 4. Response conventions

### Success

- 200, read, or update returninng updated object
- 201, created, body is the new object
- 204, accepted with no body

## 5. User resources

Ten endpoints under '/api/v1/user/'. See /api/docs/ for the exact field.

There is no DELETE.
Accounts deactivate (is_active=false).
Shifts, missions, and panic events are refrence users, and the one of the requirements is that mission data retained indefinitely. A clinet offering a "delete user" button is offering something the API will not do, label it Deactivate.

Deactivated users still appear in reads.
Filter client-side, or use the query parameter if one exists. A deactivated officer's historical shifts and mission remain attributed to them.

Four defferent shapes for four operations.
Read, create, update-other aand update-self each ecpose a different field set.
Do not asssume the object you POST is the object you GET back, check the schema for each. 

Badge number is the login identifier, not email. There is no email field on the user model. 