package com.municipalpolice.officerapp.ui.shift;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.RealLocationTracker;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.data.RetrofitShiftRepository;
import com.municipalpolice.officerapp.data.ShiftRepository;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.EndShiftDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.ui.settings.SettingsActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

public class ShiftActivity extends BaseActivity implements EndShiftDialogFragment.EndShiftListener, PanicAlertDialogFragment.PanicListener {

    private static final int PAGE_OFF_DUTY = 0;

    private ViewFlipper flipper;
    private TextView tvTopBarTitle;
    private TextView tvStatusPill;

    private ShiftRepository shiftRepository;
    private PrefsManager prefs;
    private RealLocationTracker locationTracker;

    private final ActivityResultLauncher<String> locationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestPermission(),
                    granted -> {
                        if (granted && locationTracker != null) {
                            locationTracker.startTracking("shift");
                        }
                    }
            );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_shift);

        flipper = findViewById(R.id.flipper);
        tvTopBarTitle = findViewById(R.id.tvTopBarTitle);
        tvStatusPill = findViewById(R.id.tvStatusPill);

        prefs = new PrefsManager(this);
        shiftRepository = new RetrofitShiftRepository(prefs, this);
        locationTracker = new RealLocationTracker(this);

        Officer officer = RetrofitAuthRepository.getInstance(prefs).getCachedOfficer();
        tvTopBarTitle.setText(officer != null ? officer.getFullName() : getString(R.string.app_name));

        findViewById(R.id.btnSettings).setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));
        findViewById(R.id.btnStartShift).setOnClickListener(v -> startShift());

        View panicButton = findViewById(R.id.btnPanicCircle);
        if (panicButton != null) {
            panicButton.setOnClickListener(v -> {
                if (!prefs.isShiftActive()) {
                    Toast.makeText(this, "Please start a shift before pressing the panic button.", Toast.LENGTH_LONG).show();
                    return;
                }
                PanicAlertDialogFragment.newInstance().show(getSupportFragmentManager(), "panic");
            });
        }

        renderOffDuty();

        if (prefs.isShiftActive()) {
            navigateToMissions();
        }
    }

    private void startShift() {
        shiftRepository.startShift(null, null, new Callback<Shift>() {
            @Override
            public void onSuccess(Shift result) {
                prefs.setShiftActive(true);
                startLocationTrackingIfAllowed();
                navigateToMissions();
            }

            @Override
            public void onError(Throwable error) {
                Toast.makeText(ShiftActivity.this, "Failed to start shift: " + error.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void navigateToMissions() {
        Intent intent = new Intent(this, MissionListActivity.class);
        startActivity(intent);
        finish();
    }

    private void startLocationTrackingIfAllowed() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            locationTracker.startTracking("shift");
        } else {
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
        }
    }

    private void renderOffDuty() {
        flipper.setDisplayedChild(PAGE_OFF_DUTY);
        setOnlineStatusPill();
    }

    private void setOnlineStatusPill() {
        tvStatusPill.setText(R.string.status_online);
        tvStatusPill.setBackgroundResource(R.drawable.pill_active);
    }

    @Override
    public void onEndShiftConfirmed() {
        // Redirect to mission list end shift logic if needed, 
        // but ShiftActivity is now off-duty state only.
    }

    @Override
    public void onPanicSent() {
        Toast.makeText(this, "PANIC ACTIVE - DISPATCH NOTIFIED", Toast.LENGTH_LONG).show();

        View panicButton = findViewById(R.id.btnPanicCircle);
        if (panicButton instanceof android.widget.ImageView) {
            ((android.widget.ImageView) panicButton).setColorFilter(
                    androidx.core.content.ContextCompat.getColor(this, R.color.urgent_alert)
            );
        }
    }
}
