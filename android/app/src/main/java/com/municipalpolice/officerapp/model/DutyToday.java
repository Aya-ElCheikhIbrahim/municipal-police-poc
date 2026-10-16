package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;

/**
 * GET /api/v1/shifts/today/ — the officer's own duty total for today,
 * summed across every shift (stint) they worked.
 */
public class DutyToday {
    private String date;
    @SerializedName("duty_seconds_today")
    private long dutySecondsToday;
    @SerializedName("target_seconds")
    private long targetSeconds;
    @SerializedName("active_shift_started_at")
    private String activeShiftStartedAt;
    @SerializedName("active_shift_seconds")
    private long activeShiftSeconds;

    public String getDate() { return date; }
    public long getDutySecondsToday() { return dutySecondsToday; }
    public long getTargetSeconds() { return targetSeconds; }
    public String getActiveShiftStartedAt() { return activeShiftStartedAt; }
    public long getActiveShiftSeconds() { return activeShiftSeconds; }

    public boolean isOnShift() { return activeShiftStartedAt != null; }
}
