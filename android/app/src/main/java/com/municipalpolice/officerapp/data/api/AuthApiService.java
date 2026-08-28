package com.municipalpolice.officerapp.data.api;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface AuthApiService {
    @POST("api/v1/login/")
    Call<LoginResponse> login(@Body LoginRequest request);
}
