package com.municipalpolice.officerapp.ui.login;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

public class ForgotPasswordActivity extends BaseActivity {

    private EditText etBadgeNumber;
    private EditText etResetCode;
    private EditText etNewPassword;
    private EditText etRepeatPassword;
    private TextView tvErrorBanner;
    private Button btnSetNewPassword;
    private ImageButton btnBack;

    private int attemptCount = 0;
    private long blockedUntilTimestamp = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_forgot_password);

        btnBack = findViewById(R.id.btnBack);
        etBadgeNumber = findViewById(R.id.etBadgeNumber);
        etResetCode = findViewById(R.id.etResetCode);
        etNewPassword = findViewById(R.id.etNewPassword);
        etRepeatPassword = findViewById(R.id.etRepeatPassword);
        tvErrorBanner = findViewById(R.id.tvErrorBanner);
        btnSetNewPassword = findViewById(R.id.btnSetNewPassword);

        // Initially hide error banner
        tvErrorBanner.setVisibility(View.GONE);

        btnBack.setOnClickListener(v -> finish());

        btnSetNewPassword.setOnClickListener(v -> {
            long currentTimestamp = SystemClock.elapsedRealtime();
            if (currentTimestamp < blockedUntilTimestamp) {
                Toast.makeText(this, R.string.forgot_password_error_blocked, Toast.LENGTH_SHORT).show();
                return;
            }

            String badge = etBadgeNumber.getText().toString().trim();
            String code = etResetCode.getText().toString().trim();
            String newPassword = etNewPassword.getText().toString().trim();
            String repeatPassword = etRepeatPassword.getText().toString().trim();

            if (badge.isEmpty() || code.isEmpty() || newPassword.isEmpty() || repeatPassword.isEmpty()) {
                Toast.makeText(this, R.string.forgot_password_error_required, Toast.LENGTH_SHORT).show();
                return;
            }

            if (!newPassword.equals(repeatPassword)) {
                Toast.makeText(this, "Passwords do not match", Toast.LENGTH_SHORT).show();
                return;
            }

            if (newPassword.length() < 8) {
                Toast.makeText(this, "Password must be at least 8 characters", Toast.LENGTH_SHORT).show();
                return;
            }

            btnSetNewPassword.setEnabled(false);
            PrefsManager prefs = new PrefsManager(this);
            RetrofitAuthRepository.getInstance(prefs).confirmPasswordReset(badge, code, newPassword, new Callback<Void>() {
                @Override
                public void onSuccess(Void result) {
                    btnSetNewPassword.setEnabled(true);
                    tvErrorBanner.setVisibility(View.GONE);
                    attemptCount = 0;
                    Toast.makeText(ForgotPasswordActivity.this, R.string.forgot_password_success, Toast.LENGTH_LONG).show();
                    finish();
                }

                @Override
                public void onError(Throwable error) {
                    btnSetNewPassword.setEnabled(true);
                    tvErrorBanner.setVisibility(View.VISIBLE);
                    attemptCount++;
                    if (attemptCount >= 5) {
                        blockedUntilTimestamp = SystemClock.elapsedRealtime() + 60000; // 1 minute lockout
                        Toast.makeText(ForgotPasswordActivity.this, R.string.forgot_password_error_blocked, Toast.LENGTH_LONG).show();
                    } else {
                        String errMsg = getString(R.string.forgot_password_error_failed, 5 - attemptCount);
                        Toast.makeText(ForgotPasswordActivity.this, errMsg, Toast.LENGTH_LONG).show();
                    }
                }
            });
        });
    }
}
