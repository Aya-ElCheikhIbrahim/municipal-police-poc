package com.municipalpolice.officerapp.ui.dialogs;

import android.app.Dialog;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;

import androidx.annotation.NonNull;
import androidx.fragment.app.DialogFragment;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.ui.shift.ShiftActivity;

/** Confirmation dialog for "screen 7 - End shift". */
public class EndShiftDialogFragment extends DialogFragment {

    public static EndShiftDialogFragment newInstance() {
        return new EndShiftDialogFragment();
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(Bundle savedInstanceState) {
        Dialog dialog = new Dialog(requireContext(), R.style.Theme_OfficerApp_FullscreenDialog);
        View view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_end_shift, null, false);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(view);

        view.findViewById(R.id.btnStay).setOnClickListener(v -> dismiss());
        view.findViewById(R.id.btnEnd).setOnClickListener(v -> {
            if (getActivity() instanceof ShiftActivity) {
                ((ShiftActivity) getActivity()).onEndShiftConfirmed();
            }
            dismiss();
        });
        return dialog;
    }
}
