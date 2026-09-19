package com.municipalpolice.officerapp.data;

import android.content.Context;

import com.google.gson.Gson;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.io.IOException;

import okhttp3.Authenticator;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okhttp3.Route;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class RetrofitClient {

    private static final String BASE_URL =
            "http://10.0.2.2:8000/api/v1/";

    private static final String REFRESH_URL =
            BASE_URL + "token/refresh/";

    private static Retrofit retrofit = null;

    public static synchronized Retrofit getClient(Context context) {

        if (retrofit == null) {

            Context appContext =
                    context.getApplicationContext();

            PrefsManager prefs =
                    new PrefsManager(appContext);

            Gson gson =
                    new Gson();

            // -----------------------------------------------------
            // LOGGING
            // -----------------------------------------------------

            HttpLoggingInterceptor logging =
                    new HttpLoggingInterceptor();

            logging.setLevel(
                    HttpLoggingInterceptor.Level.BODY
            );

            // -----------------------------------------------------
            // AUTHENTICATOR
            //
            // Called automatically when an API request returns 401.
            // -----------------------------------------------------

            Authenticator authenticator =
                    new Authenticator() {

                        @Override
                        public Request authenticate(
                                Route route,
                                Response response
                        ) throws IOException {

                            /*
                             * Prevent infinite:
                             *
                             * request -> 401
                             * refresh/retry -> 401
                             * refresh/retry -> ...
                             */
                            if (responseCount(response) >= 2) {
                                return null;
                            }

                            String refreshToken =
                                    prefs.getRefreshToken();

                            if (refreshToken == null
                                    || refreshToken.isEmpty()) {

                                return null;
                            }

                            // -------------------------------------
                            // BUILD REFRESH REQUEST JSON
                            // -------------------------------------

                            TokenRefreshRequest refreshRequest =
                                    new TokenRefreshRequest(
                                            refreshToken
                                    );

                            String json =
                                    gson.toJson(
                                            refreshRequest
                                    );

                            RequestBody requestBody =
                                    RequestBody.create(
                                            json,
                                            MediaType.parse(
                                                    "application/json; charset=utf-8"
                                            )
                                    );

                            Request tokenRequest =
                                    new Request.Builder()
                                            .url(REFRESH_URL)
                                            .post(requestBody)
                                            .build();

                            /*
                             * Separate client:
                             *
                             * It deliberately does NOT have this
                             * authenticator attached. Otherwise a failed
                             * token refresh could recursively trigger
                             * another token refresh.
                             */
                            OkHttpClient refreshClient =
                                    new OkHttpClient.Builder()
                                            .build();

                            try (
                                    Response tokenResponse =
                                            refreshClient
                                                    .newCall(tokenRequest)
                                                    .execute()
                            ) {

                                if (!tokenResponse.isSuccessful()) {
                                    return null;
                                }

                                ResponseBody responseBody =
                                        tokenResponse.body();

                                if (responseBody == null) {
                                    return null;
                                }

                                String responseJson =
                                        responseBody.string();

                                TokenRefreshResponse refreshResponse =
                                        gson.fromJson(
                                                responseJson,
                                                TokenRefreshResponse.class
                                        );

                                if (refreshResponse == null
                                        || refreshResponse.getAccess() == null
                                        || refreshResponse
                                        .getAccess()
                                        .isEmpty()) {

                                    return null;
                                }

                                // ---------------------------------
                                // SAVE NEW ACCESS TOKEN
                                // ---------------------------------

                                String newAccessToken =
                                        refreshResponse.getAccess();

                                prefs.setAuthToken(
                                        newAccessToken
                                );

                                // ---------------------------------
                                // RETRY ORIGINAL REQUEST
                                // ---------------------------------

                                return response
                                        .request()
                                        .newBuilder()
                                        .header(
                                                "Authorization",
                                                "Bearer "
                                                        + newAccessToken
                                        )
                                        .build();
                            }
                        }
                    };

            // -----------------------------------------------------
            // MAIN API CLIENT
            // -----------------------------------------------------

            OkHttpClient client =
                    new OkHttpClient.Builder()

                            /*
                             * Always attach the newest access token
                             * currently stored in SharedPreferences.
                             */
                            .addInterceptor(chain -> {

                                Request original =
                                        chain.request();

                                String token =
                                        prefs.getAuthToken();

                                if (token != null
                                        && !token.isEmpty()) {

                                    Request authenticatedRequest =
                                            original
                                                    .newBuilder()
                                                    .header(
                                                            "Authorization",
                                                            "Bearer "
                                                                    + token
                                                    )
                                                    .build();

                                    return chain.proceed(
                                            authenticatedRequest
                                    );
                                }

                                return chain.proceed(
                                        original
                                );
                            })

                            // Automatically refresh expired access tokens.
                            .authenticator(
                                    authenticator
                            )

                            // Log requests/responses in Logcat.
                            .addInterceptor(
                                    logging
                            )

                            .build();

            // -----------------------------------------------------
            // RETROFIT
            // -----------------------------------------------------

            retrofit =
                    new Retrofit.Builder()
                            .baseUrl(BASE_URL)
                            .addConverterFactory(
                                    GsonConverterFactory.create(
                                            gson
                                    )
                            )
                            .client(client)
                            .build();
        }

        return retrofit;
    }

    /**
     * Counts how many times the same request has already
     * been attempted.
     */
    private static int responseCount(
            Response response
    ) {

        int count = 1;

        while (
                (response = response.priorResponse())
                        != null
        ) {

            count++;
        }

        return count;
    }
}
