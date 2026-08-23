package com.municipalpolice.officerapp.ui.dialogs;

import android.app.Dialog;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.widget.EditText;

import androidx.annotation.NonNull;
import androidx.fragment.app.DialogFragment;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.ui.missiondetail.MissionDetailActivity;

/** Confirmation dialog for cancelling a mission, requires a short reason for dispatch. */
public class CancelMissionDialogFragment extends DialogFragment {

    public static CancelMissionDialogFragment newInstance() {
        return new CancelMissionDialogFragment();
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(Bundle savedInstanceState) {
        Dialog dialog = new Dialog(requireContext(), R.style.Theme_OfficerApp_FullscreenDialog);
        View view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_cancel_mission, null, false);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(view);

        EditText etReason = view.findViewById(R.id.etReason);
        view.findViewById(R.id.btnKeep).setOnClickListener(v -> dismiss());
        view.findViewById(R.id.btnConfirmCancel).setOnClickListener(v -> {
            String reason = etReason.getText().toString();
            if (getActivity() instanceof MissionDetailActivity) {
                ((MissionDetailActivity) getActivity()).onMissionCancelConfirmed(reason);
            }
            dismiss();
        });
        return dialog;
    }
}
