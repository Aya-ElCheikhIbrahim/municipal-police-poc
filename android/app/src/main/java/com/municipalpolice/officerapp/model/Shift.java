package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class Shift implements Serializable {
    private int id;
    private String status;
    @SerializedName("started_at")
    private String startedAt;
    @SerializedName("ended_at")
    private String endedAt;
    @SerializedName("duration_seconds")
    private int durationSeconds;
    @SerializedName("start_latitude")
    private Double startLatitude;
    @SerializedName("start_longitude")
    private Double startLongitude;
    @SerializedName("end_latitude")
    private Double endLatitude;
    @SerializedName("end_longitude")
    private Double endLongitude;

    public int getId() { return id; }
    public String getStatus() { return status; }
    public String getStartedAt() { return startedAt; }
    public String getEndedAt() { return endedAt; }
    public int getDurationSeconds() { return durationSeconds; }
    public Double getStartLatitude() { return startLatitude; }
    public Double getStartLongitude() { return startLongitude; }
    public Double getEndLatitude() { return endLatitude; }
    public Double getEndLongitude() { return endLongitude; }
}
