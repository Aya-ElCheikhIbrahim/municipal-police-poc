package com.municipalpolice.officerapp.ui.settings;

import android.app.Dialog;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.Window;
import android.widget.RadioButton;
import android.widget.RadioGroup;

import androidx.annotation.NonNull;
import androidx.fragment.app.DialogFragment;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.util.LocaleHelper;

/** Language picker shown from the Settings "Language" row. */
public class LanguageDialogFragment extends DialogFragment {

    public static LanguageDialogFragment newInstance() {
        return new LanguageDialogFragment();
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(Bundle savedInstanceState) {
        Dialog dialog = new Dialog(requireContext(), R.style.Theme_OfficerApp_FullscreenDialog);
        View view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_language, null, false);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(view);

        RadioGroup radioGroup = view.findViewById(R.id.radioGroupLanguage);
        RadioButton radioEnglish = view.findViewById(R.id.radioEnglish);
        RadioButton radioArabic = view.findViewById(R.id.radioArabic);

        String current = LocaleHelper.getAppLanguage(requireContext());
        if (LocaleHelper.LANG_ARABIC.equals(current)) {
            radioArabic.setChecked(true);
        } else {
            radioEnglish.setChecked(true);
        }

        view.findViewById(R.id.btnApplyLanguage).setOnClickListener(v -> {
            String selected = radioGroup.getCheckedRadioButtonId() == R.id.radioArabic
                    ? LocaleHelper.LANG_ARABIC : LocaleHelper.LANG_ENGLISH;
            LocaleHelper.setAppLanguage(requireContext(), selected);
            dismiss();
            if (getActivity() instanceof SettingsActivity) {
                ((SettingsActivity) getActivity()).onLanguageChanged();
            }
        });

        return dialog;
    }
}
