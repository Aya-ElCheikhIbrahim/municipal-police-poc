package com.municipalpolice.officerapp.data;

import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.List;

/**
 * Room access for location pings waiting to be uploaded.
 */
@Dao
public interface LocationPingDao {

    /**
     * Save a new location ping.
     *
     * clientUuid is the primary key, so IGNORE protects us
     * from accidentally storing the same ping twice.
     */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    long insert(LocationPingEntity ping);

    /**
     * Get the oldest queued pings first.
     *
     * Django accepts at most 500 pings in one bulk request.
     */
    @Query("SELECT * FROM location_pings " +
            "ORDER BY recordedAt ASC " +
            "LIMIT :limit")
    List<LocationPingEntity> getPending(int limit);

    /**
     * Number of location pings currently saved on this phone.
     *
     * We will use this for the Figma text:
     * '24 locations ... will upload when the signal returns.'
     */
    @Query("SELECT COUNT(*) FROM location_pings")
    int getPendingCount();

    /**
     * Delete one ping after it has been successfully synchronized.
     */
    @Delete
    void delete(LocationPingEntity ping);

    /**
     * Delete a successfully uploaded batch using its UUIDs.
     */
    @Query("DELETE FROM location_pings WHERE clientUuid IN (:clientUuids)")
    void deleteByClientUuids(List<String> clientUuids);

    /**
     * Clear the queue.
     *
     * Mainly useful during development/testing.
     */
    @Query("DELETE FROM location_pings")
    void deleteAll();
}