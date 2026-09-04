package com.municipalpolice.officerapp.data;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Watches connectivity and verifies that the Django backend
 * is actually reachable.
 *
 * Used by ShiftActivity to drive:
 *
 * Online
 * -> Working offline
 * -> Syncing
 * -> Online
 */
public class NetworkMonitor {

    private static final String BACKEND_HEALTH_URL =
            "http://10.0.2.2:8000/api/docs/";

    private static final int CONNECT_TIMEOUT_MS = 2500;
    private static final int READ_TIMEOUT_MS = 2500;

    public interface Listener {
        void onNetworkAvailable();
        void onNetworkLost();
    }

    private final ConnectivityManager connectivityManager;
    private final Listener listener;

    private final ExecutorService executor =
            Executors.newSingleThreadExecutor();

    private ConnectivityManager.NetworkCallback networkCallback;

    private boolean started = false;

    public NetworkMonitor(
            Context context,
            Listener listener
    ) {

        connectivityManager =
                (ConnectivityManager)
                        context
                                .getApplicationContext()
                                .getSystemService(
                                        Context.CONNECTIVITY_SERVICE
                                );

        this.listener = listener;
    }

    // ---------------------------------------------------------
    // START MONITORING
    // ---------------------------------------------------------

    public void start() {

        if (started || connectivityManager == null) {
            return;
        }

        NetworkRequest request =
                new NetworkRequest.Builder()
                        .addCapability(
                                NetworkCapabilities.NET_CAPABILITY_INTERNET
                        )
                        .build();

        networkCallback =
                new ConnectivityManager.NetworkCallback() {

                    @Override
                    public void onAvailable(
                            Network network
                    ) {

                        checkBackendAsync();
                    }

                    @Override
                    public void onLost(
                            Network network
                    ) {

                        /*
                         * A network disappearing does not always mean
                         * every possible network disappeared.
                         *
                         * Recheck the backend instead of assuming.
                         */
                        checkBackendAsync();
                    }

                    @Override
                    public void onCapabilitiesChanged(
                            Network network,
                            NetworkCapabilities capabilities
                    ) {

                        checkBackendAsync();
                    }
                };

        connectivityManager.registerNetworkCallback(
                request,
                networkCallback
        );

        started = true;

        // Immediately check current state.
        checkBackendAsync();
    }

    // ---------------------------------------------------------
    // STOP MONITORING
    // ---------------------------------------------------------

    public void stop() {

        if (!started
                || connectivityManager == null
                || networkCallback == null) {

            return;
        }

        try {

            connectivityManager.unregisterNetworkCallback(
                    networkCallback
            );

        } catch (Exception ignored) {
        }

        started = false;
        networkCallback = null;
    }

    // ---------------------------------------------------------
    // CURRENT STATE
    // ---------------------------------------------------------

    /**
     * Lightweight Android-side check.
     *
     * This only says a network interface exists.
     * ShiftActivity should rely primarily on the listener,
     * which verifies actual backend reachability.
     */
    public boolean isOnline() {

        if (connectivityManager == null) {
            return false;
        }

        Network activeNetwork =
                connectivityManager.getActiveNetwork();

        if (activeNetwork == null) {
            return false;
        }

        NetworkCapabilities capabilities =
                connectivityManager
                        .getNetworkCapabilities(
                                activeNetwork
                        );

        return capabilities != null
                && capabilities.hasCapability(
                NetworkCapabilities.NET_CAPABILITY_INTERNET
        );
    }

    // ---------------------------------------------------------
    // BACKEND CHECK
    // ---------------------------------------------------------

    /**
     * Verifies that the Django backend itself is reachable.
     *
     * Runs off the main thread.
     */
    private void checkBackendAsync() {

        executor.execute(() -> {

            boolean reachable =
                    isBackendReachable();

            if (listener == null) {
                return;
            }

            if (reachable) {

                listener.onNetworkAvailable();

            } else {

                listener.onNetworkLost();
            }
        });
    }

    /**
     * Direct HTTP check against Django.
     *
     * Any HTTP response means the backend is reachable.
     * We only care whether the server answers.
     */
    private boolean isBackendReachable() {

        HttpURLConnection connection = null;

        try {

            URL url =
                    new URL(
                            BACKEND_HEALTH_URL
                    );

            connection =
                    (HttpURLConnection)
                            url.openConnection();

            connection.setRequestMethod(
                    "GET"
            );

            connection.setConnectTimeout(
                    CONNECT_TIMEOUT_MS
            );

            connection.setReadTimeout(
                    READ_TIMEOUT_MS
            );

            connection.setUseCaches(false);

            connection.connect();

            int responseCode =
                    connection.getResponseCode();

            /*
             * 200, 401, 403, 404, etc. all prove
             * that Django is reachable.
             *
             * Only connection failure means offline.
             */
            return responseCode >= 100
                    && responseCode < 600;

        } catch (Exception e) {

            return false;

        } finally {

            if (connection != null) {
                connection.disconnect();
            }
        }
    }
}