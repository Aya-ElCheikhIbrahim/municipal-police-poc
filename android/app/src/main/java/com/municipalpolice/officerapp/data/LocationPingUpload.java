package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

/**
 * JSON model for one location ping sent to Django.
 *
 * Matches the backend LocationPingUploadSerializer exactly.
 */
public class LocationPingUpload {

    @SerializedName("client_uuid")
    private final String clientUuid;

    @SerializedName("latitude")
    private final double latitude;

    @SerializedName("longitude")
    private final double longitude;

    @SerializedName("accuracy_m")
    private final Double accuracyM;

    @SerializedName("recorded_at")
    private final String recordedAt;

    @SerializedName("battery_level")
    private final Integer batteryLevel;

    @SerializedName("network_type")
    private final String networkType;

    @SerializedName("is_offline_sync")
    private final boolean isOfflineSync;

    public LocationPingUpload(
            String clientUuid,
            double latitude,
            double longitude,
            Double accuracyM,
            String recordedAt,
            Integer batteryLevel,
            String networkType,
            boolean isOfflineSync
    ) {
        this.clientUuid = clientUuid;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracyM = accuracyM;
        this.recordedAt = recordedAt;
        this.batteryLevel = batteryLevel;
        this.networkType = networkType;
        this.isOfflineSync = isOfflineSync;
    }

    public String getClientUuid() {
        return clientUuid;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public Double getAccuracyM() {
        return accuracyM;
    }

    public String getRecordedAt() {
        return recordedAt;
    }

    public Integer getBatteryLevel() {
        return batteryLevel;
    }

    public String getNetworkType() {
        return networkType;
    }

    public boolean isOfflineSync() {
        return isOfflineSync;
    }
}