package com.municipalpolice.officerapp.ui.login;

import android.os.Bundle;
import android.os.SystemClock;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.Toast;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

public class PasswordResetConfirmActivity extends BaseActivity {

    private EditText etCode;
    private EditText etNewPassword;
    private Button btnSubmitPassword;
    private ImageButton btnBack;

    private String badgeNumber;
    private int attemptCount = 0;
    private long blockedUntilTimestamp = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_password_reset_confirm);

        badgeNumber = getIntent().getStringExtra("badge_number");
        if (badgeNumber == null) {
            badgeNumber = "";
        }

        btnBack = findViewById(R.id.btnBack);
        etCode = findViewById(R.id.etCode);
        etNewPassword = findViewById(R.id.etNewPassword);
        btnSubmitPassword = findViewById(R.id.btnSubmitPassword);

        btnBack.setOnClickListener(v -> finish());

        btnSubmitPassword.setOnClickListener(v -> {
            long currentTimestamp = SystemClock.elapsedRealtime();
            if (currentTimestamp < blockedUntilTimestamp) {
                Toast.makeText(this, R.string.forgot_password_error_blocked, Toast.LENGTH_SHORT).show();
                return;
            }

            String code = etCode.getText().toString().trim();
            String newPassword = etNewPassword.getText().toString().trim();

            if (code.isEmpty() || newPassword.isEmpty()) {
                Toast.makeText(this, R.string.forgot_password_error_required, Toast.LENGTH_SHORT).show();
                return;
            }

            if (newPassword.length() < 8) {
                Toast.makeText(this, "Password must be at least 8 characters", Toast.LENGTH_SHORT).show();
                return;
            }

            btnSubmitPassword.setEnabled(false);
            PrefsManager prefs = new PrefsManager(this);
            RetrofitAuthRepository.getInstance(prefs).confirmPasswordReset(badgeNumber, code, newPassword, new Callback<Void>() {
                @Override
                public void onSuccess(Void result) {
                    btnSubmitPassword.setEnabled(true);
                    Toast.makeText(PasswordResetConfirmActivity.this, R.string.forgot_password_success, Toast.LENGTH_LONG).show();
                    finishAffinity(); // Clear stack back to login
                }

                @Override
                public void onError(Throwable error) {
                    btnSubmitPassword.setEnabled(true);
                    attemptCount++;
                    if (attemptCount >= 5) {
                        blockedUntilTimestamp = SystemClock.elapsedRealtime() + 60000; // 1 minute lockout
                        Toast.makeText(PasswordResetConfirmActivity.this, R.string.forgot_password_error_blocked, Toast.LENGTH_LONG).show();
                    } else {
                        String errMsg = getString(R.string.forgot_password_error_failed, 5 - attemptCount);
                        Toast.makeText(PasswordResetConfirmActivity.this, errMsg, Toast.LENGTH_LONG).show();
                    }
                }
            });
        });
    }
}
