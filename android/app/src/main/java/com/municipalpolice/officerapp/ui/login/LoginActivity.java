package com.municipalpolice.officerapp.ui.login;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.DeviceTokenManager;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.shift.ShiftActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.util.ArrayList;
import java.util.List;

/**
 * Screen "1 - Login".
 * Accounts are supervisor-created; there's no self sign-up.
 */
public class LoginActivity extends BaseActivity {

    private EditText etUsername;
    private EditText etPassword;
    private Button btnLogin;
    private Button btnForgotPassword;

    private final ActivityResultLauncher<String[]> permissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    result -> {
                        // Permissions handled.
                        // We could check if location was denied
                        // and show a warning.
                    }
            );

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_login);

        etUsername =
                findViewById(R.id.etUsername);

        etPassword =
                findViewById(R.id.etPassword);

        btnLogin =
                findViewById(R.id.btnLogin);

        btnForgotPassword =
                findViewById(R.id.btnForgotPassword);

        btnLogin.setOnClickListener(
                v -> attemptLogin()
        );

        btnForgotPassword.setOnClickListener(
                v -> showForgotPasswordMessage()
        );

        // -----------------------------------------------------
        // EXISTING SESSION
        // -----------------------------------------------------

        /*
         * If the officer is already logged in,
         * register the current Firebase token again.
         *
         * The backend endpoint is idempotent, so registering
         * the same token again does not create duplicates.
         */

        PrefsManager prefs =
                new PrefsManager(this);

        if (prefs.isLoggedIn()
                && RetrofitAuthRepository
                .getInstance(prefs)
                .getCachedOfficer() != null) {

            DeviceTokenManager.registerCurrentToken(
                    this
            );

            goToShift();
        }

        // -----------------------------------------------------
        // PERMISSIONS
        // -----------------------------------------------------

        checkAndRequestPermissions();
    }

    // =========================================================
    // PERMISSIONS
    // =========================================================

    private void checkAndRequestPermissions() {

        List<String> permissions =
                new ArrayList<>();

        permissions.add(
                Manifest.permission.ACCESS_FINE_LOCATION
        );

        permissions.add(
                Manifest.permission.ACCESS_COARSE_LOCATION
        );

        permissions.add(
                Manifest.permission.CAMERA
        );

        /*
         * Android 13+ requires runtime permission
         * before the app can display notifications.
         */
        if (Build.VERSION.SDK_INT
                >= Build.VERSION_CODES.TIRAMISU) {

            permissions.add(
                    Manifest.permission.POST_NOTIFICATIONS
            );
        }

        List<String> listPermissionsNeeded =
                new ArrayList<>();

        for (String permission : permissions) {

            if (ContextCompat.checkSelfPermission(
                    this,
                    permission
            ) != PackageManager.PERMISSION_GRANTED) {

                listPermissionsNeeded.add(
                        permission
                );
            }
        }

        if (!listPermissionsNeeded.isEmpty()) {

            permissionLauncher.launch(
                    listPermissionsNeeded.toArray(
                            new String[0]
                    )
            );
        }
    }

    // =========================================================
    // FORGOT PASSWORD
    // =========================================================

    private void showForgotPasswordMessage() {

        Toast.makeText(
                this,
                R.string.login_forgot_password_msg,
                Toast.LENGTH_LONG
        ).show();
    }

    // =========================================================
    // LOGIN
    // =========================================================

    private void attemptLogin() {

        String username =
                etUsername
                        .getText()
                        .toString()
                        .trim();

        String password =
                etPassword
                        .getText()
                        .toString()
                        .trim();

        if (username.isEmpty()
                || password.isEmpty()) {

            Toast.makeText(
                    this,
                    R.string.login_error_required,
                    Toast.LENGTH_SHORT
            ).show();

            return;
        }

        btnLogin.setEnabled(false);

        PrefsManager prefs =
                new PrefsManager(this);

        RetrofitAuthRepository
                .getInstance(prefs)
                .login(
                        username,
                        password,
                        new Callback<Officer>() {

                            @Override
                            public void onSuccess(
                                    Officer result
                            ) {

                                btnLogin.setEnabled(true);

                                /*
                                 * Login succeeded.
                                 *
                                 * Firebase gives us this device's
                                 * FCM registration token and
                                 * DeviceTokenManager sends it to:
                                 *
                                 * POST /api/v1/device-tokens/
                                 *
                                 * RetrofitClient automatically adds
                                 * the logged-in officer's Bearer token.
                                 */
                                DeviceTokenManager
                                        .registerCurrentToken(
                                                LoginActivity.this
                                        );

                                goToShift();
                            }

                            @Override
                            public void onError(
                                    Throwable error
                            ) {

                                btnLogin.setEnabled(true);

                                Toast.makeText(
                                        LoginActivity.this,
                                        R.string.login_error_incorrect,
                                        Toast.LENGTH_SHORT
                                ).show();
                            }
                        }
                );
    }

    // =========================================================
    // NAVIGATION
    // =========================================================

    private void goToShift() {

        startActivity(
                new Intent(
                        this,
                        ShiftActivity.class
                )
        );

        finish();
    }
}