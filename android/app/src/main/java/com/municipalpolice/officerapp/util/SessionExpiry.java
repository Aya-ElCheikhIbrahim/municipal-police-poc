package com.municipalpolice.officerapp.util;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import com.municipalpolice.officerapp.ui.login.LoginActivity;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Sends the officer back to the login screen once the session can no longer
 * be refreshed (the backend rejected a refresh token the app still believed
 * was current).
 */
public final class SessionExpiry {

    public static final String EXTRA_SESSION_EXPIRED = "session_expired";

    /*
     * Several requests can 401 at once when the session dies; only the
     * first one redirects.
     */
    private static final AtomicBoolean redirected = new AtomicBoolean(false);

    private SessionExpiry() {}

    /**
     * Safe to call from any thread. Pass the application context, never an
     * Activity.
     *
     * Android 10+ silently drops activity starts while the app is in the
     * background. BaseActivity.onResume() catches that case when the officer
     * comes back to the app.
     */
    public static void onSessionExpired(Context appContext) {
        if (!redirected.compareAndSet(false, true)) {
            return;
        }

        new Handler(Looper.getMainLooper()).post(() ->
                appContext.startActivity(loginIntent(appContext))
        );
    }

    /** Called by LoginActivity after a successful login. */
    public static void reset() {
        redirected.set(false);
    }

    /** Login screen on a fresh task, telling it the session expired. */
    public static Intent loginIntent(Context context) {
        Intent intent = new Intent(context, LoginActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        intent.putExtra(EXTRA_SESSION_EXPIRED, true);
        return intent;
    }
}
