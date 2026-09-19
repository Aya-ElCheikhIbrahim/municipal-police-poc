package com.municipalpolice.officerapp.data;

import android.content.Context;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import retrofit2.Call;
import retrofit2.Response;

/**
 * Uploads locally queued location pings to Django.
 *
 * Flow:
 *
 * Room
 * -> sanitize queued values
 * -> POST /api/v1/location-pings/bulk/
 * -> delete rows only after successful Django response
 *
 * IMPORTANT:
 * Local Room rows are NOT deleted when an upload fails.
 */
public class LocationSyncRepository {

    private static final int MAX_BATCH_SIZE = 500;

    private final LocationPingDao locationPingDao;
    private final ShiftApiService apiService;

    public LocationSyncRepository(Context context) {

        Context appContext =
                context.getApplicationContext();

        AppDatabase database =
                AppDatabase.getInstance(appContext);

        locationPingDao =
                database.locationPingDao();

        apiService =
                RetrofitClient
                        .getClient(appContext)
                        .create(ShiftApiService.class);
    }

    /**
     * Must be called from a background thread.
     */
    public int getPendingCount() {

        return locationPingDao.getPendingCount();
    }

    /**
     * Upload up to 500 queued location pings.
     */
    public void syncPending(
            Callback<BulkLocationPingResponse> callback
    ) {

        new Thread(() -> {

            try {

                List<LocationPingEntity> pending =
                        locationPingDao.getPending(
                                MAX_BATCH_SIZE
                        );

                if (pending == null
                        || pending.isEmpty()) {

                    callback.onSuccess(
                            new BulkLocationPingResponse()
                    );

                    return;
                }

                List<LocationPingUpload> uploads =
                        new ArrayList<>();

                /*
                 * Only UUIDs actually included in this request
                 * are deleted after successful upload.
                 */
                List<String> uploadedClientUuids =
                        new ArrayList<>();

                int invalidCount = 0;

                for (LocationPingEntity entity : pending) {

                    LocationPingUpload upload =
                            sanitize(entity);

                    if (upload == null) {

                        /*
                         * Do NOT delete malformed Room rows.
                         *
                         * They remain on the phone so we do not
                         * silently lose recorded location data.
                         */
                        invalidCount++;

                        continue;
                    }

                    uploads.add(upload);

                    uploadedClientUuids.add(
                            entity.clientUuid
                    );
                }

                /*
                 * If every row was malformed, don't send an empty
                 * batch because Django rejects empty pings.
                 */
                if (uploads.isEmpty()) {

                    callback.onError(
                            new Exception(
                                    "No valid saved locations could be uploaded. "
                                            + invalidCount
                                            + " queued location(s) need inspection."
                            )
                    );

                    return;
                }

                BulkLocationPingRequest request =
                        new BulkLocationPingRequest(
                                uploads
                        );

                final int skippedInvalid =
                        invalidCount;

                apiService
                        .uploadLocationPings(request)
                        .enqueue(
                                new retrofit2.Callback<BulkLocationPingResponse>() {

                                    @Override
                                    public void onResponse(
                                            Call<BulkLocationPingResponse> call,
                                            Response<BulkLocationPingResponse> response
                                    ) {

                                        if (response.isSuccessful()
                                                && response.body() != null) {

                                            /*
                                             * Room database operations must not
                                             * run on Android's main thread.
                                             */
                                            new Thread(() -> {

                                                try {

                                                    /*
                                                     * Delete ONLY the rows that
                                                     * were part of the successful
                                                     * Django request.
                                                     */
                                                    locationPingDao
                                                            .deleteByClientUuids(
                                                                    uploadedClientUuids
                                                            );

                                                    callback.onSuccess(
                                                            response.body()
                                                    );

                                                } catch (Exception e) {

                                                    callback.onError(e);
                                                }

                                            }).start();

                                            return;
                                        }

                                        // -------------------------------------
                                        // DJANGO ERROR BODY
                                        // -------------------------------------

                                        String errorBody = "";

                                        try {

                                            if (response.errorBody()
                                                    != null) {

                                                errorBody =
                                                        response
                                                                .errorBody()
                                                                .string();
                                            }

                                        } catch (Exception ignored) {
                                        }

                                        StringBuilder message =
                                                new StringBuilder();

                                        message.append(
                                                "Location sync failed: "
                                        );

                                        message.append(
                                                response.code()
                                        );

                                        if (errorBody != null
                                                && !errorBody.isEmpty()) {

                                            message.append(" ");
                                            message.append(errorBody);
                                        }

                                        if (skippedInvalid > 0) {

                                            message.append(
                                                    " | "
                                                            + skippedInvalid
                                                            + " malformed local row(s) were kept on the phone."
                                            );
                                        }

                                        callback.onError(
                                                new Exception(
                                                        message.toString()
                                                )
                                        );
                                    }

                                    @Override
                                    public void onFailure(
                                            Call<BulkLocationPingResponse> call,
                                            Throwable throwable
                                    ) {

                                        /*
                                         * Network/backend failure:
                                         * Room rows remain untouched.
                                         */
                                        callback.onError(
                                                throwable
                                        );
                                    }
                                }
                        );

            } catch (Exception e) {

                callback.onError(e);
            }

        }).start();
    }

