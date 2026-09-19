package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;

/** Lifecycle of a single mission, matches the mission states from the backend. */
public enum MissionStatus {

    @SerializedName("new")
    NEW,

    @SerializedName("assigned")
    ASSIGNED,

    @SerializedName("acknowledged")
    ACKNOWLEDGED,

    @SerializedName("in_progress")
    IN_PROGRESS,

    @SerializedName("paused")
    PAUSED,

    @SerializedName("completed")
    COMPLETED,

    @SerializedName("cancelled")
    CANCELLED
}