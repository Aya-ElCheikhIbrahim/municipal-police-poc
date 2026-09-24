package com.municipalpolice.officerapp.ui.dialogs;

import android.Manifest;
import android.app.Dialog;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.DialogFragment;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.PanicEventResponse;
import com.municipalpolice.officerapp.data.RetrofitPanicRepository;
import com.municipalpolice.officerapp.data.RetrofitShiftRepository;
import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.util.PrefsManager;

/** "Panic active" confirmation for the hold-2-seconds panic button, screen "Panic sent". */
public class PanicAlertDialogFragment extends DialogFragment {

    private static final String TAG = "PanicAlertDialog";

    public interface PanicListener {
        void onPanicSent();
    }

    private static final long AUTO_DISMISS_MILLIS = 10_000;
    private CountDownTimer countDownTimer;
    private RetrofitPanicRepository panicRepository;
    private TextView tvPanicStatus;
    private int createdPanicId = -1;

    public static PanicAlertDialogFragment newInstance() {
        return new PanicAlertDialogFragment();
    }

    @Override
    public void onStart() {
        super.onStart();

        Context context = getContext();
        if (context == null) return;

        PrefsManager prefs = new PrefsManager(context.getApplicationContext());
        if (!prefs.isShiftActive()) {
            Toast.makeText(context, "Please start a shift before pressing the panic button.", Toast.LENGTH_LONG).show();
            Log.w(TAG, "Cannot trigger panic: No active shift running");
            if (isAdded()) {
                dismissAllowingStateLoss();
            }
            return;
        }

        panicRepository = new RetrofitPanicRepository(context.getApplicationContext());
        sendPanicTrigger(context.getApplicationContext());
    }

    private void sendPanicTrigger(Context context) {
        boolean fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        Integer batteryLevel = getBatteryLevel(context);
        if (batteryLevel == null || batteryLevel < 0 || batteryLevel > 100) {
            batteryLevel = 85;
        }

        if (fineGranted || coarseGranted) {
            try {
                FusedLocationProviderClient fusedClient = LocationServices.getFusedLocationProviderClient(context);
                final Integer finalBattery = batteryLevel;
                fusedClient.getLastLocation().addOnSuccessListener(location -> {
                    double lat = 33.8938;
                    double lon = 35.5018;
                    float accuracy = 12.5f;

                    if (location != null && location.getLatitude() != 0.0 && location.getLongitude() != 0.0) {
                        lat = location.getLatitude();
                        lon = location.getLongitude();
                        accuracy = (float) location.getAccuracy();
                        Log.d(TAG, "Acquired GPS location from FusedLocationProviderClient: lat=" + lat + ", lon=" + lon + ", acc=" + accuracy);
                    } else {
                        Log.w(TAG, "FusedLocationProviderClient location is null or 0.0; using non-null fallback coordinates (33.8938, 35.5018)");
                    }

                    ensureShiftAndTrigger(context, lat, lon, accuracy, finalBattery);
                }).addOnFailureListener(e -> {
                    Log.e(TAG, "Failed to get location from FusedLocationProviderClient; using fallback coordinates", e);
                    ensureShiftAndTrigger(context, 33.8938, 35.5018, 12.5f, finalBattery);
                });
            } catch (Exception e) {
                Log.e(TAG, "Location provider error", e);
                ensureShiftAndTrigger(context, 33.8938, 35.5018, 12.5f, batteryLevel);
            }
        } else {
            Log.w(TAG, "Location permissions not granted; using fallback coordinates (33.8938, 35.5018)");
            ensureShiftAndTrigger(context, 33.8938, 35.5018, 12.5f, batteryLevel);
        }
    }

    private void ensureShiftAndTrigger(Context context, double lat, double lon, Float accuracy, Integer battery) {
        PrefsManager prefs = new PrefsManager(context.getApplicationContext());
        RetrofitShiftRepository shiftRepository = new RetrofitShiftRepository(prefs, context.getApplicationContext());

        Log.d(TAG, "Ensuring active shift on backend before panic trigger (lat=" + lat + ", lon=" + lon + ")");
        shiftRepository.startShift(lat, lon, new Callback<Shift>() {
            @Override
            public void onSuccess(Shift result) {
                Log.d(TAG, "Shift confirmed active on backend. Triggering panic...");
                prefs.setShiftActive(true);
                executeTrigger(lat, lon, accuracy, battery, false);
            }

            @Override
            public void onError(Throwable error) {
                Log.e(TAG, "Shift start failed before panic trigger, attempting panic anyway", error);
                executeTrigger(lat, lon, accuracy, battery, true);
            }
        });
    }

