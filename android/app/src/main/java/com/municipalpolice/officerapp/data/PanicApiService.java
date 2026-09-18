package com.municipalpolice.officerapp.data;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;
import retrofit2.http.Path;

public interface PanicApiService {
    @POST("panic/")
    Call<Object> triggerPanic(@Body PositionRequest request);

    @POST("panic/{id}/cancel/")
    Call<Object> cancelPanic(@Path("id") int id);
}
