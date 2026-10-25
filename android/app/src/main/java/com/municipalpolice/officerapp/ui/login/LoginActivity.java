package com.municipalpolice.officerapp.ui.login;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.DeviceTokenManager;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.notifications.PanicAlert;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.shift.ShiftActivity;
import com.municipalpolice.officerapp.util.PrefsManager;
import com.municipalpolice.officerapp.util.SessionExpiry;

import java.util.ArrayList;
import java.util.List;

/** Screen "1 - Login". Accounts are supervisor-created; there's no self sign-up (see footnote). */
public class LoginActivity extends BaseActivity {

    private EditText etUsername;
    private EditText etPassword;
    private TextView tvPasswordError;
    private Button btnLogin;
    private Button btnForgotPassword;

    private final ActivityResultLauncher<String[]> permissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                // Permissions handled. We could check if location was denied and show a warning.
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        etUsername = findViewById(R.id.etUsername);
        etPassword = findViewById(R.id.etPassword);
        tvPasswordError = findViewById(R.id.tvPasswordError);
        btnLogin = findViewById(R.id.btnLogin);
        btnForgotPassword = findViewById(R.id.btnForgotPassword);

        TextWatcher clearErrorWatcher = new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (tvPasswordError != null && tvPasswordError.getVisibility() != View.GONE) {
                    tvPasswordError.setVisibility(View.GONE);
                }
            }

            @Override
            public void afterTextChanged(Editable s) {}
        };

        etUsername.addTextChangedListener(clearErrorWatcher);
        etPassword.addTextChangedListener(clearErrorWatcher);

        btnLogin.setOnClickListener(v -> attemptLogin());
        btnForgotPassword.setOnClickListener(v -> startForgotPasswordActivity());

        // This is the launcher, so a tapped panic notification that Android's
        // FCM SDK displayed (app backgrounded or killed) lands here with the
        // push data as extras. The activity is exported, so any app could
        // send the same extras: they only choose which screen opens. The
        // alert is remembered (ongoing notification) by PanicDetailActivity
        // once the backend has confirmed it, never from these extras.
        PanicAlert panic = PanicAlert.fromExtras(getIntent().getExtras());

        // Skip straight to the shift screen if a session is already cached
        if (hasCachedSession()) {
            DeviceTokenManager.registerCurrentToken(this);
            goToShift();
        } else if (panic != null && savedInstanceState == null) {
            Toast.makeText(this, R.string.panic_login_to_view, Toast.LENGTH_LONG).show();
        }

        // Sent here because the session could no longer be refreshed.
        // Only on first creation, so a rotation doesn't repeat the message.
        if (savedInstanceState == null
                && getIntent().getBooleanExtra(SessionExpiry.EXTRA_SESSION_EXPIRED, false)) {
            Toast.makeText(this, R.string.session_expired_message, Toast.LENGTH_LONG).show();
        }

        checkAndRequestPermissions();
    }

    /**
     * launchMode is singleTop, so a panic notification tapped while this
     * screen is already on top arrives here instead of in onCreate.
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        PanicAlert panic = PanicAlert.fromExtras(intent.getExtras());
        if (panic == null) return;

        // goToShift() reads getIntent() after login. Replaced only for a
        // panic, so an unrelated tap can't drop one that is waiting.
        setIntent(intent);

        if (hasCachedSession()) {
            goToShift();
        } else {
            Toast.makeText(this, R.string.panic_login_to_view, Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected boolean requiresLogin() {
        return false;
    }

    private boolean hasCachedSession() {
        PrefsManager prefs = new PrefsManager(this);
        return prefs.isLoggedIn() && RetrofitAuthRepository.getInstance(prefs).getCachedOfficer() != null;
    }

    private void checkAndRequestPermissions() {
        List<String> permissions = new ArrayList<>();
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        permissions.add(Manifest.permission.CAMERA);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        List<String> listPermissionsNeeded = new ArrayList<>();
        for (String p : permissions) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                listPermissionsNeeded.add(p);
            }
        }

        if (!listPermissionsNeeded.isEmpty()) {
            permissionLauncher.launch(listPermissionsNeeded.toArray(new String[0]));
        }
    }

    private void startForgotPasswordActivity() {
        startActivity(new Intent(this, ForgotPasswordActivity.class));
    }

    private void attemptLogin() {
        String username = etUsername.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        tvPasswordError.setVisibility(View.GONE);

        if (username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, R.string.login_error_required, Toast.LENGTH_SHORT).show();
            return;
        }

        btnLogin.setEnabled(false);
        PrefsManager prefs = new PrefsManager(this);
        RetrofitAuthRepository.getInstance(prefs).login(username, password, new Callback<Officer>() {
            @Override
            public void onSuccess(Officer result) {
                SessionExpiry.reset();
                btnLogin.setEnabled(true);
                DeviceTokenManager.registerCurrentToken(LoginActivity.this);
                goToShift();
            }

            @Override
            public void onError(Throwable error) {
                btnLogin.setEnabled(true);
                tvPasswordError.setVisibility(View.VISIBLE);
            }
        });
    }

    /**
     * Leaves the login screen, after a login or with a cached session. A panic
     * that brought the officer here (held on this activity's intent while
     * they logged in) opens now, on top of the shift screen so Back still
     * leads somewhere. If the app was already running underneath, the panic
     * screen goes on top of where they were instead of a second shift screen.
     */
    private void goToShift() {
        Intent shift = new Intent(this, ShiftActivity.class);
        PanicAlert panic = PanicAlert.fromExtras(getIntent().getExtras());
        if (panic == null) {
            startActivity(shift);
        } else if (isTaskRoot()) {
            startActivities(new Intent[]{shift, panic.detailIntent(this)});
        } else {
            startActivity(panic.detailIntent(this));
        }
        finish();
    }
}
