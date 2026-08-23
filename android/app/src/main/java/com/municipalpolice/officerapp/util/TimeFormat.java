package com.municipalpolice.officerapp.util;

import java.util.concurrent.TimeUnit;

/** Small formatting helpers for the shift timer and "X minutes ago" style labels. */
public final class TimeFormat {

    private TimeFormat() { }

    public static String hms(long millis) {
        long h = TimeUnit.MILLISECONDS.toHours(millis);
        long m = TimeUnit.MILLISECONDS.toMinutes(millis) % 60;
        long s = TimeUnit.MILLISECONDS.toSeconds(millis) % 60;
        return String.format(java.util.Locale.US, "%02d:%02d:%02d", h, m, s);
    }

    public static String minutesAgo(long minutes) {
        return minutes + " min";
    }
}
