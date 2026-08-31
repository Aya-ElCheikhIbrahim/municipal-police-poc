package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;

public class MissionPhoto implements Serializable {
    @SerializedName("client_uuid")
    private String clientUuid;
    private String image;
    @SerializedName("captured_latitude")
    private Double capturedLatitude;
    @SerializedName("captured_longitude")
    private Double capturedLongitude;
    @SerializedName("captured_at")
    private String capturedAt;
    @SerializedName("uploaded_at")
    private String uploadedAt;

    public String getClientUuid() { return clientUuid; }
    public String getImage() { return image; }
    public Double getCapturedLatitude() { return capturedLatitude; }
    public Double getCapturedLongitude() { return capturedLongitude; }
    public String getCapturedAt() { return capturedAt; }
    public String getUploadedAt() { return uploadedAt; }
}
