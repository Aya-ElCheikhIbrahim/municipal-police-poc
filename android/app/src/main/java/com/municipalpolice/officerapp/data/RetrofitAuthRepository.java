package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.util.PrefsManager;

import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Call;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class RetrofitAuthRepository implements AuthRepository {

    private static final String BASE_URL = "http://10.0.2.2:8000/api/v1/";
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
                .baseUrl(BASE_URL)
                .addConverterFactory(GsonConverterFactory.create())
                .client(client)
                .build();

        apiService = retrofit.create(AuthApiService.class);

        // Hydrate cache from prefs if possible
        if (prefs.isLoggedIn()) {
            cachedOfficer = new Officer(
                prefs.getUserId(),
                prefs.getUserFullName(),
                prefs.getUserBadgeNumber()
            );
        }
    }

    @Override
    public void login(String username, String password, Callback<Officer> callback) {
        apiService.login(new LoginRequest(username, password)).enqueue(new retrofit2.Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    LoginResponse.UserData userData = response.body().getUser();
                    cachedOfficer = new Officer(
                        userData.getId(),
                        userData.getFullName(),
                        userData.getBadgeNumber()
                    );
                    
                    prefs.setLoggedIn(true);
                    prefs.setAuthToken(response.body().getAccessToken());
                    prefs.setRefreshToken(response.body().getRefreshToken());
                    prefs.setUserData(userData.getId(), userData.getFullName(), userData.getBadgeNumber());
                    
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
        prefs.clear();
        cachedOfficer = null;
    }

    @Override
    public Officer getCachedOfficer() {
        return cachedOfficer;
    }
}
