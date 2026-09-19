package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class TokenRefreshResponse {

    @SerializedName("access")
    private String access;

    public String getAccess() {
        return access;
    }
}