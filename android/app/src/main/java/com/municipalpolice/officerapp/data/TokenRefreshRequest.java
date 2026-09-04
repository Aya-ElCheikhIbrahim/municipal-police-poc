package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class TokenRefreshRequest {

    @SerializedName("refresh")
    private final String refresh;

    public TokenRefreshRequest(String refresh) {
        this.refresh = refresh;
    }

    public String getRefresh() {
        return refresh;
    }
}