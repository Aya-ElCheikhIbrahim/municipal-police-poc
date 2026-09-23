package com.municipalpolice.officerapp.ui.login;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.Toast;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

public class ForgotPasswordActivity extends BaseActivity {

    private EditText etBadgeNumber;
    private Button btnNext;
    private ImageButton btnBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_forgot_password);

        btnBack = findViewById(R.id.btnBack);
        etBadgeNumber = findViewById(R.id.etBadgeNumber);
        btnNext = findViewById(R.id.btnNext);

        btnBack.setOnClickListener(v -> finish());

        btnNext.setOnClickListener(v -> {
            String badge = etBadgeNumber.getText().toString().trim();
            if (badge.isEmpty()) {
                Toast.makeText(this, R.string.forgot_password_error_required, Toast.LENGTH_SHORT).show();
                return;
            }

            btnNext.setEnabled(false);
            PrefsManager prefs = new PrefsManager(this);
            RetrofitAuthRepository.getInstance(prefs).requestPasswordReset(badge, new Callback<Void>() {
                @Override
                public void onSuccess(Void result) {
                    btnNext.setEnabled(true);
                    navigateToConfirm(badge);
                }

                @Override
                public void onError(Throwable error) {
                    btnNext.setEnabled(true);
                    // Proceed to confirmation screen so officer can enter code received from web/supervisor
                    navigateToConfirm(badge);
                }
            });
        });
    }

    private void navigateToConfirm(String badge) {
        Intent intent = new Intent(ForgotPasswordActivity.this, PasswordResetConfirmActivity.class);
        intent.putExtra("badge_number", badge);
        startActivity(intent);
        finish();
    }
}
