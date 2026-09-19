package com.municipalpolice.officerapp.data;

import android.content.Context;
import retrofit2.Call;
import retrofit2.Response;

public class RetrofitPanicRepository implements PanicRepository {
    private final PanicApiService apiService;

    public RetrofitPanicRepository(Context context) {
        this.apiService = RetrofitClient.getClient(context).create(PanicApiService.class);
    }

    @Override
    public void triggerPanic(Double lat, Double lon, Callback<Object> callback) {
        apiService.triggerPanic(new PositionRequest(lat, lon)).enqueue(new retrofit2.Callback<Object>() {
            @Override
            public void onResponse(Call<Object> call, Response<Object> response) {
                if (response.isSuccessful()) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("Panic trigger failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Object> call, Throwable t) {
                callback.onError(t);
            }
        });
    }
}
