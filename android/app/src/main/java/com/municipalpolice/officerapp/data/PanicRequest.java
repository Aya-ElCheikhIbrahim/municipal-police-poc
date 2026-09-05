package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class PanicRequest {
    private final Double latitude;
    private final Double longitude;
    private final String username;
    @SerializedName("full_name")
    private final String fullName;
    @SerializedName("badge_number")
    private final String badgeNumber;

    public PanicRequest(Double latitude, Double longitude, String username, String fullName, String badgeNumber) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.username = username;
        this.fullName = fullName;
        this.badgeNumber = badgeNumber;
    }
}
