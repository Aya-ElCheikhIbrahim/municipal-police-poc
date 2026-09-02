package com.municipalpolice.officerapp.ui.shift;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.MenuItem;
import android.view.MotionEvent;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import androidx.annotation.NonNull;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.data.RetrofitShiftRepository;
import com.municipalpolice.officerapp.data.ShiftRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.EndShiftDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.ui.settings.SettingsActivity;
import com.municipalpolice.officerapp.util.PrefsManager;
import com.municipalpolice.officerapp.util.TimeFormat;

import java.util.List;

/**
 * Combines mockup screens "2 - Off duty", "3 - On duty", "Syncing" and the
 * "Working offline" variant of on-duty into one activity with a ViewFlipper,
 * since they are the same screen in different connectivity/shift states.
 */
public class ShiftActivity extends BaseActivity {

    private static final int PAGE_OFF_DUTY = 0;
    private static final int PAGE_ON_DUTY = 1;
    private static final int PAGE_SYNCING = 2;

    private static final long PANIC_HOLD_MILLIS = 2000;

    private ViewFlipper flipper;
    private TextView tvTopBarTitle;
    private TextView tvStatusPill;
    private TextView tvShiftTimer;
    private android.widget.LinearLayout groupOfflineNotice;
    private Button btnPanic;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private long shiftStartMillis;
    private boolean onDuty = false;
    private boolean simulatedOffline = false;
    private ShiftRepository shiftRepository;
    private MissionRepository missionRepository;
    private PrefsManager prefs;

    private final Runnable timerTick = new Runnable() {
        @Override
        public void run() {
            if (!onDuty) return;
            long elapsed = System.currentTimeMillis() - shiftStartMillis;
            tvShiftTimer.setText(TimeFormat.hms(elapsed));
            handler.postDelayed(this, 1000);
        }
    };

    private long panicPressStart = 0;
    private final Runnable panicHoldRunnable = () -> {
        PanicAlertDialogFragment.newInstance().show(getSupportFragmentManager(), "panic");
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_shift);

        flipper = findViewById(R.id.flipper);
        tvTopBarTitle = findViewById(R.id.tvTopBarTitle);
        tvStatusPill = findViewById(R.id.tvStatusPill);
        tvShiftTimer = findViewById(R.id.tvShiftTimer);
        groupOfflineNotice = findViewById(R.id.groupOfflineNotice);
        btnPanic = findViewById(R.id.btnPanic);

        prefs = new PrefsManager(this);
        shiftRepository = new RetrofitShiftRepository(prefs, this);
        missionRepository = new RetrofitMissionRepository(prefs, (android.content.Context) this);
        Officer officer = RetrofitAuthRepository.getInstance(prefs).getCachedOfficer();
        tvTopBarTitle.setText(officer != null ? officer.getFullName() : getString(R.string.app_name));

        findViewById(R.id.btnSettings).setOnClickListener(v ->
                startActivity(new Intent(this, SettingsActivity.class)));

        findViewById(R.id.btnStartShift).setOnClickListener(v -> startShift());
        findViewById(R.id.btnMissions).setOnClickListener(v ->
                startActivity(new Intent(this, MissionListActivity.class)));
        findViewById(R.id.btnEndShift).setOnClickListener(v -> checkMissionsBeforeEndShift());

