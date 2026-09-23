package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class PasswordResetRequest {
    @SerializedName("badge_number")
    private final String badgeNumber;
    
    @SerializedName("code")
    private final String supervisorCode;
    
    @SerializedName("new_password")
    private final String newPassword;

    public PasswordResetRequest(String badgeNumber, String supervisorCode, String newPassword) {
        this.badgeNumber = badgeNumber;
        this.supervisorCode = supervisorCode;
        this.newPassword = newPassword;
    }
}
