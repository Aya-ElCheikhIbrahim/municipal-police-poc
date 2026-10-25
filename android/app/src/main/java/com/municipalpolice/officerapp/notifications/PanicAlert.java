package com.municipalpolice.officerapp.notifications;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;

import com.municipalpolice.officerapp.ui.login.LoginActivity;
import com.municipalpolice.officerapp.ui.panic.PanicDetailActivity;

import java.util.Map;

/**
 * One nearby-panic alert, and the only place that turns it into an intent.
 *
 * The push reaches the app two ways. With the app in the foreground,
 * onMessageReceived gets the data map. With it backgrounded or killed,
 * Android's FCM SDK shows the notification itself, onMessageReceived never
 * runs, and the same data arrives as extras on the launcher intent when the
 * officer taps it. Both go through parse() with the same keys, and both open
 * the screen through detailIntent().
 */
public final class PanicAlert {

    // The push data keys, as sent by notify_nearby_officers_of_panic in
    // backend/notifications/services.py. FCM data values are always strings.
    static final String KEY_PANIC_ID = "panic_id";
    static final String KEY_OFFICER_NAME = "officer_name";
    static final String KEY_OFFICER_PHONE = "officer_phone";
    static final String KEY_LATITUDE = "latitude";
    static final String KEY_LONGITUDE = "longitude";

    public final int panicId;
    @Nullable public final String officerName;
    @Nullable public final String officerPhone;
    // 0,0 means "no position"; PanicDetailActivity treats it the same way.
    public final double latitude;
    public final double longitude;

    public PanicAlert(int panicId, @Nullable String officerName, @Nullable String officerPhone,
                      double latitude, double longitude) {
        this.panicId = panicId;
        this.officerName = officerName;
        this.officerPhone = officerPhone;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    /** From onMessageReceived. Null if this is not a panic push. */
    @Nullable
    public static PanicAlert fromPushData(@Nullable Map<String, String> data) {
        return data == null ? null : parse(data::get);
    }

    /** From an activity's launch intent. Null if it carries no panic. */
    @Nullable
    public static PanicAlert fromExtras(@Nullable Bundle extras) {
        return extras == null ? null : parse(extras::getString);
    }

    private interface Lookup {
        @Nullable String get(String key);
    }

    @Nullable
    private static PanicAlert parse(Lookup data) {
        int panicId;
        try {
            String idStr = data.get(KEY_PANIC_ID);
            if (idStr == null) return null;
            panicId = Integer.parseInt(idStr.trim());
        } catch (NumberFormatException e) {
            return null;
        }
        // Without an id there is nothing to poll and nothing to clear later.
        if (panicId <= 0) return null;

        String name = data.get(KEY_OFFICER_NAME);
        if (name != null && name.trim().isEmpty()) name = null;

        return new PanicAlert(
                panicId,
                name,
                data.get(KEY_OFFICER_PHONE),
                parseCoordinate(data.get(KEY_LATITUDE)),
                parseCoordinate(data.get(KEY_LONGITUDE)));
    }

    private static double parseCoordinate(@Nullable String value) {
        if (value == null) return 0.0;
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    /** The panic screen for this alert. Callers outside an activity add FLAG_ACTIVITY_NEW_TASK. */
    public Intent detailIntent(Context context) {
        Intent intent = new Intent(context, PanicDetailActivity.class);
        intent.putExtra(PanicDetailActivity.EXTRA_PANIC_ID, panicId);
        intent.putExtra(PanicDetailActivity.EXTRA_USER_NAME, officerName);
        intent.putExtra(PanicDetailActivity.EXTRA_USER_PHONE, officerPhone);
        intent.putExtra(PanicDetailActivity.EXTRA_LAT, latitude);
        intent.putExtra(PanicDetailActivity.EXTRA_LON, longitude);
        return intent;
    }

    /**
     * The login screen on a fresh task, carrying this alert in the same shape
     * the FCM SDK puts on the launcher intent, so LoginActivity reads it with
     * fromExtras() and opens the panic screen once the officer has logged in.
     */
    public Intent loginIntent(Context context) {
        Intent intent = new Intent(context, LoginActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        intent.putExtras(toPushExtras());
        return intent;
    }

    private Bundle toPushExtras() {
        Bundle extras = new Bundle();
        extras.putString(KEY_PANIC_ID, Integer.toString(panicId));
        extras.putString(KEY_OFFICER_NAME, officerName);
        extras.putString(KEY_OFFICER_PHONE, officerPhone);
        extras.putString(KEY_LATITUDE, Double.toString(latitude));
        extras.putString(KEY_LONGITUDE, Double.toString(longitude));
        return extras;
    }
}