    // ---------------------------------------------------------
    // SANITIZE ONE ROOM PING
    // ---------------------------------------------------------

    private LocationPingUpload sanitize(
            LocationPingEntity entity
    ) {

        if (entity == null) {
            return null;
        }

        // -----------------------------------------------------
        // UUID
        // -----------------------------------------------------

        if (entity.clientUuid == null
                || entity.clientUuid.trim().isEmpty()) {

            return null;
        }

        String clientUuid =
                entity.clientUuid.trim();

        try {

            UUID.fromString(
                    clientUuid
            );

        } catch (Exception e) {

            return null;
        }

        // -----------------------------------------------------
        // LATITUDE / LONGITUDE
        // -----------------------------------------------------

        double latitude =
                entity.latitude;

        double longitude =
                entity.longitude;

        if (Double.isNaN(latitude)
                || Double.isInfinite(latitude)
                || latitude < -90.0
                || latitude > 90.0) {

            return null;
        }

        if (Double.isNaN(longitude)
                || Double.isInfinite(longitude)
                || longitude < -180.0
                || longitude > 180.0) {

            return null;
        }

        /*
         * VERY IMPORTANT:
         *
         * Django:
         *
         * DecimalField(
         *     max_digits=9,
         *     decimal_places=6
         * )
         *
         * FusedLocationProviderClient gives Java doubles such as:
         *
         * 34.436734829173
         *
         * Sending all those decimal places can cause DRF to reject
         * the value with HTTP 400.
         *
         * Force exactly six decimal places before Retrofit/Gson.
         */
        latitude =
                roundCoordinate(latitude);

        longitude =
                roundCoordinate(longitude);

        // -----------------------------------------------------
        // ACCURACY
        // -----------------------------------------------------

        Double accuracy =
                entity.accuracyM;

        if (accuracy != null) {

            if (Double.isNaN(accuracy)
                    || Double.isInfinite(accuracy)
                    || accuracy < 0) {

                accuracy = null;
            }
        }

        // -----------------------------------------------------
        // BATTERY
        // -----------------------------------------------------

        Integer battery =
                entity.batteryLevel;

        if (battery != null) {

            if (battery < 0
                    || battery > 100) {

                battery = null;
            }
        }

        // -----------------------------------------------------
        // RECORDED AT
        // -----------------------------------------------------

        String recordedAt =
                entity.recordedAt;

        if (recordedAt == null
                || recordedAt.trim().isEmpty()) {

            return null;
        }

        recordedAt =
                recordedAt.trim();

        // -----------------------------------------------------
        // NETWORK TYPE
        // -----------------------------------------------------

        /*
         * We already proved in Django shell that "unknown"
         * is accepted by LocationPingUploadSerializer.
         *
         * Force old/stale Room rows to a known valid value.
         */
        String networkType =
                "unknown";

        // -----------------------------------------------------
        // BUILD CLEAN UPLOAD OBJECT
        // -----------------------------------------------------

        return new LocationPingUpload(
                clientUuid,
                latitude,
                longitude,
                accuracy,
                recordedAt,
                battery,
                networkType,
                true
        );
    }

    // ---------------------------------------------------------
    // COORDINATE PRECISION
    // ---------------------------------------------------------

    private double roundCoordinate(
            double value
    ) {

        return BigDecimal
                .valueOf(value)
                .setScale(
                        6,
                        RoundingMode.HALF_UP
                )
                .doubleValue();
    }
}
