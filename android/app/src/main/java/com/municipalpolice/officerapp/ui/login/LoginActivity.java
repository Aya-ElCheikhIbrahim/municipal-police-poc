package com.municipalpolice.officerapp.ui.login;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.shift.ShiftActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

/** Screen "1 - Login". Accounts are supervisor-created; there's no self sign-up (see footnote). */
public class LoginActivity extends BaseActivity {

    private EditText etUsername;
    private EditText etPassword;
    private Button btnLogin;
    private PrefsManager prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        prefs = new PrefsManager(this);

        etUsername = findViewById(R.id.etUsername);
        etPassword = findViewById(R.id.etPassword);
        btnLogin = findViewById(R.id.btnLogin);

        btnLogin.setOnClickListener(v -> attemptLogin());

        // Skip straight to the shift screen if a session is already cached
        if (prefs.isLoggedIn() && RetrofitAuthRepository.getInstance(prefs).getCachedOfficer() != null) {
            goToShift();
        }
    }

    private void attemptLogin() {
        String username = etUsername.getText().toString();
        String password = etPassword.getText().toString();

        btnLogin.setEnabled(false);
        RetrofitAuthRepository.getInstance(prefs).login(username, password, new Callback<Officer>() {
            @Override
            public void onSuccess(Officer result) {
                btnLogin.setEnabled(true);
                goToShift();
            }

            @Override
            public void onError(Throwable error) {
                btnLogin.setEnabled(true);
                Toast.makeText(LoginActivity.this, "Login failed: check your credentials and connection", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void goToShift() {
        startActivity(new Intent(this, ShiftActivity.class));
        finish();
    }
}
