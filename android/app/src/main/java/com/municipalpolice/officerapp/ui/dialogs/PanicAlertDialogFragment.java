package com.municipalpolice.officerapp.ui.dialogs;

import android.Manifest;
import android.app.Dialog;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.DialogFragment;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.RetrofitPanicRepository;

/** "Panic active" confirmation for the hold-2-seconds panic button, screen "Panic sent". */
public class PanicAlertDialogFragment extends DialogFragment {

    public interface PanicListener {
        void onPanicSent();
    }

    private static final long AUTO_DISMISS_MILLIS = 10_000;
    private CountDownTimer countDownTimer;
    private RetrofitPanicRepository panicRepository;
    private FusedLocationProviderClient fusedLocationClient;

    public static PanicAlertDialogFragment newInstance() {
        return new PanicAlertDialogFragment();
    }

    @Override
    public void onStart() {
        super.onStart();
        
        panicRepository = new RetrofitPanicRepository(requireContext());
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireContext());

        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
                if (location != null) {
                    sendPanicWithLocation(location.getLatitude(), location.getLongitude());
                } else {
                    sendPanicWithLocation(null, null);
                }
            }).addOnFailureListener(e -> sendPanicWithLocation(null, null));
        } else {
            sendPanicWithLocation(null, null);
        }
    }

    private void sendPanicWithLocation(Double lat, Double lon) {
        panicRepository.triggerPanic(lat, lon, new Callback<Object>() {
            @Override
            public void onSuccess(Object result) {
                if (getActivity() instanceof PanicListener) {
                    ((PanicListener) getActivity()).onPanicSent();
                }
            }
            @Override
            public void onError(Throwable error) {
                // Silent fail or handled by the caller
            }
        });
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

        btnCancelAlert.setOnClickListener(v -> dismiss());
        return dialog;
    }

    @Override
    public void onDestroyView() {
        if (countDownTimer != null) countDownTimer.cancel();
        super.onDestroyView();
    }
}