        setUpPanicHoldButton();
        renderOffDuty();
    }

    private void checkMissionsBeforeEndShift() {
        final android.app.Dialog loading = new androidx.appcompat.app.AlertDialog.Builder(this)
                .setMessage(R.string.logout_validation_loading)
                .setCancelable(false)
                .show();

        missionRepository.fetchMissions(new Callback<List<Mission>>() {
            @Override
            public void onSuccess(List<Mission> result) {
                if (loading != null) loading.dismiss();
                boolean active = false;
                for (Mission m : result) {
                    if (m.getStatus() == MissionStatus.ACKNOWLEDGED || m.getStatus() == MissionStatus.IN_PROGRESS) {
                        active = true;
                        break;
                    }
                }

                if (active) {
                    new androidx.appcompat.app.AlertDialog.Builder(ShiftActivity.this)
                            .setTitle(R.string.shift_end_button)
                            .setMessage(R.string.end_shift_error_active_missions)
                            .setPositiveButton(android.R.string.ok, null)
                            .show();
                } else {
                    EndShiftDialogFragment.newInstance().show(ShiftActivity.this.getSupportFragmentManager(), "end_shift");
                }
            }

            @Override
            public void onError(Throwable error) {
                if (loading != null) loading.dismiss();
                Toast.makeText(ShiftActivity.this, error.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setUpPanicHoldButton() {
        btnPanic.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    panicPressStart = SystemClock.elapsedRealtime();
                    handler.postDelayed(panicHoldRunnable, PANIC_HOLD_MILLIS);
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    handler.removeCallbacks(panicHoldRunnable);
                    v.performClick();
                    return true;
            }
            return false;
        });
    }

    // Called by EndShiftDialogFragment via FragmentResultListener-style direct call.
    public void onEndShiftConfirmed() {
        shiftRepository.endShift(null, null, prefs.getRefreshToken(), new Callback<Shift>() {
            @Override
            public void onSuccess(Shift result) {
                onDuty = false;
                prefs.setShiftActive(false);
                handler.removeCallbacks(timerTick);
                renderOffDuty();
                Toast.makeText(ShiftActivity.this, "Shift ended. Duration: " + TimeFormat.hms(result.getDurationSeconds() * 1000L), Toast.LENGTH_LONG).show();
            }

            @Override
            public void onError(Throwable t) {
                Toast.makeText(ShiftActivity.this, "Failed to end shift: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void onPanicSent() {
        Toast.makeText(this, R.string.panic_toast_sent, Toast.LENGTH_SHORT).show();
    }

    private void startShift() {
        shiftRepository.startShift(null, null, new Callback<Shift>() {
            @Override
            public void onSuccess(Shift result) {
                onDuty = true;
                prefs.setShiftActive(true);
                try {
                    // Simple ISO parser for the purpose of the POC
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    java.util.Date date = sdf.parse(result.getStartedAt());
                    shiftStartMillis = date.getTime();
                } catch (Exception e) {
                    shiftStartMillis = System.currentTimeMillis();
                }

                flipper.setDisplayedChild(PAGE_ON_DUTY);
                groupOfflineNotice.setVisibility(simulatedOffline ? android.view.View.VISIBLE : android.view.View.GONE);
                updateStatusPill();
                handler.post(timerTick);
            }

            @Override
            public void onError(Throwable t) {
                Toast.makeText(ShiftActivity.this, "Failed to start shift: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void renderOffDuty() {
        flipper.setDisplayedChild(PAGE_OFF_DUTY);
        tvStatusPill.setText(R.string.status_no_signal);
        tvStatusPill.setBackgroundResource(R.drawable.pill_offline);
    }

    private void updateStatusPill() {
        if (simulatedOffline) {
            tvStatusPill.setText(R.string.status_no_signal);
            tvStatusPill.setBackgroundResource(R.drawable.pill_pending);
        } else {
            tvStatusPill.setText(R.string.status_online);
            tvStatusPill.setBackgroundResource(R.drawable.pill_active);
        }
    }

    @Override
    public boolean onCreateOptionsMenu(android.view.Menu menu) {
        getMenuInflater().inflate(R.menu.menu_shift, menu);
        return true;
    }

    /** Demo-only: lets you preview the "working offline" and "syncing" mockup
     * states without real connectivity, since there is no backend yet. */
    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.menu_state_online) {
            simulatedOffline = false;
            if (onDuty) {
                flipper.setDisplayedChild(PAGE_ON_DUTY);
                groupOfflineNotice.setVisibility(android.view.View.GONE);
                updateStatusPill();
            }
            return true;
        } else if (id == R.id.menu_state_offline) {
            simulatedOffline = true;
            if (!onDuty) startShift();
            flipper.setDisplayedChild(PAGE_ON_DUTY);
            groupOfflineNotice.setVisibility(android.view.View.VISIBLE);
            updateStatusPill();
            return true;
        } else if (id == R.id.menu_state_syncing) {
            if (!onDuty) startShift();
            flipper.setDisplayedChild(PAGE_SYNCING);
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
    }
}
