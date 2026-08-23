package com.municipalpolice.officerapp.util;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Build;

import java.util.Locale;

/**
 * Applies the officer's chosen app language (English or Arabic) regardless
 * of the device's system language, and keeps layout direction (LTR/RTL) in
 * sync automatically since android:supportsRtl="true" is set in the manifest.
 *
 * Usage: every Activity calls LocaleHelper.wrap(base) from attachBaseContext
 * (see ui.common.BaseActivity) so the saved language always applies.
 */
public final class LocaleHelper {

    public static final String LANG_ENGLISH = "en";
    public static final String LANG_ARABIC = "ar";

    private LocaleHelper() { }

    public static Context wrap(Context context) {
        String lang = new PrefsManager(context).getLanguage(LANG_ENGLISH);
        return applyLocale(context, lang);
    }

    public static void setAppLanguage(Context context, String languageCode) {
        new PrefsManager(context).setLanguage(languageCode);
    }

    public static String getAppLanguage(Context context) {
        return new PrefsManager(context).getLanguage(LANG_ENGLISH);
    }

    private static Context applyLocale(Context context, String languageCode) {
        Locale locale = new Locale(languageCode);
        Locale.setDefault(locale);

        Configuration config = new Configuration(context.getResources().getConfiguration());
        config.setLocale(locale);
        config.setLayoutDirection(locale);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            return context.createConfigurationContext(config);
        } else {
            context.getResources().updateConfiguration(config, context.getResources().getDisplayMetrics());
            return context;
        }
    }
}
