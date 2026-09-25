package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

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


    // ---------------------------------------------------------
    // TIMER FIELDS
    // ---------------------------------------------------------

    /*
     * Existing backend timer fields.
     * These may be available in mission-detail responses.
     */
    @SerializedName("worked_seconds")
    private long workedSeconds;

    @SerializedName("resumed_at")
    private String resumedAt;

    /*
     * IMPORTANT:
     *
     * MissionListSerializer sends duration_seconds.
     *
     * This is the timer value currently returned by the
     * Missions list API.
     */
    @SerializedName("duration_seconds")
    private long durationSeconds;


    // ---------------------------------------------------------
    // START / COMPLETE LOCATION
    // ---------------------------------------------------------

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


    @SerializedName("photos")
    private List<MissionPhoto> photos =
            new ArrayList<>();

    private static final int REQUIRED_PHOTOS = 1;


    public Mission(
            int id,
            String title,
            String description,
            Priority priority,
            MissionStatus status,
            Double latitude,
            Double longitude,
            String address
    ) {

        this.id = id;
        this.title = title;
        this.description = description;
        this.priority = priority;
        this.status = status;
        this.latitude = latitude;
        this.longitude = longitude;
        this.address = address;
    }


    // ---------------------------------------------------------
    // LOCATION
    // ---------------------------------------------------------

    public String getLocationDisplay() {

        if (address != null &&
                !address.trim().isEmpty()) {

            return address;
        }


        if (latitude != null &&
                longitude != null) {

            return String.format(
                    Locale.US,
                    "%.4f, %.4f",
                    latitude,
                    longitude
            );
        }


        return "No location";
    }


    // ---------------------------------------------------------
    // BASIC MISSION DATA
    // ---------------------------------------------------------

    public int getId() {
        return id;
    }


    public String getTitle() {
        return title;
    }


    public String getDescription() {
        return description;
    }


    public Priority getPriority() {
        return priority;
    }


    public MissionStatus getStatus() {
        return status;
    }


    public void setStatus(
            MissionStatus status
    ) {
        this.status = status;
    }


    public Double getLatitude() {
        return latitude;
    }


    public Double getLongitude() {
        return longitude;
    }


    public String getAddress() {
        return address;
    }


    public Integer getAssignedToId() {
        return assignedToId;
    }


    // ---------------------------------------------------------
    // MISSION TIMES
    // ---------------------------------------------------------

    public String getCreatedAt() {
        return createdAt;
    }


    public String getAssignedAt() {
        return assignedAt;
    }


    public String getAcknowledgedAt() {
        return acknowledgedAt;
    }


    public void setAcknowledgedAt(
            String acknowledgedAt
    ) {
        this.acknowledgedAt = acknowledgedAt;
    }


    public String getStartedAt() {
        return startedAt;
    }


    public void setStartedAt(
            String startedAt
    ) {
        this.startedAt = startedAt;
    }


    public String getCompletedAt() {
        return completedAt;
    }


    public void setCompletedAt(
            String completedAt
    ) {
        this.completedAt = completedAt;
    }


    public String getCancelledAt() {
        return cancelledAt;
    }


    // ---------------------------------------------------------
    // WORK TIMER
    // ---------------------------------------------------------

    public long getWorkedSeconds() {
        return workedSeconds;
    }


    public void setWorkedSeconds(
            long workedSeconds
    ) {
        this.workedSeconds = workedSeconds;
    }


    public String getResumedAt() {
        return resumedAt;
    }


    public void setResumedAt(
            String resumedAt
    ) {
        this.resumedAt = resumedAt;
    }


    /*
     * Timer value returned by MissionListSerializer.
     */
    public long getDurationSeconds() {
        return durationSeconds;
    }


    public void setDurationSeconds(
            long durationSeconds
    ) {
        this.durationSeconds = durationSeconds;
    }


    // ---------------------------------------------------------
    // START / COMPLETE LOCATION
    // ---------------------------------------------------------

    public Double getStartedLatitude() {
        return startedLatitude;
    }


    public Double getStartedLongitude() {
        return startedLongitude;
    }


    public Double getCompletedLatitude() {
        return completedLatitude;
    }


    public Double getCompletedLongitude() {
        return completedLongitude;
    }


    // ---------------------------------------------------------
    // NOTES / CANCELLATION
    // ---------------------------------------------------------

    public String getNotes() {
        return notes;
    }


    public String getCancellationReason() {
        return cancellationReason;
    }


    // ---------------------------------------------------------
    // PHOTOS
    // ---------------------------------------------------------

    public List<MissionPhoto> getPhotos() {
        return photos;
    }

    public void setPhotos(List<MissionPhoto> photos) {
        if (photos != null) {
            this.photos = photos;
        }
    }

    public void addPhoto(MissionPhoto photo) {
        if (this.photos == null) {
            this.photos = new ArrayList<>();
        }
        if (photo != null) {
            this.photos.add(photo);
        }
    }


    public int getRequiredPhotoCount() {
        return REQUIRED_PHOTOS;
    }


    public boolean hasMinimumPhotos() {

        return photos != null &&
                photos.size() >= REQUIRED_PHOTOS;
    }
}

