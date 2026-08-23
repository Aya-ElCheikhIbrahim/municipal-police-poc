package com.municipalpolice.officerapp.model;

/** Lifecycle of a single mission, matches the "New / In progress / Completed" tabs. */
public enum MissionStatus {
    NEW,
    ACKNOWLEDGED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED
}
