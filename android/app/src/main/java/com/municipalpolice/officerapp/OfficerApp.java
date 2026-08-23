package com.municipalpolice.officerapp;

import android.app.Application;
import android.content.Context;

import com.municipalpolice.officerapp.util.LocaleHelper;

public class OfficerApp extends Application {

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(LocaleHelper.wrap(base));
    }

    @Override
    public void onCreate() {
        super.onCreate();
    }
}
