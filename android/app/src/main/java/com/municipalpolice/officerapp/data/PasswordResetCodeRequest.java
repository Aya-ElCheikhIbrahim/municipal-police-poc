package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class PasswordResetCodeRequest {
    @SerializedName("badge_number")
    private final String badgeNumber;

    public PasswordResetCodeRequest(String badgeNumber) {
        this.badgeNumber = badgeNumber;
    }
}
