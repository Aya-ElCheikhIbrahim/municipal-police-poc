package com.municipalpolice.officerapp.data;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

/**
 * Local Room database used for offline work.
 *
 * For now it stores queued location pings.
 * Later we can also add queued mission/photo actions if needed.
 */
@Database(
        entities = {
                LocationPingEntity.class
        },
        version = 1,
        exportSchema = false
)
public abstract class AppDatabase extends RoomDatabase {

    private static volatile AppDatabase INSTANCE;

    public abstract LocationPingDao locationPingDao();

    public static AppDatabase getInstance(Context context) {

        if (INSTANCE == null) {

            synchronized (AppDatabase.class) {

                if (INSTANCE == null) {

                    INSTANCE = Room.databaseBuilder(
                            context.getApplicationContext(),
                            AppDatabase.class,
                            "officer_app_database"
                    ).build();
                }
            }
        }

        return INSTANCE;
    }
}