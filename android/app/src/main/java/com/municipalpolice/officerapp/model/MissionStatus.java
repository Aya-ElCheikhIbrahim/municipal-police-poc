package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;

/** Lifecycle of a single mission, matches the "New / In progress / Completed" tabs. */
public enum MissionStatus {
    @SerializedName("new")
    NEW,
    @SerializedName("assigned")
    ASSIGNED,
    @SerializedName("acknowledged")
    ACKNOWLEDGED,
    @SerializedName("in_progress")
    IN_PROGRESS,
    @SerializedName("completed")
    COMPLETED,
    @SerializedName("cancelled")
    CANCELLED
}
