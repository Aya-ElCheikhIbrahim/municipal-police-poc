package com.municipalpolice.officerapp.ui.shift;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
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
import com.municipalpolice.officerapp.service.LocationService;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.EndShiftDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.ui.settings.SettingsActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

public class ShiftActivity extends BaseActivity implements EndShiftDialogFragment.EndShiftListener, PanicAlertDialogFragment.PanicListener {

    private static final String TAG = "ShiftActivity";

    private static final int PAGE_OFF_DUTY = 0;

    private ViewFlipper flipper;
    private TextView tvTopBarTitle;
    private TextView tvStatusPill;

    private ShiftRepository shiftRepository;
    private PrefsManager prefs;
    private RealLocationTracker locationTracker;

    // The shift starts either way; startShift() only tracks if it was granted.
    private final ActivityResultLauncher<String> locationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestPermission(),
                    granted -> startShift()
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
        findViewById(R.id.btnStartShift).setOnClickListener(v -> requestLocationThenStartShift());

        setupPanicButton();

        renderOffDuty();

        if (prefs.isShiftActive()) {
            navigateToMissions();
        }
    }

    /*
     * Ask before starting the shift: startShift() finishes this activity,
     * and a permission result delivered after that is dropped.
     */
    private void requestLocationThenStartShift() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            startShift();
        } else {
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
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
            startLocationService();
        }
    }

    private void startLocationService() {
        Intent serviceIntent = new Intent(this, LocationService.class);
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (IllegalStateException e) {
            // ForegroundServiceStartNotAllowedException: the officer left the app
            // before the start-shift response. MissionListActivity.onStart() retries.
            Log.w(TAG, "Could not start LocationService", e);
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
    }

    @Override
    public void onPanicSent() {
        Toast.makeText(this, getString(R.string.panic_toast_sent), Toast.LENGTH_LONG).show();

        TextView tv = findViewById(R.id.tvPanicButtonText);
        if (tv != null) {
            tv.setText(getString(R.string.panic_title));
        }
    }
}
