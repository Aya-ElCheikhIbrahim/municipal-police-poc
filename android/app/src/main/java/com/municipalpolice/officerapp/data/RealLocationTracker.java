package com.municipalpolice.officerapp.data;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.BatteryManager;

import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

/**
 * Real location tracker.
 *
 * While tracking:
 * - receives GPS updates
 * - saves every ping locally into Room
 * - marks pings as offline-sync candidates
 *
 * Uploading to Django is handled separately by LocationSyncRepository.
 */
public class RealLocationTracker implements LocationTracker {

    private final Context context;
    private final FusedLocationProviderClient fusedLocationClient;
    private final LocationPingDao locationPingDao;

    private boolean tracking = false;
    private String shiftId;

    private final LocationCallback locationCallback =
            new LocationCallback() {

                @Override
                public void onLocationResult(
                        LocationResult locationResult
                ) {

                    if (!tracking
                            || locationResult == null) {
                        return;
                    }

                    Location location =
                            locationResult.getLastLocation();

                    if (location == null) {
                        return;
                    }

                    saveLocation(location);
                }
            };

    public RealLocationTracker(Context context) {

        this.context =
                context.getApplicationContext();

        fusedLocationClient =
                LocationServices
                        .getFusedLocationProviderClient(
                                this.context
                        );

        locationPingDao =
                AppDatabase
                        .getInstance(this.context)
                        .locationPingDao();
    }

    @Override
    public void startTracking(
            String missionOrShiftId
    ) {

        if (tracking) {
            return;
        }

        shiftId = missionOrShiftId;

        boolean fineGranted =
                ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

        boolean coarseGranted =
                ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED;

        if (!fineGranted && !coarseGranted) {
            return;
        }

        LocationRequest request =
                new LocationRequest.Builder(
                        Priority.PRIORITY_HIGH_ACCURACY,
                        30_000
                )
                        .setMinUpdateIntervalMillis(
                                15_000
                        )
                        .build();

        fusedLocationClient.requestLocationUpdates(
                request,
                locationCallback,
                context.getMainLooper()
        );

        tracking = true;
    }

    @Override
    public void stopTracking() {

        if (!tracking) {
            return;
        }

        fusedLocationClient
                .removeLocationUpdates(
                        locationCallback
                );

        tracking = false;
        shiftId = null;
    }

    @Override
    public boolean isTracking() {
        return tracking;
    }

    private void saveLocation(
            Location location
    ) {

        String clientUuid =
                UUID.randomUUID().toString();

        String recordedAt =
                toUtcIso8601(
                        location.getTime()
                );

        Integer batteryLevel =
                getBatteryLevel();

        String networkType =
                "unknown";

        LocationPingEntity entity =
                new LocationPingEntity(
                        clientUuid,
                        location.getLatitude(),
                        location.getLongitude(),
                        (double) location.getAccuracy(),
                        recordedAt,
                        batteryLevel,
                        networkType,
                        true,
                        false
                );

        new Thread(() ->
                locationPingDao.insert(entity)
        ).start();
    }

    private String toUtcIso8601(
            long timeMillis
    ) {

        SimpleDateFormat format =
                new SimpleDateFormat(
                        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                        Locale.US
                );

        format.setTimeZone(
                TimeZone.getTimeZone("UTC")
        );

        return format.format(
                new Date(timeMillis)
        );
    }

    private Integer getBatteryLevel() {

        BatteryManager batteryManager =
                (BatteryManager)
                        context.getSystemService(
                                Context.BATTERY_SERVICE
                        );

        if (batteryManager == null) {
            return null;
        }

        int level =
                batteryManager.getIntProperty(
                        BatteryManager.BATTERY_PROPERTY_CAPACITY
                );

        if (level < 0) {
            return null;
        }

        return level;
    }
}