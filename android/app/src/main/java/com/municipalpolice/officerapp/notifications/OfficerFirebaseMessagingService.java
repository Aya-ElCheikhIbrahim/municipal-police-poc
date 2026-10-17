package com.municipalpolice.officerapp.notifications;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.DeviceTokenManager;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.ui.panic.PanicDetailActivity;
import com.municipalpolice.officerapp.util.NotificationHelper;

import java.util.Map;

public class OfficerFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FCM";

    // =========================================================
    // RECEIVE FCM MESSAGE
    // =========================================================

    @Override
    public void onMessageReceived(
            @NonNull RemoteMessage remoteMessage
    ) {

        super.onMessageReceived(remoteMessage);

        Log.d(TAG, "FCM message received");

        String title = "New Mission Assigned";
        String body = "You have been assigned a new mission.";

        // Check if message contains data payload for Panic Alert
        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            String type = data.get("type");
            if ("panic".equals(type) || data.containsKey("panic_id")) {
                handlePanicPush(data);
                return;
            }
        }

        // -----------------------------------------------------
        // READ NOTIFICATION TITLE / BODY
        // -----------------------------------------------------

        if (remoteMessage.getNotification() != null) {

            if (remoteMessage
                    .getNotification()
                    .getTitle() != null) {

                title = remoteMessage
                        .getNotification()
                        .getTitle();
            }

            if (remoteMessage
                    .getNotification()
                    .getBody() != null) {

                body = remoteMessage
                        .getNotification()
                        .getBody();
            }
        }

        // -----------------------------------------------------
        // SHOW ANDROID NOTIFICATION
        // -----------------------------------------------------

        showNotification(
                title,
                body
        );
    }

    private void handlePanicPush(Map<String, String> data) {
        String officerName = data.get("officer_name");
        if (officerName == null) officerName = data.get("name");
        if (officerName == null) officerName = "Officer";

        String officerPhone = data.get("officer_phone");
        if (officerPhone == null) officerPhone = data.get("phone");
        if (officerPhone == null) officerPhone = "N/A";

        int panicId = -1;
        try {
            String idStr = data.get("panic_id");
            if (idStr != null) panicId = Integer.parseInt(idStr);
        } catch (Exception ignored) {}

        double lat = 0.0;
        try {
            String latStr = data.get("lat");
            if (latStr == null) latStr = data.get("latitude");
            if (latStr != null) lat = Double.parseDouble(latStr);
        } catch (Exception ignored) {}

        double lon = 0.0;
        try {
            String lonStr = data.get("lon");
            if (lonStr == null) lonStr = data.get("longitude");
            if (lonStr != null) lon = Double.parseDouble(lonStr);
        } catch (Exception ignored) {}

        String title = "🚨 USER IN PANIC: " + officerName;
        String body = "Tap to view live location and officer details.";

        Intent intent = new Intent(this, PanicDetailActivity.class);
        intent.putExtra(PanicDetailActivity.EXTRA_PANIC_ID, panicId);
        intent.putExtra(PanicDetailActivity.EXTRA_USER_NAME, officerName);
        intent.putExtra(PanicDetailActivity.EXTRA_USER_PHONE, officerPhone);
        intent.putExtra(PanicDetailActivity.EXTRA_LAT, lat);
        intent.putExtra(PanicDetailActivity.EXTRA_LON, lon);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);

        PendingIntent pendingIntent =
                PendingIntent.getActivity(
                        this,
                        NotificationHelper.REQUEST_CODE_PANIC_PUSH,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT
                                | PendingIntent.FLAG_IMMUTABLE
                );

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(
                        this,
                        NotificationHelper.CHANNEL_ID_PANIC
                )
                        .setSmallIcon(R.drawable.ic_warning)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent);

        NotificationManager manager =
                (NotificationManager)
                        getSystemService(
                                Context.NOTIFICATION_SERVICE
                        );

        if (manager != null) {
            manager.notify((int) System.currentTimeMillis(), builder.build());
        }
    }

    // =========================================================
    // FIREBASE TOKEN CREATED / REFRESHED
    // =========================================================

    @Override
    public void onNewToken(
            @NonNull String token
    ) {

        super.onNewToken(token);

        Log.d(
                TAG,
                "New FCM token generated"
        );

        DeviceTokenManager.registerToken(
                getApplicationContext(),
                token
        );
    }

    // =========================================================
    // SHOW NOTIFICATION
    // =========================================================

    private void showNotification(
            String title,
            String body
    ) {
        Intent intent =
                new Intent(
                        this,
                        MissionListActivity.class
                );

        intent.addFlags(
                Intent.FLAG_ACTIVITY_CLEAR_TOP
        );

        PendingIntent pendingIntent =
                PendingIntent.getActivity(
                        this,
                        NotificationHelper.REQUEST_CODE_MISSION_PUSH,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT
                                | PendingIntent.FLAG_IMMUTABLE
                );

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(
                        this,
                        NotificationHelper.CHANNEL_ID_MISSIONS_PUSH
                )
                        .setSmallIcon(
                                R.drawable.ic_shield
                        )
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(
                                NotificationCompat.PRIORITY_HIGH
                        )
                        .setAutoCancel(true)
                        .setContentIntent(
                                pendingIntent
                        );

        NotificationManager manager =
                (NotificationManager)
                        getSystemService(
                                Context.NOTIFICATION_SERVICE
                        );

        manager.notify(
                (int) System.currentTimeMillis(),
                builder.build()
        );
    }
}
