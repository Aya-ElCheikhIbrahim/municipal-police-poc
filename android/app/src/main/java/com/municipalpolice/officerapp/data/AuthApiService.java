package com.municipalpolice.officerapp.data;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface AuthApiService {
    @POST("login/")
    Call<LoginResponse> login(@Body LoginRequest request);
}
