package com.municipalpolice.officerapp.data;

import android.content.Context;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.util.PrefsManager;
import java.util.List;
import retrofit2.Call;
import retrofit2.Response;

public class RetrofitMissionRepository implements MissionRepository {
    private final MissionApiService apiService;

    public RetrofitMissionRepository(PrefsManager prefs, Context context) {
        this.apiService = RetrofitClient.getClient(context).create(MissionApiService.class);
    }

    @Override
    public void fetchMissions(Callback<List<Mission>> callback) {
        apiService.getMissions(null, true).enqueue(new retrofit2.Callback<List<Mission>>() {
            @Override
            public void onResponse(Call<List<Mission>> call, Response<List<Mission>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("Fetch missions failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<List<Mission>> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void getMissionById(String missionId, Callback<Mission> callback) {
        apiService.getMissionDetail(Integer.parseInt(missionId)).enqueue(new retrofit2.Callback<Mission>() {
            @Override
            public void onResponse(Call<Mission> call, Response<Mission> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("Get mission failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Mission> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void acknowledgeMission(String missionId, Callback<Mission> callback) {
        apiService.acknowledgeMission(Integer.parseInt(missionId)).enqueue(new retrofit2.Callback<Mission>() {
            @Override
            public void onResponse(Call<Mission> call, Response<Mission> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("Acknowledge mission failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Mission> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void startMission(String missionId, Callback<Mission> callback) {
        // Passing null coordinates for now
        apiService.startMission(Integer.parseInt(missionId), new PositionRequest(null, null)).enqueue(new retrofit2.Callback<Mission>() {
            @Override
            public void onResponse(Call<Mission> call, Response<Mission> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("Start mission failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Mission> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void completeMission(String missionId, Callback<Mission> callback) {
        // Position should ideally be fetched here. For now passing nulls.
        apiService.completeMission(Integer.parseInt(missionId), new CompleteMissionRequest(null, null, "")).enqueue(new retrofit2.Callback<Mission>() {
            @Override
            public void onResponse(Call<Mission> call, Response<Mission> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("Complete mission failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Mission> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void cancelMission(String missionId, String reason, Callback<Void> callback) {
        apiService.cancelMission(Integer.parseInt(missionId), new CancelMissionRequest(reason)).enqueue(new retrofit2.Callback<Mission>() {
            @Override
            public void onResponse(Call<Mission> call, Response<Mission> response) {
                if (response.isSuccessful()) {
                    callback.onSuccess(null);
                } else {
                    callback.onError(new Exception("Cancel mission failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Mission> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void addMissionPhoto(String missionId, String localPhotoUri, Callback<Mission> callback) {
        // Simplified photo upload. Real implementation needs Multipart conversion.
        // For this task, I'll focus on shift and basic mission tracking.
        callback.onError(new Exception("Photo upload not fully implemented in Retrofit layer yet."));
    }
}
