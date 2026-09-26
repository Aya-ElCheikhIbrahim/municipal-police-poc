package com.municipalpolice.officerapp.util;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;

public class NotificationHelper {

    public static final String CHANNEL_ID_MISSIONS = "missions_channel";
    public static final String CHANNEL_ID_PANIC = "panic_channel";

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Missions Channel
            NotificationChannel missionsChannel = new NotificationChannel(
                    CHANNEL_ID_MISSIONS,
                    "Missions",
                    NotificationManager.IMPORTANCE_HIGH
            );
            missionsChannel.setDescription("Notifications for new assigned missions");

            // Panic Channel
            NotificationChannel panicChannel = new NotificationChannel(
                    CHANNEL_ID_PANIC,
                    "Panic Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            panicChannel.setDescription("Alerts related to panic button activations");

            manager.createNotificationChannel(missionsChannel);
            manager.createNotificationChannel(panicChannel);
        }
    }

    public static void showNewMissionNotification(Context context, String title, String body) {
        Intent intent = new Intent(context, MissionListActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, 
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID_MISSIONS)
                .setSmallIcon(R.drawable.ic_shield)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        try {
            notificationManager.notify((int) System.currentTimeMillis(), builder.build());
        } catch (SecurityException e) {
            // Log or handle missing permission (POST_NOTIFICATIONS on Android 13+)
        }
    }
}
