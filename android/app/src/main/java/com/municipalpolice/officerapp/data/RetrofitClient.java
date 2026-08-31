package com.municipalpolice.officerapp.data;

import android.content.Context;
import com.municipalpolice.officerapp.util.PrefsManager;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class RetrofitClient {
    private static final String BASE_URL = "http://10.0.2.2:8000/api/v1/";
    private static Retrofit retrofit = null;

    public static synchronized Retrofit getClient(Context context) {
        if (retrofit == null) {
            PrefsManager prefs = new PrefsManager(context.getApplicationContext());
            
            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BODY);

            OkHttpClient client = new OkHttpClient.Builder()
                    .addInterceptor(chain -> {
                        Request original = chain.request();
                        
                        // Always get the latest token from prefs
                        String token = prefs.getAuthToken();
                        
                        if (token != null && !token.isEmpty()) {
                            Request authenticatedRequest = original.newBuilder()
                                    .header("Authorization", "Bearer " + token)
                                    .build();
                            return chain.proceed(authenticatedRequest);
                        }
                        return chain.proceed(original);
                    })
                    .addInterceptor(logging) // Add logging AFTER auth to see the final request
                    .build();

            retrofit = new Retrofit.Builder()
                    .baseUrl(BASE_URL)
                    .addConverterFactory(GsonConverterFactory.create())
                    .client(client)
                    .build();
        }
        return retrofit;
    }
}
