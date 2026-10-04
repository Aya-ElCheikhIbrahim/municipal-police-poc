package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class DeviceTokenRequest {

    @SerializedName("token")
    private final String token;

    @SerializedName("platform")
    private final String platform;

    @SerializedName("device_model")
    private final String deviceModel;

    @SerializedName("app_version")
    private final String appVersion;

    public DeviceTokenRequest(
            String token,
            String deviceModel,
            String appVersion
    ) {
        this.token = token;
        this.platform = "android";
        this.deviceModel = deviceModel;
        this.appVersion = appVersion;
    }

    public String getToken() {
        return token;
    }

    public String getPlatform() {
        return platform;
    }

    public String getDeviceModel() {
        return deviceModel;
    }

    public String getAppVersion() {
        return appVersion;
    }
}