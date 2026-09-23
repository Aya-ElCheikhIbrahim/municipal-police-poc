package com.municipalpolice.officerapp.data;

import android.content.Context;
import android.util.Log;

import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.util.PrefsManager;

import retrofit2.Call;
import retrofit2.Response;

public class RetrofitShiftRepository implements ShiftRepository {
    private static final String TAG = "RetrofitShiftRepo";
    private final ShiftApiService apiService;
    private final PrefsManager prefs;

    public RetrofitShiftRepository(PrefsManager prefs, Context context) {
        this.prefs = prefs;
        this.apiService = RetrofitClient.getClient(context).create(ShiftApiService.class);
    }

    @Override
    public void startShift(Double latitude, Double longitude, Callback<Shift> callback) {
        if (prefs != null && prefs.isShiftActive()) {
            Log.d(TAG, "Shift is already marked active locally; updating state gracefully without re-starting shift.");
            callback.onSuccess(new Shift());
            return;
        }

        Log.d(TAG, "Starting shift: lat=" + latitude + ", lon=" + longitude);
        apiService.startShift(new PositionRequest(latitude, longitude)).enqueue(new retrofit2.Callback<Shift>() {
            @Override
            public void onResponse(Call<Shift> call, Response<Shift> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Log.d(TAG, "Start shift successful (HTTP " + response.code() + ")");
                    if (prefs != null) prefs.setShiftActive(true);
                    callback.onSuccess(response.body());
                } else {
                    String errorBodyStr = "";
                    try {
                        if (response.errorBody() != null) {
                            errorBodyStr = response.errorBody().string();
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to read error body", e);
                    }
                    Log.e("API_ERROR", "POST /api/v1/shifts/start/ HTTP " + response.code() + " Error: " + errorBodyStr);

                    if (response.code() == 400 && (errorBodyStr.toLowerCase().contains("active") || errorBodyStr.toLowerCase().contains("already"))) {
                        Log.w(TAG, "Active shift already running on server; setting local state to SHIFT ACTIVE.");
                        if (prefs != null) prefs.setShiftActive(true);
                        callback.onSuccess(new Shift());
                    } else {
                        String errorMsg = "HTTP " + response.code() + " Error: " + errorBodyStr;
                        callback.onError(new Exception(errorMsg));
                    }
                }
            }

            @Override
            public void onFailure(Call<Shift> call, Throwable t) {
                Log.e(TAG, "Start shift network failure", t);
                callback.onError(t);
            }
        });
    }

    @Override
    public void endShift(Double latitude, Double longitude, String refresh, Callback<Shift> callback) {
        Log.d(TAG, "Ending shift: lat=" + latitude + ", lon=" + longitude);
        apiService.endShift(new EndShiftRequest(latitude, longitude, refresh)).enqueue(new retrofit2.Callback<Shift>() {
            @Override
            public void onResponse(Call<Shift> call, Response<Shift> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Log.d(TAG, "End shift successful (HTTP " + response.code() + ")");
                    if (prefs != null) prefs.setShiftActive(false);
                    callback.onSuccess(response.body());
                } else {
                    String errorBodyStr = "";
                    try {
                        if (response.errorBody() != null) {
                            errorBodyStr = response.errorBody().string();
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to read error body", e);
                    }
                    Log.e("API_ERROR", "POST /api/v1/shifts/end/ HTTP " + response.code() + " Error: " + errorBodyStr);
                    if (prefs != null) prefs.setShiftActive(false);
                    String errorMsg = "HTTP " + response.code() + " Error: " + errorBodyStr;
                    callback.onError(new Exception(errorMsg));
                }
            }

            @Override
            public void onFailure(Call<Shift> call, Throwable t) {
                Log.e(TAG, "End shift network failure", t);
                callback.onError(t);
            }
        });
    }
}
