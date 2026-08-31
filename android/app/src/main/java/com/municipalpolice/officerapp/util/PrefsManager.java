package com.municipalpolice.officerapp.util;

import android.content.Context;
import android.content.SharedPreferences;

/** Tiny wrapper around SharedPreferences for the handful of local settings this app needs. */
public class PrefsManager {

    private static final String PREFS_NAME = "officer_app_prefs";
    private static final String KEY_LANGUAGE = "language";
    private static final String KEY_LOGGED_IN = "logged_in";
    private static final String KEY_AUTH_TOKEN = "auth_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_USER_FULL_NAME = "user_full_name";
    private static final String KEY_USER_BADGE = "user_badge_number";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_SHIFT_ACTIVE = "shift_active";

    private final SharedPreferences prefs;

    public PrefsManager(Context context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public String getLanguage(String defaultLang) {
        return prefs.getString(KEY_LANGUAGE, defaultLang);
    }

    public void setLanguage(String languageCode) {
        prefs.edit().putString(KEY_LANGUAGE, languageCode).apply();
    }

    public boolean isLoggedIn() {
        return prefs.getBoolean(KEY_LOGGED_IN, false);
    }

    public void setLoggedIn(boolean loggedIn) {
        prefs.edit().putBoolean(KEY_LOGGED_IN, loggedIn).commit();
    }

    public String getAuthToken() {
        return prefs.getString(KEY_AUTH_TOKEN, null);
    }

    public void setAuthToken(String token) {
        prefs.edit().putString(KEY_AUTH_TOKEN, token).commit();
    }

    public String getRefreshToken() {
        return prefs.getString(KEY_REFRESH_TOKEN, null);
    }

    public void setRefreshToken(String token) {
        prefs.edit().putString(KEY_REFRESH_TOKEN, token).commit();
    }

    public void setUserData(String id, String fullName, String badgeNumber) {
        prefs.edit()
            .putString(KEY_USER_ID, id)
            .putString(KEY_USER_FULL_NAME, fullName)
            .putString(KEY_USER_BADGE, badgeNumber)
            .apply();
    }

    public String getUserFullName() {
        return prefs.getString(KEY_USER_FULL_NAME, "");
    }

    public String getUserBadgeNumber() {
        return prefs.getString(KEY_USER_BADGE, "");
    }

    public String getUserId() {
        return prefs.getString(KEY_USER_ID, "");
    }

    public boolean isShiftActive() {
        return prefs.getBoolean(KEY_SHIFT_ACTIVE, false);
    }

    public void setShiftActive(boolean active) {
        prefs.edit().putBoolean(KEY_SHIFT_ACTIVE, active).apply();
    }

    public void clear() {
        prefs.edit().clear().apply();
    }
}
