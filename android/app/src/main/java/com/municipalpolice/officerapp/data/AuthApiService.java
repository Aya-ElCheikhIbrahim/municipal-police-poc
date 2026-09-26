package com.municipalpolice.officerapp.data;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface AuthApiService {

    @POST("login/")
    Call<LoginResponse> login(
            @Body LoginRequest request
    );

    @POST("token/refresh/")
    Call<TokenRefreshResponse> refreshToken(
            @Body TokenRefreshRequest request
    );

    @POST("password-reset/")
    Call<Void> requestPasswordReset(
            @Body PasswordResetCodeRequest request
    );

    @POST("password-reset/confirm/")
    Call<Void> confirmPasswordReset(
            @Body PasswordResetRequest request
    );
}