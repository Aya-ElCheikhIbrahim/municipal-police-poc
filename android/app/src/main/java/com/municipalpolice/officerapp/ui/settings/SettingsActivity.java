package com.municipalpolice.officerapp.ui.settings;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.FakeAuthRepository;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.login.LoginActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

/**
 * Screen "Settings". Language switch is fully wired (persists via
 * PrefsManager + LocaleHelper, applied through BaseActivity#attachBaseContext).
 * "My location history" and "My data" are placeholders — see the TODOs below
 * for where a real backend would supply that data.
 */
public class SettingsActivity extends BaseActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        bindRow(R.id.rowLanguage, R.string.settings_language_label, R.string.settings_language_value,
                v -> LanguageDialogFragment.newInstance().show(getSupportFragmentManager(), "language"));

        bindRow(R.id.rowLocationHistory, R.string.settings_location_history_label,
                R.string.settings_location_history_value, v -> showPlaceholderDialog(
                        R.string.settings_location_history_label, R.string.settings_location_history_value));

        bindRow(R.id.rowMyData, R.string.settings_my_data_label,
                R.string.settings_my_data_value, v -> showPlaceholderDialog(
                        R.string.settings_my_data_label, R.string.settings_my_data_value));

        findViewById(R.id.btnLogout).setOnClickListener(v -> logout());
    }

    private void bindRow(int rowId, int labelRes, int valueRes, View.OnClickListener listener) {
        View row = findViewById(rowId);
        ((TextView) row.findViewById(R.id.tvLabel)).setText(labelRes);
        ((TextView) row.findViewById(R.id.tvValue)).setText(valueRes);
        row.setOnClickListener(listener);
    }

    /**
     * TODO(backend): once a real API exists, "My location history" should open
     * a screen backed by LocationTracker's stored trail, and "My data" should
     * pull the officer's full data export. For this UI mock both just show
     * their description text so the tap target is demonstrable end to end.
     */
    private void showPlaceholderDialog(int titleRes, int bodyRes) {
        new AlertDialog.Builder(this)
                .setTitle(titleRes)
                .setMessage(bodyRes)
                .setPositiveButton(android.R.string.ok, null)
                .show();
    }

    /** Called by LanguageDialogFragment after the officer picks a language. */
    public void onLanguageChanged() {
        recreate();
    }

    private void logout() {
        FakeAuthRepository.getInstance().logout();
        new PrefsManager(this).setLoggedIn(false);
        Intent intent = new Intent(this, LoginActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }
}
