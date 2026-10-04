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
import com.municipalpolice.officerapp.util.NotificationHelper;

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
        // SHOW ANDROID NOTIFICATION
        // -----------------------------------------------------

        showNotification(
                title,
                body
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
            String body
    ) {

        // The channel is created at app start by
        // NotificationHelper.createNotificationChannels().

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