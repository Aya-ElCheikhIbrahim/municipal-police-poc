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

        /** The alert never reached dispatch. No-op by default; the dialog shows its own message. */
        default void onPanicFailed(String reason) {}
    }

    private static final long AUTO_DISMISS_MILLIS = 10_000;
    private CountDownTimer countDownTimer;
    private RetrofitPanicRepository panicRepository;
    private TextView tvPanicStatus;
    private int createdPanicId = -1;
    /** Officer hit cancel before the trigger response landed; cancel as soon as the id arrives. */
    private boolean pendingCancel = false;

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

        // TODO(product): decide what a panic with no usable location should do. The backend
        // requires latitude and longitude, so for now the press fails visibly instead of
        // sending a placeholder position, which would put the officer on the dispatcher map
        // in the wrong city while looking like it worked. Options to weigh: hold the alert
        // until a fix arrives, or let the backend accept a coordinate-less alert pinned to
        // the last location ping of that shift.
        if (!fineGranted && !coarseGranted) {
            Log.w(TAG, "Location permission not granted; cannot trigger panic");
            failPanic("Location permission is required to send a panic alert.");
            return;
        }

        Integer batteryLevel = getBatteryLevel(context);

        try {
            FusedLocationProviderClient fusedClient = LocationServices.getFusedLocationProviderClient(context);
            fusedClient.getLastLocation().addOnSuccessListener(location -> {
                if (location == null || (location.getLatitude() == 0.0 && location.getLongitude() == 0.0)) {
                    Log.w(TAG, "No usable last known location; refusing to send a panic without coordinates");
                    failPanic("No location fix yet. Move into the open and try again.");
                    return;
                }

                double lat = location.getLatitude();
                double lon = location.getLongitude();
                float accuracy = location.getAccuracy();
                Log.d(TAG, "Acquired location: lat=" + lat + ", lon=" + lon + ", acc=" + accuracy);

                ensureShiftAndTrigger(context, lat, lon, accuracy, batteryLevel);
            }).addOnFailureListener(e -> {
                Log.e(TAG, "Failed to read last known location", e);
                failPanic("Could not read your location. Try again.");
            });
        } catch (Exception e) {
            Log.e(TAG, "Location provider error", e);
            failPanic("Could not read your location. Try again.");
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

                // This can land after the dialog is gone, so it must not assume a live view.
                if (pendingCancel) {
                    pendingCancel = false;
                    if (createdPanicId > 0) {
                        Log.d(TAG, "Honouring the cancel the officer requested before the id arrived");
                        sendCancel(createdPanicId);
                    } else {
                        Log.e(TAG, "Cancel was requested but the response carried no usable id; the alert stays live on dispatch");
                    }
                    return;
                }

                if (isAdded() && tvPanicStatus != null) {
                    tvPanicStatus.setText("PANIC ACTIVE - DISPATCH NOTIFIED");
                    tvPanicStatus.setVisibility(View.VISIBLE);
                }
                if (isAdded() && getActivity() instanceof PanicListener) {
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
                                failPanic("Panic alert failed to send. Call dispatch by radio.");
                            }
                        });
                        return;
                    }
                }
                failPanic("Panic alert failed to send. Call dispatch by radio.");
            }
        });
    }

    /** Fires cancel for an alert that is already on the dispatcher board. */
    private void sendCancel(int panicId) {
        if (panicRepository == null) {
            Log.e(TAG, "No repository available to cancel panic " + panicId + "; the alert stays live on dispatch");
            return;
        }
        panicRepository.cancelPanic(panicId, new Callback<PanicEventResponse>() {
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

    /** Nothing reached dispatch: say so on screen instead of letting the dialog close silently. */
    private void failPanic(String reason) {
        // No alert was created, so a cancel the officer asked for has nothing to act on.
        pendingCancel = false;
        if (isAdded() && tvPanicStatus != null) {
            tvPanicStatus.setText("PANIC NOT SENT - " + reason);
            tvPanicStatus.setVisibility(View.VISIBLE);
        }
        Context context = getContext();
        if (context != null) {
            Toast.makeText(context, reason, Toast.LENGTH_LONG).show();
        }
        if (getActivity() instanceof PanicListener) {
            ((PanicListener) getActivity()).onPanicFailed(reason);
        }
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
            if (createdPanicId > 0) {
                sendCancel(createdPanicId);
            } else {
                // The trigger response has not come back yet. Remember the intent: the
                // trigger callback cancels the alert as soon as it learns the id, whether
                // or not this dialog is still around.
                pendingCancel = true;
                Log.d(TAG, "Cancel requested before the panic id arrived; queued until the trigger responds");
            }
            dismiss();
        });

        return dialog;
    }

    @Override
    public void onDestroyView() {
        if (countDownTimer != null) countDownTimer.cancel();
        // The trigger request is left running on purpose: the officer stops watching this
        // screen, and aborting the POST here would turn a slow panic into no panic. Drop
        // the view reference instead, so a late callback cannot touch a destroyed view.
        tvPanicStatus = null;
        super.onDestroyView();
    }
}
