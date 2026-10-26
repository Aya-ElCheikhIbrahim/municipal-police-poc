package com.municipalpolice.officerapp.notifications;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.municipalpolice.officerapp.data.PanicApiService;
import com.municipalpolice.officerapp.data.RetrofitClient;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.io.IOException;

import retrofit2.Response;

/**
 * Every 15 minutes while an alert is held, ask whether it is still live.
 * On 404, clear it: without this, an alert that ends while the app stays
 * closed leaves its ongoing notification up until the officer happens to open
 * the app. On a successful answer, re-post the notification if it is gone
 * (reboot, or swiped away on Android 14+). WorkManager reschedules itself
 * after a reboot, so no boot receiver is needed.
 *
 * Calls the API service synchronously rather than through PanicRepository,
 * whose callbacks are asynchronous: a Worker has to finish its work inside
 * doWork().
 */
public class ActivePanicCheckWorker extends Worker {

    private static final String TAG = "ActivePanicCheck";

    public ActivePanicCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context app = getApplicationContext();
        PanicAlert held = ActivePanic.current(app);
        if (held == null) return Result.success();

        // Logged out (session expired): a request would only 401. Keep the
        // alert; the officer gets it back after logging in, and checkOnResume
        // runs then.
        if (!new PrefsManager(app).isLoggedIn()) return Result.success();

        try {
            Response<?> response = RetrofitClient.getClient(app)
                    .create(PanicApiService.class)
                    .getPanicLocation(held.panicId)
                    .execute();
            if (response.code() == 404) {
                ActivePanic.forget(app, held.panicId);
            } else if (response.isSuccessful()) {
                // Only a real answer counts as "still live". A 5xx says
                // nothing about the incident, and reviving a notification
                // for an alert that may have ended is the worse mistake.
                ActivePanic.restoreNotificationIfMissing(app, held.panicId);
            }
        } catch (IOException e) {
            // Offline; the next period tries again.
            Log.w(TAG, "Active panic check failed", e);
        }
        return Result.success();
    }
}
