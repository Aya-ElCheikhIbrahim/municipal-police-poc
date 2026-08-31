package com.municipalpolice.officerapp.data;

public class PositionRequest {
    private Double latitude;
    private Double longitude;

    public PositionRequest(Double latitude, Double longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }
}
