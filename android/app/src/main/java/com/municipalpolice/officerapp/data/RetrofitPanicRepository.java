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
        triggerPanic(lat, lon, null, null, callback);
    }

    @Override
    public void triggerPanic(Double lat, Double lon, Float accuracy, Integer battery, Callback<PanicEventResponse> callback) {
        // The backend requires both coordinates. Substituting a placeholder position would
        // put the officer somewhere they are not on the dispatcher's map, and the request
        // would succeed, so nothing would look broken. Fail loudly instead.
        if (lat == null || lon == null) {
            Log.e(TAG, "Refusing to trigger panic without coordinates");
            callback.onError(new IllegalArgumentException("A location fix is required to send a panic alert"));
            return;
        }

        // accuracy_m and battery_level are optional; send nothing rather than a guess.
        Integer finalBattery = (battery != null && battery >= 0 && battery <= 100) ? battery : null;

        PositionRequest request = new PositionRequest(lat, lon, accuracy, finalBattery);
        Log.d(TAG, "Triggering panic payload: lat=" + lat + ", lon=" + lon + ", accuracy=" + accuracy + ", battery=" + finalBattery);

        // The Call is deliberately NOT retained and there is deliberately no way to cancel
        // it. A panic POST has to outlive the dialog that started it: the 10s countdown
        // auto-dismisses while the officer has already stopped looking at the screen, so
        // aborting the request on teardown would turn a slow panic into no panic.
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
