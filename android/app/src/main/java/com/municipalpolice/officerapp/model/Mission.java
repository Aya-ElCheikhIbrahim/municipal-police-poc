package com.municipalpolice.officerapp.model;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * Plain data holder for a field mission.
 *
 * This intentionally has no framework/backend dependencies so it can later be
 * reused as-is (or mapped 1:1) by a Retrofit/Room layer — see
 * data/MissionRepository.java for where that would plug in.
 */
public class Mission implements Serializable {

    private final String id;
    private String title;
    private String location;
    private String distanceMeters;
    private String assignedBy;
    private Priority priority;
    private MissionStatus status;
    private long assignedAtMillis;
    private long acknowledgedAtMillis;
    private long startedAtMillis;
    private final List<String> photoUris = new ArrayList<>();
    private static final int REQUIRED_PHOTOS = 5;

    public Mission(String id, String title, String location, String distanceMeters,
                    String assignedBy, Priority priority, MissionStatus status,
                    long assignedAtMillis) {
        this.id = id;
        this.title = title;
        this.location = location;
        this.distanceMeters = distanceMeters;
        this.assignedBy = assignedBy;
        this.priority = priority;
        this.status = status;
        this.assignedAtMillis = assignedAtMillis;
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getLocation() { return location; }
    public String getDistanceMeters() { return distanceMeters; }
    public String getAssignedBy() { return assignedBy; }
    public Priority getPriority() { return priority; }
    public MissionStatus getStatus() { return status; }
    public void setStatus(MissionStatus status) { this.status = status; }
    public long getAssignedAtMillis() { return assignedAtMillis; }

    public long getAcknowledgedAtMillis() { return acknowledgedAtMillis; }
    public void setAcknowledgedAtMillis(long t) { this.acknowledgedAtMillis = t; }

    public long getStartedAtMillis() { return startedAtMillis; }
    public void setStartedAtMillis(long t) { this.startedAtMillis = t; }

    public List<String> getPhotoUris() { return photoUris; }
    public void addPhoto(String uri) { photoUris.add(uri); }
    public int getRequiredPhotoCount() { return REQUIRED_PHOTOS; }
    public boolean hasMinimumPhotos() { return !photoUris.isEmpty(); }
}
