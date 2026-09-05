package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

import java.util.List;

/**
 * Request body for:
 *
 * POST /api/v1/location-pings/bulk/
 *
 * JSON shape:
 * {
 *   "pings": [...]
 * }
 */
public class BulkLocationPingRequest {

    @SerializedName("pings")
    private final List<LocationPingUpload> pings;

    public BulkLocationPingRequest(List<LocationPingUpload> pings) {
        this.pings = pings;
    }

    public List<LocationPingUpload> getPings() {
        return pings;
    }
}