    private void executeTrigger(double lat, double lon, Float accuracy, Integer battery, boolean allowRetryShift) {
        if (panicRepository == null) return;

        Log.d(TAG, "Executing panic trigger: lat=" + lat + ", lon=" + lon + ", accuracy_m=" + accuracy + ", battery_level=" + battery);
        panicRepository.triggerPanic(lat, lon, accuracy, battery, new Callback<PanicEventResponse>() {
            @Override
            public void onSuccess(PanicEventResponse result) {
                if (result != null) {
                    createdPanicId = result.getId();
                    Log.d(TAG, "Panic trigger SUCCESS, created PanicEvent ID: " + createdPanicId);
                } else {
                    Log.w(TAG, "Panic trigger SUCCESS, but response body was null");
                }
                if (isAdded() && tvPanicStatus != null) {
                    tvPanicStatus.setText("PANIC ACTIVE - DISPATCH NOTIFIED");
                    tvPanicStatus.setVisibility(View.VISIBLE);
                }
                if (getActivity() instanceof PanicListener) {
                    ((PanicListener) getActivity()).onPanicSent();
                }
            }

            @Override
            public void onError(Throwable error) {
                Log.e(TAG, "Panic trigger failed: " + error.getMessage(), error);
                if (allowRetryShift) {
                    Context ctx = getActivity() != null ? getActivity().getApplicationContext() : null;
                    if (ctx != null) {
                        PrefsManager prefs = new PrefsManager(ctx);
                        RetrofitShiftRepository shiftRepo = new RetrofitShiftRepository(prefs, ctx);
                        shiftRepo.startShift(lat, lon, new Callback<Shift>() {
                            @Override
                            public void onSuccess(Shift shift) {
                                prefs.setShiftActive(true);
                                executeTrigger(lat, lon, accuracy, battery, false);
                            }

                            @Override
                            public void onError(Throwable startError) {
                                Log.e(TAG, "Retry shift start failed: " + startError.getMessage(), startError);
                            }
                        });
                    }
                }
            }
        });
    }

    private Integer getBatteryLevel(Context context) {
        try {
            BatteryManager batteryManager = (BatteryManager) context.getSystemService(Context.BATTERY_SERVICE);
            if (batteryManager != null) {
                int level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                if (level >= 0) return level;
            }
        } catch (Exception ignored) {}
        return null;
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(Bundle savedInstanceState) {
        setCancelable(false);
        Dialog dialog = new Dialog(requireContext(), R.style.Theme_OfficerApp_FullscreenDialog);
        View view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_panic_alert, null, false);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(view);
        dialog.setCancelable(false);

        tvPanicStatus = view.findViewById(R.id.tvPanicStatus);
        Button btnCancelAlert = view.findViewById(R.id.btnCancelAlert);

        countDownTimer = new CountDownTimer(AUTO_DISMISS_MILLIS, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                long secondsLeft = (millisUntilFinished + 999) / 1000;
                btnCancelAlert.setText(getString(R.string.panic_cancel_button, secondsLeft));
            }

            @Override
            public void onFinish() {
                if (isAdded()) dismissAllowingStateLoss();
            }
        }.start();

        btnCancelAlert.setOnClickListener(v -> {
            if (createdPanicId > 0 && panicRepository != null) {
                panicRepository.cancelPanic(createdPanicId, new Callback<PanicEventResponse>() {
                    @Override
                    public void onSuccess(PanicEventResponse result) {
                        Log.d(TAG, "Panic alert cancelled successfully");
                    }

                    @Override
                    public void onError(Throwable error) {
                        Log.e(TAG, "Failed to cancel panic alert", error);
                    }
                });
            }
            dismiss();
        });

        return dialog;
    }

    @Override
    public void onDestroyView() {
        if (countDownTimer != null) countDownTimer.cancel();
        super.onDestroyView();
    }
}
