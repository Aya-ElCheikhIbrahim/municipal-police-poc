package com.municipalpolice.officerapp.data;

public class EndShiftRequest {
    private Double latitude;
    private Double longitude;
    private String refresh;

    public EndShiftRequest(Double latitude, Double longitude, String refresh) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.refresh = refresh;
    }
}
