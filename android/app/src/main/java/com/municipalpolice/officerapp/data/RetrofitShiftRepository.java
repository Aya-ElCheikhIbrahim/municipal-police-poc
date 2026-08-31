package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.util.PrefsManager;
import retrofit2.Call;
import retrofit2.Response;

public class RetrofitShiftRepository implements ShiftRepository {
    private final ShiftApiService apiService;

    public RetrofitShiftRepository(PrefsManager prefs, Context context) {
        this.apiService = RetrofitClient.getClient(context).create(ShiftApiService.class);
    }

    @Override
    public void startShift(Double latitude, Double longitude, Callback<Shift> callback) {
        apiService.startShift(new PositionRequest(latitude, longitude)).enqueue(new retrofit2.Callback<Shift>() {
            @Override
            public void onResponse(Call<Shift> call, Response<Shift> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("Start shift failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Shift> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void endShift(Double latitude, Double longitude, String refresh, Callback<Shift> callback) {
        apiService.endShift(new EndShiftRequest(latitude, longitude, refresh)).enqueue(new retrofit2.Callback<Shift>() {
            @Override
            public void onResponse(Call<Shift> call, Response<Shift> response) {
                if (response.isSuccessful() && response.body() != null) {
                    callback.onSuccess(response.body());
                } else {
                    callback.onError(new Exception("End shift failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<Shift> call, Throwable t) {
                callback.onError(t);
            }
        });
    }
}
