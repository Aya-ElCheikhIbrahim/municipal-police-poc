package com.municipalpolice.officerapp.ui.common;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.util.LocaleHelper;
import com.municipalpolice.officerapp.util.PrefsManager;
import com.municipalpolice.officerapp.util.SessionExpiry;

/**
 * Every screen extends this so the officer's saved language (set from
 * Settings) is applied consistently, including layout direction for Arabic.
 */
public abstract class BaseActivity extends AppCompatActivity {

    @Override
    protected void attachBaseContext(Context newBase) {
        super.attachBaseContext(LocaleHelper.wrap(newBase));
    }

    /**
     * Safety net for a session that died while the app was in the background,
     * when Android blocks SessionExpiry's redirect.
     */
    @Override
    protected void onResume() {
        super.onResume();
        if (requiresLogin() && !new PrefsManager(this).isLoggedIn()) {
            startActivity(SessionExpiry.loginIntent(this));
            finish();
        }
    }

    /**
     * Screens shown before login (LoginActivity, ForgotPasswordActivity)
     * override this to return false, so they never redirect to login.
     */
    protected boolean requiresLogin() {
        return true;
    }

    protected void setupPanicButton() {
        View panicButton = findViewById(R.id.btnPanicCircle);
        if (panicButton == null) return;

        Handler handler = new Handler(Looper.getMainLooper());
        Runnable panicRunnable = () -> {
            PrefsManager prefs = new PrefsManager(this);
            if (!prefs.isShiftActive()) {
                Toast.makeText(this, "Please start a shift before pressing the panic button.", Toast.LENGTH_LONG).show();
                return;
            }
            PanicAlertDialogFragment.newInstance().show(getSupportFragmentManager(), "panic");
        };

        panicButton.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    v.setPressed(true);
                    handler.postDelayed(panicRunnable, 2000);
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    v.setPressed(false);
                    handler.removeCallbacks(panicRunnable);
                    v.performClick();
                    return true;
            }
            return false;
        });
    }
}
