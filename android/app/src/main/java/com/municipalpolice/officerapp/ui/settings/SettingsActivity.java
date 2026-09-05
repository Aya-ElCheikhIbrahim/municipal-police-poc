package com.municipalpolice.officerapp.ui.settings;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.login.LoginActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.util.List;

/**
 * Settings screen.
 *
 * Important logout behavior:
 *
 * 1. We first contact the backend to verify that the current
 *    authentication session still works.
 *
 * 2. If authentication works and a shift is locally active,
 *    logout remains blocked.
 *
 * 3. If Django returns 401 and the refresh token can no longer
 *    recover the session, the local session is stale. In that case
 *    we allow recovery back to Login instead of trapping the officer.
 *
 * 4. Room/offline location data is NOT deleted by logout.
 */
public class SettingsActivity extends BaseActivity {

    private PrefsManager prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        prefs = new PrefsManager(this);

        // ---------------------------------------------------------
        // BACK
        // ---------------------------------------------------------

        findViewById(R.id.btnBack)
                .setOnClickListener(v -> finish());

        // ---------------------------------------------------------
        // OFFICER ID
        // ---------------------------------------------------------

        bindRow(
                R.id.rowOfficerId,
                R.string.settings_officer_id_label,
                0,
                null
        );

        View rowOfficerId =
                findViewById(R.id.rowOfficerId);

        ((TextView) rowOfficerId
                .findViewById(R.id.tvValue))
                .setText(prefs.getUserId());

        rowOfficerId.setClickable(false);
        rowOfficerId.setFocusable(false);

        rowOfficerId
                .findViewById(R.id.ivChevron)
                .setVisibility(View.GONE);

        // ---------------------------------------------------------
        // LANGUAGE
        // ---------------------------------------------------------

        bindRow(
                R.id.rowLanguage,
                R.string.settings_language_label,
                R.string.settings_language_value,
                v -> LanguageDialogFragment
                        .newInstance()
                        .show(
                                getSupportFragmentManager(),
                                "language"
                        )
        );

        // ---------------------------------------------------------
        // LOCATION HISTORY
        // ---------------------------------------------------------

        bindRow(
                R.id.rowLocationHistory,
                R.string.settings_location_history_label,
                R.string.settings_location_history_value,
                v -> showPlaceholderDialog(
                        R.string.settings_location_history_label,
                        R.string.settings_location_history_value
                )
        );

        // ---------------------------------------------------------
        // MY DATA
        // ---------------------------------------------------------

        bindRow(
                R.id.rowMyData,
                R.string.settings_my_data_label,
                R.string.settings_my_data_value,
                v -> showPlaceholderDialog(
                        R.string.settings_my_data_label,
                        R.string.settings_my_data_value
                )
        );

        // ---------------------------------------------------------
        // LOGOUT
        // ---------------------------------------------------------

