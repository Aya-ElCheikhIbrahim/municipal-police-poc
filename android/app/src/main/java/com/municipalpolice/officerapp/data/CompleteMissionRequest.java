package com.municipalpolice.officerapp.data;

public class CompleteMissionRequest {
    private Double latitude;
    private Double longitude;
    private String notes;

    public CompleteMissionRequest(Double latitude, Double longitude, String notes) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.notes = notes;
    }
}
