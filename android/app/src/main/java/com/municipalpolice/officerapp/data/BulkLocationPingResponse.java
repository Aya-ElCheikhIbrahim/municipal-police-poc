package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

/**
 * Response from:
 * POST /api/v1/location-pings/bulk/
 *
 * Example:
 * {
 *   "accepted": 12,
 *   "duplicates": 0,
 *   "rejected": 0
 * }
 */
public class BulkLocationPingResponse {

    @SerializedName("accepted")
    private int accepted;

    @SerializedName("duplicates")
    private int duplicates;

    @SerializedName("rejected")
    private int rejected;

    public int getAccepted() {
        return accepted;
    }

    public int getDuplicates() {
        return duplicates;
    }

    public int getRejected() {
        return rejected;
    }
}