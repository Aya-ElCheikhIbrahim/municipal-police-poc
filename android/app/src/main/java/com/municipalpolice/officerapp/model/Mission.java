package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * Plain data holder for a field mission.
 */
public class Mission implements Serializable {

    private final int id;
    private String title;
    private String description;
    private Priority priority;
    private MissionStatus status;
    private Double latitude;
    private Double longitude;
    private String address;

    @SerializedName("assigned_to_id")
    private Integer assignedToId;
    
    @SerializedName("created_at")
    private String createdAt;
    @SerializedName("assigned_at")
    private String assignedAt;
    @SerializedName("acknowledged_at")
    private String acknowledgedAt;
    @SerializedName("started_at")
    private String startedAt;
    @SerializedName("completed_at")
    private String completedAt;
    @SerializedName("cancelled_at")
    private String cancelledAt;

    @SerializedName("started_latitude")
    private Double startedLatitude;
    @SerializedName("started_longitude")
    private Double startedLongitude;
    @SerializedName("completed_latitude")
    private Double completedLatitude;
    @SerializedName("completed_longitude")
    private Double completedLongitude;

    private String notes;
    @SerializedName("cancellation_reason")
    private String cancellationReason;

    private final List<MissionPhoto> photos = new ArrayList<>();
    private static final int REQUIRED_PHOTOS = 1;

    public Mission(int id, String title, String description, Priority priority, 
                   MissionStatus status, Double latitude, Double longitude, String address) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.priority = priority;
        this.status = status;
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
    }

    public String getLocationDisplay() {
        if (address != null && !address.trim().isEmpty()) {
            return address;
        }
        if (latitude != null && longitude != null) {
            return String.format(java.util.Locale.US, "%.4f, %.4f", latitude, longitude);
        }
        return "No location";
    }

    public int getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Priority getPriority() { return priority; }
    public MissionStatus getStatus() { return status; }
    public void setStatus(MissionStatus status) { this.status = status; }
    
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public String getAddress() { return address; }

    public Integer getAssignedToId() { return assignedToId; }
    
    public String getCreatedAt() { return createdAt; }
    public String getAssignedAt() { return assignedAt; }
    public String getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(String acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }
    public String getStartedAt() { return startedAt; }
    public void setStartedAt(String startedAt) { this.startedAt = startedAt; }
    public String getCompletedAt() { return completedAt; }
    public void setCompletedAt(String completedAt) { this.completedAt = completedAt; }
    public String getCancelledAt() { return cancelledAt; }

    public Double getStartedLatitude() { return startedLatitude; }
    public Double getStartedLongitude() { return startedLongitude; }
    public Double getCompletedLatitude() { return completedLatitude; }
    public Double getCompletedLongitude() { return completedLongitude; }

    public String getNotes() { return notes; }
    public String getCancellationReason() { return cancellationReason; }

    public List<MissionPhoto> getPhotos() { return photos; }
    public int getRequiredPhotoCount() { return REQUIRED_PHOTOS; }
    public boolean hasMinimumPhotos() { return !photos.isEmpty(); }
}
