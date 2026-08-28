package com.municipalpolice.officerapp.data.api;

import com.google.gson.annotations.SerializedName;

public class LoginResponse {
    public String access;
    public String refresh;
    public UserData user;

    public static class UserData {
        public String id;
        @SerializedName("full_name")
        public String fullName;
        @SerializedName("badge_number")
        public String badgeNumber;
        public String role;
        @SerializedName("preferred_language")
        public String preferredLanguage;
    }
}
