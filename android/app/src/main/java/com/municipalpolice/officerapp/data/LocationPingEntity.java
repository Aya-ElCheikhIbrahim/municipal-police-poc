package com.municipalpolice.officerapp.data;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

/**
 * One locally stored location ping.
 *
 * These fields match the Django LocationPingUploadSerializer:
 * - client_uuid
 * - latitude
 * - longitude
 * - accuracy_m
 * - recorded_at
 * - battery_level
 * - network_type
 * - is_offline_sync
 */
@Entity(tableName = "location_pings")
public class LocationPingEntity {

    @PrimaryKey
    @NonNull
    public String clientUuid;

    public double latitude;
    public double longitude;

    public Double accuracyM;

    /**
     * ISO-8601 UTC timestamp, e.g.
     * 2026-09-04T12:30:00Z
     */
    @NonNull
    public String recordedAt;

    public Integer batteryLevel;

    /**
     * Expected backend values will come from
     * LocationPing.NetworkType choices.
     * For now we can use "unknown" when not known.
     */
    @NonNull
    public String networkType;

    public boolean isOfflineSync;

    /**
     * Local-only field.
     * false = waiting to upload
     * true = upload currently/previously attempted
     */
    public boolean syncAttempted;

    public LocationPingEntity(
            @NonNull String clientUuid,
            double latitude,
            double longitude,
            Double accuracyM,
            @NonNull String recordedAt,
            Integer batteryLevel,
            @NonNull String networkType,
            boolean isOfflineSync,
            boolean syncAttempted
    ) {
        this.clientUuid = clientUuid;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracyM = accuracyM;
        this.recordedAt = recordedAt;
        this.batteryLevel = batteryLevel;
        this.networkType = networkType;
        this.isOfflineSync = isOfflineSync;
        this.syncAttempted = syncAttempted;
    }
}