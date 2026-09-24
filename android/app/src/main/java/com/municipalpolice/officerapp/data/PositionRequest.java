package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class PositionRequest {
    @SerializedName("latitude")
    private Double latitude;

    @SerializedName("longitude")
    private Double longitude;

    @SerializedName("accuracy_m")
    private Float accuracy_m;

    @SerializedName("battery_level")
    private Integer battery_level;

    public PositionRequest(Double latitude, Double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public PositionRequest(Double latitude, Double longitude, Float accuracy_m, Integer battery_level) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy_m = accuracy_m;
        this.battery_level = battery_level;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public Float getAccuracy_m() {
        return accuracy_m;
    }

    public Integer getBattery_level() {
        return battery_level;
    }
}
