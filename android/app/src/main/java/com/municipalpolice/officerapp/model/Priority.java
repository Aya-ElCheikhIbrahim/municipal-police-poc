package com.municipalpolice.officerapp.model;

import com.google.gson.annotations.SerializedName;

public enum Priority {
    @SerializedName("low")
    LOW,
    @SerializedName("medium")
    MEDIUM,
    @SerializedName("high")
    HIGH,
    @SerializedName("urgent")
    URGENT
}
