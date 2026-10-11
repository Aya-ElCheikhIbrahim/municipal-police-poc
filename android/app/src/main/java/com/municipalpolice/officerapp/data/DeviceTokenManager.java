package com.municipalpolice.officerapp.data;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessaging;
import com.municipalpolice.officerapp.BuildConfig;

import retrofit2.Call;
import retrofit2.Response;

public class DeviceTokenManager {

    /*
     * Registration failures are never shown to the officer, so they are
     * logged under this tag: filter logcat by "FcmTokenRegistration".
     */
    private static final String TAG = "FcmTokenRegistration";

    private DeviceTokenManager() {
        // Utility class - no instances.
    }

    /**
     * Gets the current Firebase Cloud Messaging token
     * and registers it with the Django backend.
     *
     * Call this after the officer has successfully logged in,
     * because /device-tokens/ requires authentication.
     */
    public static void registerCurrentToken(Context context) {

        Context appContext = context.getApplicationContext();

        FirebaseMessaging.getInstance()
                .getToken()
                .addOnCompleteListener(task -> {

                    if (!task.isSuccessful()) {
                        Log.e(
                                TAG,
                                "FCM token registration FAILED: could not get a token from Firebase",
                                task.getException()
                        );
                        return;
                    }

                    String token = task.getResult();

                    if (token == null || token.isEmpty()) {
                        Log.e(TAG, "FCM token registration FAILED: Firebase returned an empty token");
                        return;
                    }

                    // Prefix only: the full token is enough to push to this phone.
                    Log.d(TAG, "FCM token obtained: " + token.substring(0, Math.min(8, token.length())) + "...");

                    sendTokenToBackend(appContext, token);
                });
    }

    /**
     * Used when Firebase generates or refreshes a token.
     */
    public static void registerToken(
            Context context,
            String token
    ) {

        if (token == null || token.isEmpty()) {
            return;
        }

        sendTokenToBackend(
                context.getApplicationContext(),
                token
        );
    }

    private static void sendTokenToBackend(
            Context context,
            String token
    ) {

        String deviceModel =
                Build.MANUFACTURER + " " + Build.MODEL;

        String appVersion = BuildConfig.VERSION_NAME;

        DeviceTokenRequest request =
                new DeviceTokenRequest(
                        token,
                        deviceModel,
                        appVersion
                );

        DeviceTokenApiService api =
                RetrofitClient
                        .getClient(context)
                        .create(DeviceTokenApiService.class);

        api.registerDeviceToken(request)
                .enqueue(new retrofit2.Callback<Object>() {

                    @Override
                    public void onResponse(
                            Call<Object> call,
                            Response<Object> response
                    ) {

                        if (response.isSuccessful()) {

                            Log.d(
                                    TAG,
                                    "FCM token registered with backend"
                            );

                        } else {

                            Log.e(
                                    TAG,
                                    "FCM token registration FAILED: backend returned HTTP "
                                            + response.code()
                            );
                        }
                    }

                    @Override
                    public void onFailure(
                            Call<Object> call,
                            Throwable t
                    ) {

                        Log.e(
                                TAG,
                                "FCM token registration FAILED: request did not reach the backend",
                                t
                        );
                    }
                });
    }
}