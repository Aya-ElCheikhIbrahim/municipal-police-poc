package com.municipalpolice.officerapp.data;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Priority;

import java.util.ArrayList;
import java.util.List;

/**
 * In-memory mock backend so every screen in the mockups is fully clickable
 * without a server. Replace with a real implementation of MissionRepository
 * when the API exists; MissionListActivity / MissionDetailActivity only
 * depend on the interface.
 */
public class FakeMissionRepository implements MissionRepository {

    private static FakeMissionRepository instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Mission> missions = new ArrayList<>();

    public static synchronized FakeMissionRepository getInstance() {
        if (instance == null) instance = new FakeMissionRepository();
        return instance;
    }

    private FakeMissionRepository() {
        seed();
    }

    private void seed() {
        missions.clear();
        missions.add(new Mission(
                "m-1",
                "Illegal parking blocking access",
                "Rue Tall",
                "400 m",
                "Rania Saab",
                Priority.URGENT,
                MissionStatus.NEW,
                SystemClock.elapsedRealtime() - 6 * 60 * 1000));
        missions.add(new Mission(
                "m-2",
                "Noise complaint, residential",
                "Al Mina",
                "2.1 km",
                "Rania Saab",
                Priority.LOW,
                MissionStatus.NEW,
                SystemClock.elapsedRealtime() - 30 * 60 * 1000));
    }

    /** Lets the demo "Preview state" menu simulate an empty list. */
    public void clearAll() {
        missions.clear();
    }

    /** Lets the demo "Preview state" menu restore the default seed data. */
    public void resetSeed() {
        seed();
    }

    @Override
    public void fetchMissions(Callback<List<Mission>> callback) {
        handler.postDelayed(() -> callback.onSuccess(new ArrayList<>(missions)), 700);
    }

    @Override
    public void getMissionById(String missionId, Callback<Mission> callback) {
        Mission m = find(missionId);
        if (m == null) {
            callback.onError(new IllegalStateException("not found"));
        } else {
            callback.onSuccess(m);
        }
    }

    @Override
    public void acknowledgeMission(String missionId, Callback<Mission> callback) {
        Mission m = find(missionId);
        if (m == null) { callback.onError(new IllegalStateException("not found")); return; }
        handler.postDelayed(() -> {
            m.setAcknowledgedAtMillis(System.currentTimeMillis());
            m.setStartedAtMillis(System.currentTimeMillis());
            m.setStatus(MissionStatus.IN_PROGRESS);
            callback.onSuccess(m);
        }, 300);
    }

    @Override
    public void completeMission(String missionId, Callback<Mission> callback) {
        Mission m = find(missionId);
        if (m == null) { callback.onError(new IllegalStateException("not found")); return; }
        handler.postDelayed(() -> {
            m.setStatus(MissionStatus.COMPLETED);
            callback.onSuccess(m);
        }, 300);
    }

    @Override
    public void cancelMission(String missionId, String reason, Callback<Void> callback) {
        Mission m = find(missionId);
        if (m == null) { callback.onError(new IllegalStateException("not found")); return; }
        handler.postDelayed(() -> {
            m.setStatus(MissionStatus.CANCELLED);
            callback.onSuccess(null);
        }, 300);
    }

    @Override
    public void addMissionPhoto(String missionId, String localPhotoUri, Callback<Mission> callback) {
        Mission m = find(missionId);
        if (m == null) { callback.onError(new IllegalStateException("not found")); return; }
        m.addPhoto(localPhotoUri);
        callback.onSuccess(m);
    }

    private Mission find(String id) {
        for (Mission m : missions) if (m.getId().equals(id)) return m;
        return null;
    }
}
