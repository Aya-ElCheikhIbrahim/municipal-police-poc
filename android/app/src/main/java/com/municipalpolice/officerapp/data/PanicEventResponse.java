package com.municipalpolice.officerapp.data;

public class PanicEventResponse {
    private int id;
    private int shift;
    private String status;
    private String latitude;
    private String longitude;
    private Float accuracy_m;
    private Integer battery_level;
    private String triggered_at;

    public int getId() {
        return id;
    }

    public int getShift() {
        return shift;
    }

    public String getStatus() {
        return status;
    }

    public String getLatitude() {
        return latitude;
    }

    public String getLongitude() {
        return longitude;
    }

    public Float getAccuracy_m() {
        return accuracy_m;
    }

    public Integer getBattery_level() {
        return battery_level;
    }

    public String getTriggeredAt() {
        return triggered_at;
    }
}
