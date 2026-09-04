package com.municipalpolice.officerapp.data;

import android.annotation.SuppressLint;
import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;

/**
 * Standard implementation of LocationTracker using Android's LocationManager.
 * Does not require Google Play Services.
 */
public class StandardLocationTracker implements LocationTracker {

    private static final String TAG = "StandardLocationTracker";
    private final LocationManager locationManager;
    private boolean isTracking = false;
    private String currentMissionId;

    private final LocationListener locationListener = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location location) {
            Log.d(TAG, "Location update for " + currentMissionId + ": " + 
                  location.getLatitude() + ", " + location.getLongitude());
            // In a real app, send this to the backend or local DB here.
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(@NonNull String provider) {}

        @Override
        public void onProviderDisabled(@NonNull String provider) {}
    };

    public StandardLocationTracker(Context context) {
        this.locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
    }

    @SuppressLint("MissingPermission")
    @Override
    public void startTracking(String missionOrShiftId) {
        if (isTracking) return;
        
        this.currentMissionId = missionOrShiftId;
        try {
            // Request updates from GPS and Network providers
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 10000, 10, locationListener);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 10000, 10, locationListener);
            }
            isTracking = true;
            Log.i(TAG, "Started tracking for: " + missionOrShiftId);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start tracking", e);
        }
    }

    @Override
    public void stopTracking() {
        if (!isTracking) return;
        locationManager.removeUpdates(locationListener);
        isTracking = false;
        currentMissionId = null;
        Log.i(TAG, "Stopped tracking");
    }

    @Override
    public boolean isTracking() {
        return isTracking;
    }
}
