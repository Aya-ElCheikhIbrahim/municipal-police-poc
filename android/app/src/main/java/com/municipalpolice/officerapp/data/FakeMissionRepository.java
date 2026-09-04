package com.municipalpolice.officerapp.data;

import android.os.Handler;
import android.os.Looper;

import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Priority;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

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
                1,
                "Illegal parking blocking access",
                "Abandoned vehicle blocking the right lane.",
                Priority.URGENT,
                MissionStatus.NEW,
                34.436700,
                35.849700,
                "Rue Tall, Tripoli"));
        missions.add(new Mission(
                2,
                "Noise complaint, residential",
                "Loud music from a cafe.",
                Priority.LOW,
                MissionStatus.NEW,
                34.446700,
                35.859700,
                "Dam & Farez, Tripoli"));
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
            m.setAcknowledgedAt(nowIso());
            m.setStatus(MissionStatus.ACKNOWLEDGED);
            callback.onSuccess(m);
        }, 300);
    }

    @Override
    public void startMission(String missionId, Callback<Mission> callback) {
        Mission m = find(missionId);
        if (m == null) { callback.onError(new IllegalStateException("not found")); return; }
        handler.postDelayed(() -> {
            m.setStartedAt(nowIso());
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
            m.setCompletedAt(nowIso());
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
        // m.addPhoto(localPhotoUri); // Model changed, omitting for mock
        callback.onSuccess(m);
    }

    private Mission find(String id) {
        try {
            int intId = Integer.parseInt(id);
            for (Mission m : missions) if (m.getId() == intId) return m;
        } catch (NumberFormatException ignored) {}
        return null;
    }

    private String nowIso() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        return sdf.format(new Date());
    }
}