        findViewById(R.id.btnLogout)
                .setOnClickListener(v -> logout());
    }

    // ---------------------------------------------------------
    // SETTINGS ROW
    // ---------------------------------------------------------

    private void bindRow(
            int rowId,
            int labelRes,
            int valueRes,
            View.OnClickListener listener
    ) {

        View row =
                findViewById(rowId);

        ((TextView) row
                .findViewById(R.id.tvLabel))
                .setText(labelRes);

        if (valueRes != 0) {

            ((TextView) row
                    .findViewById(R.id.tvValue))
                    .setText(valueRes);
        }

        row.setOnClickListener(listener);
    }

    // ---------------------------------------------------------
    // PLACEHOLDER
    // ---------------------------------------------------------

    private void showPlaceholderDialog(
            int titleRes,
            int bodyRes
    ) {

        new AlertDialog.Builder(this)
                .setTitle(titleRes)
                .setMessage(bodyRes)
                .setPositiveButton(
                        android.R.string.ok,
                        null
                )
                .show();
    }

    // ---------------------------------------------------------
    // LANGUAGE
    // ---------------------------------------------------------

    public void onLanguageChanged() {
        recreate();
    }

    // ---------------------------------------------------------
    // LOGOUT
    // ---------------------------------------------------------

    private void logout() {

        /*
         * Do NOT immediately trust prefs.isShiftActive().
         *
         * It may be stale if the access/refresh session has already
         * expired or was revoked by End Shift.
         *
         * First ask Django using the current authenticated repository.
         */
        validateCurrentSession();
    }

    // ---------------------------------------------------------
    // SESSION VALIDATION
    // ---------------------------------------------------------

    private void validateCurrentSession() {

        MissionRepository repository =
                new RetrofitMissionRepository(
                        prefs,
                        this
                );

        AlertDialog loading =
                new AlertDialog.Builder(this)
                        .setMessage(
                                R.string.logout_validation_loading
                        )
                        .setCancelable(false)
                        .show();

        repository.fetchMissions(
                new Callback<List<Mission>>() {

                    @Override
                    public void onSuccess(
                            List<Mission> result
                    ) {

                        loading.dismiss();

                        /*
                         * Backend authentication succeeded.
                         *
                         * Therefore the saved session is usable,
                         * so now we can safely respect shift state.
                         */
                        if (prefs.isShiftActive()) {

                            showActiveShiftDialog();
                            return;
                        }

                        validateMissionState(
                                result
                        );
                    }

                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        loading.dismiss();

                        /*
                         * If the API says 401 even after RetrofitClient's
                         * refresh attempt, the refresh token/session is no
                         * longer usable.
                         *
                         * Do not trap the officer behind a stale
                         * shift_active SharedPreferences value.
                         */
                        if (isUnauthorized(error)) {

                            showExpiredSessionDialog();
                            return;
                        }

                        /*
                         * Network/server problem:
                         *
                         * Fail safely. We do NOT logout because we cannot
                         * verify active shift or mission state.
                         */
                        Toast.makeText(
                                SettingsActivity.this,
                                error != null
                                        ? error.getMessage()
                                        : "Could not verify logout.",
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                }
        );
    }

    // ---------------------------------------------------------
    // SHIFT CHECK
    // ---------------------------------------------------------

    private void showActiveShiftDialog() {

        new AlertDialog.Builder(this)
                .setTitle(
                        R.string.settings_logout_button
                )
                .setMessage(
                        R.string.logout_error_active_shift
                )
                .setPositiveButton(
                        android.R.string.ok,
                        null
                )
                .show();
    }

    // ---------------------------------------------------------
    // MISSION CHECK
    // ---------------------------------------------------------

    private void validateMissionState(
            List<Mission> missions
    ) {

        boolean hasActiveMission =
                false;

        if (missions != null) {

            for (Mission mission : missions) {

                if (mission.getStatus()
                        != MissionStatus.COMPLETED

                        &&

                        mission.getStatus()
                                != MissionStatus.CANCELLED) {

                    hasActiveMission = true;
                    break;
                }
            }
        }

        if (hasActiveMission) {

            new AlertDialog.Builder(this)
                    .setTitle(
                            R.string.settings_logout_button
                    )
                    .setMessage(
                            R.string.logout_error_pending_missions
                    )
                    .setPositiveButton(
                            android.R.string.ok,
                            null
                    )
                    .show();

        } else {

            performFinalLogout();
        }
    }

    // ---------------------------------------------------------
    // EXPIRED / REVOKED SESSION RECOVERY
    // ---------------------------------------------------------

    private void showExpiredSessionDialog() {

        new AlertDialog.Builder(this)
                .setTitle("Session expired")
                .setMessage(
                        "Your saved login session is no longer valid. "
                                + "You can return to the login screen and sign in again. "
                                + "Saved offline work will remain on this phone."
                )
                .setNegativeButton(
                        android.R.string.cancel,
                        null
                )
                .setPositiveButton(
                        "Log in again",
                        (dialog, which) ->
                                performFinalLogout()
                )
                .show();
    }

    // ---------------------------------------------------------
    // 401 DETECTION
    // ---------------------------------------------------------

    private boolean isUnauthorized(
            Throwable error
    ) {

        if (error == null
                || error.getMessage() == null) {

            return false;
        }

        String message =
                error.getMessage();

        /*
         * Your Retrofit repositories currently report HTTP errors
         * as messages such as:
         *
         * "Fetch missions failed: 401"
         *
         * Later this can be upgraded to a typed ApiException.
         */
        return message.contains("401");
    }

    // ---------------------------------------------------------
    // FINAL LOCAL LOGOUT
    // ---------------------------------------------------------

    private void performFinalLogout() {

        /*
         * Clearing SharedPreferences does NOT clear the Room database.
         * Therefore queued offline location pings remain saved.
         */
        RetrofitAuthRepository
                .getInstance(prefs)
                .logout();

        Intent intent =
                new Intent(
                        this,
                        LoginActivity.class
                );

        intent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        |
                        Intent.FLAG_ACTIVITY_CLEAR_TASK
        );

        startActivity(intent);
        finish();
    }
}
