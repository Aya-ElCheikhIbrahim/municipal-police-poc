package com.municipalpolice.officerapp.ui.dialogs;

import android.app.Dialog;
import android.os.Bundle;
import android.os.CountDownTimer;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.fragment.app.DialogFragment;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.ui.shift.ShiftActivity;

/** "Panic active" confirmation for the hold-2-seconds panic button, screen "Panic sent". */
public class PanicAlertDialogFragment extends DialogFragment {

    private static final long AUTO_DISMISS_MILLIS = 10_000;
    private CountDownTimer countDownTimer;

    public static PanicAlertDialogFragment newInstance() {
        return new PanicAlertDialogFragment();
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getActivity() instanceof ShiftActivity) {
            ((ShiftActivity) getActivity()).onPanicSent();
        }
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
