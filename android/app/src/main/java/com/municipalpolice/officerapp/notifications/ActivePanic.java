package com.municipalpolice.officerapp.notifications;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.PanicEndedException;
import com.municipalpolice.officerapp.data.PanicLocationResponse;
import com.municipalpolice.officerapp.data.RetrofitPanicRepository;
import com.municipalpolice.officerapp.util.NotificationHelper;

import java.util.concurrent.TimeUnit;

/**
 * The nearby-panic alert this phone is currently following, and its ongoing
 * notification, which is the officer's way back to the panic screen.
 *
 * One slot: if several alerts are live at once, the newest one (highest id,
 * since ids are assigned in order) is the one held. An older alert arriving
 * later does not displace it.
 *
 * A notification for an alert that ended is worse than none, so every path
 * that can learn an alert is over clears both the slot and the notification:
 *   - PanicDetailActivity gets the 404 while polling       -> forget(id)
 *   - any screen resumes and the check gets a 404         -> checkOnResume()
 *   - the background check gets a 404 (app not opened)    -> ActivePanicCheckWorker
 *   - the officer logs out                                -> forgetAll()
 *   - a newer alert arrives                               -> replaces it in remember()
 * forget() only clears when the id still matches, so a late 404 for an old
 * alert cannot wipe a newer one.
 *
 * The reverse also holds: when the background check finds the alert still
 * live but its notification gone (reboot, or swiped away on Android 14+), it
 * re-posts it, so the way back lasts as long as the alert does.
 *
 * Kept in its own prefs file rather than PrefsManager: PrefsManager.clear()
 * runs on session expiry too, and an officer whose token expired mid-incident
 * must still find the alert after logging back in.
 */
public final class ActivePanic {

    private static final String TAG = "ActivePanic";

    private static final String PREFS_NAME = "active_panic";
    private static final String KEY_ID = "panic_id";
    private static final String KEY_NAME = "officer_name";
    private static final String KEY_PHONE = "officer_phone";
    private static final String KEY_LAT = "latitude";
    private static final String KEY_LON = "longitude";

    static final String CHECK_WORK_NAME = "active-panic-check";
    // WorkManager's minimum period.
    private static final long CHECK_PERIOD_MINUTES = 15;

    // Every screen's onResume calls checkOnResume(); one request per window is plenty.
    private static final long RESUME_CHECK_MIN_INTERVAL_MS = 30_000;
    private static long lastResumeCheckAt = -RESUME_CHECK_MIN_INTERVAL_MS;

    private ActivePanic() {}

    /**
     * Hold this alert and keep its notification in the shade.
     *
     * @param makeNoise true for a push that just arrived; false when the
     *                  officer is already looking (they tapped the system's
     *                  notification to get here), so the re-post is silent.
     */
    public static synchronized void remember(Context context, PanicAlert alert, boolean makeNoise) {
        Context app = context.getApplicationContext();
        int heldId = prefs(app).getInt(KEY_ID, -1);
        if (heldId > alert.panicId) {
            Log.d(TAG, "Keeping newer alert " + heldId + " over " + alert.panicId);
            return;
        }

        prefs(app).edit()
                .putInt(KEY_ID, alert.panicId)
                .putString(KEY_NAME, alert.officerName)
                .putString(KEY_PHONE, alert.officerPhone)
                .putString(KEY_LAT, Double.toString(alert.latitude))
                .putString(KEY_LON, Double.toString(alert.longitude))
                .commit();

        NotificationHelper.showActivePanicNotification(app, alert, makeNoise);
        scheduleBackgroundCheck(app);
    }

    /** The alert has ended. No-op if a different (newer) alert is held now. */
    public static synchronized void forget(Context context, int panicId) {
        Context app = context.getApplicationContext();
        if (prefs(app).getInt(KEY_ID, -1) != panicId) return;
        Log.d(TAG, "Alert " + panicId + " ended; clearing");
        clear(app);
    }

    /**
     * The backend says the held alert is still live: put its notification
     * back if it is gone. Notifications do not survive a reboot, and Android
     * 14+ lets the officer swipe away even an ongoing one. Silent, since it is
     * a restore and not a new alert. Checked under the same lock as forget(),
     * so an alert cleared meanwhile is not brought back.
     */
    static synchronized void restoreNotificationIfMissing(Context context, int panicId) {
        Context app = context.getApplicationContext();
        PanicAlert held = current(app);
        if (held == null || held.panicId != panicId) return;
        if (NotificationHelper.isActivePanicNotificationShowing(app)) return;
        Log.d(TAG, "Alert " + panicId + " still active; restoring its notification");
        NotificationHelper.showActivePanicNotification(app, held, false);
    }

    /** Logout: whatever is held, this officer is no longer following it. */
    public static synchronized void forgetAll(Context context) {
        clear(context.getApplicationContext());
    }

    @Nullable
    static synchronized PanicAlert current(Context context) {
        SharedPreferences p = prefs(context.getApplicationContext());
        int id = p.getInt(KEY_ID, -1);
        if (id <= 0) return null;
        return new PanicAlert(
                id,
                p.getString(KEY_NAME, null),
                p.getString(KEY_PHONE, null),
                parseDouble(p.getString(KEY_LAT, null)),
                parseDouble(p.getString(KEY_LON, null)));
    }

    /**
     * Ask the backend whether the held alert is still live; clear it on 404.
     * Called from every screen's onResume while logged in. Any other failure
     * keeps it: a dead zone says nothing about the incident.
     */
    public static void checkOnResume(Context context) {
        long now = SystemClock.elapsedRealtime();
        if (now - lastResumeCheckAt < RESUME_CHECK_MIN_INTERVAL_MS) return;

        Context app = context.getApplicationContext();
        PanicAlert held = current(app);
        if (held == null) return;
        lastResumeCheckAt = now;

        new RetrofitPanicRepository(app).getPanicLocation(held.panicId, new Callback<PanicLocationResponse>() {
            @Override
            public void onSuccess(PanicLocationResponse result) {
                // Still live; keep it.
            }

            @Override
            public void onError(Throwable error) {
                if (error instanceof PanicEndedException) {
                    forget(app, held.panicId);
                }
            }
        });
    }

    private static void clear(Context app) {
        prefs(app).edit().clear().commit();
        NotificationHelper.cancelActivePanicNotification(app);
        WorkManager.getInstance(app).cancelUniqueWork(CHECK_WORK_NAME);
    }

    /**
     * Covers the case nothing else does: the alert ends while the app is never
     * opened again, which would otherwise leave the notification up for hours.
     * Cancelled in clear(), so it only runs while an alert is held.
     */
    private static void scheduleBackgroundCheck(Context app) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                ActivePanicCheckWorker.class, CHECK_PERIOD_MINUTES, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build())
                .build();
        // KEEP: the worker reads the held id each run, so a newer alert needs
        // no reschedule.
        WorkManager.getInstance(app).enqueueUniquePeriodicWork(
                CHECK_WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    private static SharedPreferences prefs(Context app) {
        return app.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static double parseDouble(@Nullable String value) {
        if (value == null) return 0.0;
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
