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

    public static String relativeTime(String isoString) {
        if (isoString == null) return "";
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US);
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.util.Date date = sdf.parse(isoString);
            if (date == null) return "";

            long now = System.currentTimeMillis();
            long time = date.getTime();
            return android.text.format.DateUtils.getRelativeTimeSpanString(time, now, android.text.format.DateUtils.MINUTE_IN_MILLIS).toString();
        } catch (Exception e) {
            return "";
        }
    }
}
