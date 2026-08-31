# Implementation Plan - Secure Logout Validation

Prevent officers from logging out while they have an active shift or pending missions. This ensures that tracking data is not lost and that all assigned tasks are accounted for before the session ends.

## User Review Required

> [!IMPORTANT]
> This validation relies on a network call to fetch the latest mission status. If the officer is offline, the app will check the last known local state (if available) or require a connection to verify mission status.

> [!NOTE]
> The "End Shift" requirement is strictly enforced via a local preference flag, while the "Active Missions" requirement is checked against the backend.

## Proposed Changes

### [Component] Storage & State Tracking

#### [MODIFY] [PrefsManager.java](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/java/com/municipalpolice/officerapp/util/PrefsManager.java)
- Add `setIsShiftActive(boolean)` and `isShiftActive()` to track the duty state locally.

#### [MODIFY] [ShiftActivity.java](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/java/com/municipalpolice/officerapp/ui/shift/ShiftActivity.java)
- Update the `isShiftActive` flag in `PrefsManager` when the server successfully acknowledges a shift start or end.

---

### [Component] Validation Logic

#### [MODIFY] [SettingsActivity.java](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/java/com/municipalpolice/officerapp/ui/settings/SettingsActivity.java)
- Update `logout()` to perform the following checks before clearing credentials:
    1. **Shift Check:** Verify `prefs.isShiftActive()`. If `true`, show an error dialog explaining that the shift must be ended first.
    2. **Mission Check:** Call `missionRepository.fetchMissions()`. If any mission has a status other than `COMPLETED` or `CANCELLED`, show an error dialog listing the pending tasks.
    3. **Final Logout:** Only proceed to `RetrofitAuthRepository.logout()` if both checks pass.

---

### [Component] UI / UX

#### [MODIFY] [res/values/strings.xml](file:///C:/Users/sayed/StudioProjects/municipal-police-poc/android/app/src/main/res/values/strings.xml)
- Add user-facing strings for the validation errors:
    - `logout_error_active_shift`: "You cannot log out while a shift is active. Please end your shift first."
    - `logout_error_pending_missions`: "You have active missions. Please complete or acknowledge them before logging out."
    - `logout_validation_loading`: "Verifying duty status..."

## Verification Plan

### Automated Tests
- Unit tests for `SettingsActivity` logic to ensure logout is blocked when flags are set.
- Mock repository tests to verify that different mission status combinations correctly trigger or bypass the block.

### Manual Verification
1. **Active Shift:** Start a shift, then go to Settings and try to log out. Verify the "End shift first" dialog appears.
2. **Active Mission:** End the shift, but leave one mission in the `ASSIGNED` or `IN_PROGRESS` state. Try to log out. Verify the "Pending missions" dialog appears.
3. **Clean Logout:** End the shift and complete all missions. Verify that logging out works immediately and returns to the Login screen.
