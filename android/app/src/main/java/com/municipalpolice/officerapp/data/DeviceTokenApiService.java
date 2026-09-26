package com.municipalpolice.officerapp.data;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface DeviceTokenApiService {

    @POST("device-tokens/")
    Call<Object> registerDeviceToken(
            @Body DeviceTokenRequest request
    );
}