package com.municipalpolice.officerapp.notifications;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.DeviceTokenManager;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;

public class OfficerFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "FCM";

    private static final String CHANNEL_ID =
            "mission_notifications";

    private static final String CHANNEL_NAME =
            "Mission Notifications";

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
        String body =
                "You have been assigned a new mission.";

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
        // READ MISSION ID FROM FCM DATA
        // -----------------------------------------------------

        String missionId =
                remoteMessage
                        .getData()
                        .get("mission_id");

        Log.d(
                TAG,
                "Mission ID: " + missionId
        );

        // -----------------------------------------------------
        // SHOW ANDROID NOTIFICATION
        // -----------------------------------------------------

        showNotification(
                title,
                body,
                missionId
        );
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

        /*
         * Send the new token to the Django backend.
         *
         * DeviceTokenManager uses our authenticated
         * RetrofitClient.
         */
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
            String body,
            String missionId
    ) {

        createNotificationChannel();

        // When the officer taps the notification,
        // open the mission list.
        Intent intent =
                new Intent(
                        this,
                        MissionListActivity.class
                );

        intent.addFlags(
                Intent.FLAG_ACTIVITY_CLEAR_TOP
        );

        // Pass mission ID to the activity.
        if (missionId != null
                && !missionId.isEmpty()) {

            intent.putExtra(
                    "mission_id",
                    missionId
            );
        }

        PendingIntent pendingIntent =
                PendingIntent.getActivity(
                        this,
                        0,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT
                                | PendingIntent.FLAG_IMMUTABLE
                );

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(
                        this,
                        CHANNEL_ID
                )
                        .setSmallIcon(
                                R.mipmap.ic_launcher
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

    // =========================================================
    // NOTIFICATION CHANNEL
    // =========================================================

    private void createNotificationChannel() {

        if (Build.VERSION.SDK_INT
                >= Build.VERSION_CODES.O) {

            NotificationChannel channel =
                    new NotificationChannel(
                            CHANNEL_ID,
                            CHANNEL_NAME,
                            NotificationManager.IMPORTANCE_HIGH
                    );

            channel.setDescription(
                    "Notifications for newly assigned missions"
            );

            NotificationManager manager =
                    getSystemService(
                            NotificationManager.class
                    );

            if (manager != null) {
                manager.createNotificationChannel(
                        channel
                );
            }
        }
    }
}