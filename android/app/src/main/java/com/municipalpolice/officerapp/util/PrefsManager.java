package com.municipalpolice.officerapp.util;

import android.content.Context;
import android.content.SharedPreferences;

/** Tiny wrapper around SharedPreferences for the handful of local settings this app needs. */
public class PrefsManager {

    private static final String PREFS_NAME = "officer_app_prefs";
    private static final String KEY_LANGUAGE = "language";
    private static final String KEY_LOGGED_IN = "logged_in";

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
        prefs.edit().putBoolean(KEY_LOGGED_IN, loggedIn).apply();
    }
}
