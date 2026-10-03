package com.municipalpolice.officerapp.service;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.RealLocationTracker;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.util.NotificationHelper;
import com.municipalpolice.officerapp.util.PrefsManager;

public class LocationService extends Service {

    private static final int NOTIFICATION_ID = 1001;

    private RealLocationTracker locationTracker;
    private PrefsManager prefs;

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new PrefsManager(this);
        locationTracker = new RealLocationTracker(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = createNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        /*
         * No shift, e.g. a sticky restart after it ended: stop. This runs after
         * startForeground() on purpose; a service started with
         * startForegroundService() that stops before calling it crashes the app.
         */
        if (!prefs.isShiftActive()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        locationTracker.startTracking("shift");

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (locationTracker != null) {
            locationTracker.stopTracking();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MissionListActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, NotificationHelper.CHANNEL_ID_LOCATION)
                .setContentTitle(getString(R.string.notification_location_title))
                .setContentText(getString(R.string.notification_location_text))
                .setSmallIcon(R.drawable.ic_shield)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }
}
