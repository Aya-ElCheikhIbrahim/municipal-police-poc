package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class TokenRefreshResponse {

    @SerializedName("access")
    private String access;

    @SerializedName("refresh")
    private String refresh;

    public String getAccess() {
        return access;
    }

    public String getRefresh() {
        return refresh;
    }
}