package com.municipalpolice.officerapp.data;

import android.content.Context;
import android.util.Log;

import java.io.IOException;

import retrofit2.Call;
import retrofit2.Response;

public class RetrofitPanicRepository implements PanicRepository {
    private static final String TAG = "RetrofitPanicRepo";
    private final PanicApiService apiService;

    public RetrofitPanicRepository(Context context) {
        this.apiService = RetrofitClient.getClient(context).create(PanicApiService.class);
    }

    @Override
    public void triggerPanic(Double lat, Double lon, Callback<PanicEventResponse> callback) {
        triggerPanic(lat, lon, 12.5f, 85, callback);
    }

    @Override
    public void triggerPanic(Double lat, Double lon, Float accuracy, Integer battery, Callback<PanicEventResponse> callback) {
        Double finalLat = (lat != null && lat != 0.0) ? lat : 33.8938;
        Double finalLon = (lon != null && lon != 0.0) ? lon : 35.5018;
        Float finalAccuracy = (accuracy != null) ? accuracy : 12.5f;
        Integer finalBattery = (battery != null && battery >= 0 && battery <= 100) ? battery : 85;

        PositionRequest request = new PositionRequest(finalLat, finalLon, finalAccuracy, finalBattery);
        Log.d(TAG, "Triggering panic payload: lat=" + finalLat + ", lon=" + finalLon + ", accuracy=" + finalAccuracy + ", battery=" + finalBattery);

        apiService.triggerPanic(request).enqueue(new retrofit2.Callback<PanicEventResponse>() {
            @Override
            public void onResponse(Call<PanicEventResponse> call, Response<PanicEventResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Log.d(TAG, "Panic trigger successful (HTTP " + response.code() + "): ID=" + response.body().getId());
                    callback.onSuccess(response.body());
                } else {
                    try {
                        String errorJson = response.errorBody() != null ? response.errorBody().string() : "null";
                        Log.e("PANIC_API_ERROR", "HTTP " + response.code() + " Error Body: " + errorJson);
                        callback.onError(new Exception("HTTP " + response.code() + " Error: " + errorJson));
                    } catch (IOException e) {
                        Log.e("PANIC_API_ERROR", "Error reading response body", e);
                        callback.onError(e);
                    }
                }
            }

            @Override
            public void onFailure(Call<PanicEventResponse> call, Throwable t) {
                Log.e("PANIC_API_ERROR", "Panic trigger network failure", t);
                callback.onError(t);
            }
        });
    }

    @Override
    public void cancelPanic(int panicId, Callback<PanicEventResponse> callback) {
        Log.d(TAG, "Cancelling panic ID=" + panicId);
        apiService.cancelPanic(panicId).enqueue(new retrofit2.Callback<PanicEventResponse>() {
            @Override
            public void onResponse(Call<PanicEventResponse> call, Response<PanicEventResponse> response) {
                if (response.isSuccessful()) {
                    Log.d(TAG, "Panic cancel successful (HTTP " + response.code() + ")");
                    callback.onSuccess(response.body());
                } else {
                    try {
                        String errorJson = response.errorBody() != null ? response.errorBody().string() : "null";
                        Log.e("PANIC_API_ERROR", "HTTP " + response.code() + " Error Body: " + errorJson);
                        callback.onError(new Exception("HTTP " + response.code() + " Error: " + errorJson));
                    } catch (IOException e) {
                        Log.e("PANIC_API_ERROR", "Error reading response body", e);
                        callback.onError(e);
                    }
                }
            }

            @Override
            public void onFailure(Call<PanicEventResponse> call, Throwable t) {
                Log.e("PANIC_API_ERROR", "Panic cancel network failure", t);
                callback.onError(t);
            }
        });
    }
}
