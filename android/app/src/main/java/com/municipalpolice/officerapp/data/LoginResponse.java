package com.municipalpolice.officerapp.data;

import com.google.gson.annotations.SerializedName;

public class LoginResponse {
    @SerializedName("access")
    private String accessToken;

    @SerializedName("refresh")
    private String refreshToken;

    @SerializedName("user")
    private UserData user;

    public String getAccessToken() { return accessToken; }
    public String getRefreshToken() { return refreshToken; }
    public UserData getUser() { return user; }

    public static class UserData {
        private String id;
        @SerializedName("full_name")
        private String fullName;
        @SerializedName("badge_number")
        private String badgeNumber;
        private String role;
        @SerializedName("preferred_language")
        private String preferredLanguage;

        public String getId() { return id; }
        public String getFullName() { return fullName; }
        public String getBadgeNumber() { return badgeNumber; }
        public String getRole() { return role; }
        public String getPreferredLanguage() { return preferredLanguage; }
    }
}
