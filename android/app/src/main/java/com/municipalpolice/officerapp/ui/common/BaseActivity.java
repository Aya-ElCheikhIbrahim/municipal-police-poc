package com.municipalpolice.officerapp.ui.common;

import android.content.Context;

import androidx.appcompat.app.AppCompatActivity;

import com.municipalpolice.officerapp.util.LocaleHelper;

/**
 * Every screen extends this so the officer's saved language (set from
 * Settings) is applied consistently, including layout direction for Arabic.
 */
public abstract class BaseActivity extends AppCompatActivity {

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(LocaleHelper.wrap(newBase));
    }
}
