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
    public void setClientUuid(String clientUuid) { this.clientUuid = clientUuid; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public Double getCapturedLatitude() { return capturedLatitude; }
    public void setCapturedLatitude(Double capturedLatitude) { this.capturedLatitude = capturedLatitude; }

    public Double getCapturedLongitude() { return capturedLongitude; }
    public void setCapturedLongitude(Double capturedLongitude) { this.capturedLongitude = capturedLongitude; }

    public String getCapturedAt() { return capturedAt; }
    public void setCapturedAt(String capturedAt) { this.capturedAt = capturedAt; }

    public String getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(String uploadedAt) { this.uploadedAt = uploadedAt; }
}
