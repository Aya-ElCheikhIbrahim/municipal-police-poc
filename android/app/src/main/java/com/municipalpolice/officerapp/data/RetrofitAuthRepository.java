package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.data.api.AuthApiService;
import com.municipalpolice.officerapp.data.api.LoginRequest;
import com.municipalpolice.officerapp.data.api.LoginResponse;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.util.PrefsManager;

import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Call;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class RetrofitAuthRepository implements AuthRepository {

    private static RetrofitAuthRepository instance;
    private final AuthApiService apiService;
    private final PrefsManager prefs;
    private Officer cachedOfficer;

    public static synchronized RetrofitAuthRepository getInstance(PrefsManager prefs) {
        if (instance == null) instance = new RetrofitAuthRepository(prefs);
        return instance;
    }

    private RetrofitAuthRepository(PrefsManager prefs) {
        this.prefs = prefs;
        
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
        logging.setLevel(HttpLoggingInterceptor.Level.BODY);
        
        OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(logging)
                .build();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://10.0.2.2:8000/")
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        apiService = retrofit.create(AuthApiService.class);
    }

    @Override
    public void login(String username, String password, Callback<Officer> callback) {
        apiService.login(new LoginRequest(username, password)).enqueue(new retrofit2.Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    LoginResponse body = response.body();
                    prefs.setAccessToken(body.access);
                    prefs.setLoggedIn(true);
                    
                    cachedOfficer = new Officer(
                            body.user.id,
                            body.user.fullName,
                            body.user.badgeNumber
                    );
                    callback.onSuccess(cachedOfficer);
                } else {
                    callback.onError(new Exception("Login failed: " + response.code()));
                }
            }

            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                callback.onError(t);
            }
        });
    }

    @Override
    public void logout() {
        cachedOfficer = null;
        prefs.setAccessToken(null);
        prefs.setLoggedIn(false);
    }

    @Override
    public Officer getCachedOfficer() {
        return cachedOfficer;
    }
}
