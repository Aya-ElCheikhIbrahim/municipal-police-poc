package com.municipalpolice.officerapp.util;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
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
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date date = sdf.parse(isoString);
            if (date == null) return "";

            long now = System.currentTimeMillis();
            long time = date.getTime();
            String rel = android.text.format.DateUtils.getRelativeTimeSpanString(time, now, android.text.format.DateUtils.MINUTE_IN_MILLIS).toString();
            return rel.replace(" minutes", " min").replace(" minute", " min");
        } catch (Exception e) {
            return "";
        }
    }
}
