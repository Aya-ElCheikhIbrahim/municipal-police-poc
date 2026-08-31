package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.model.Mission;

import java.util.List;

/**
 * Contract for fetching/mutating missions. Swap FakeMissionRepository for a
 * real networked implementation later (e.g. Retrofit + a local Room cache
 * for the "working offline" / "saved on this phone" states already covered
 * in the UI).
 */
public interface MissionRepository {
    void fetchMissions(Callback<List<Mission>> callback);
    void getMissionById(String missionId, Callback<Mission> callback);
    void acknowledgeMission(String missionId, Callback<Mission> callback);
    void startMission(String missionId, Callback<Mission> callback);
    void completeMission(String missionId, Callback<Mission> callback);
    void cancelMission(String missionId, String reason, Callback<Void> callback);
    void addMissionPhoto(String missionId, String localPhotoUri, Callback<Mission> callback);
}
