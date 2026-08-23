package com.municipalpolice.officerapp.data;

/**
 * Contract for the background location tracking described in the mockups
 * ("your location is not recorded while off duty", offline queueing, etc).
 *
 * Not implemented yet — wire this to FusedLocationProviderClient +
 * a WorkManager/foreground-service sync job when the backend is ready.
 * The manifest already declares the needed location + foreground-service
 * permissions.
 */
public interface LocationTracker {
    void startTracking(String missionOrShiftId);
    void stopTracking();
    boolean isTracking();
}
