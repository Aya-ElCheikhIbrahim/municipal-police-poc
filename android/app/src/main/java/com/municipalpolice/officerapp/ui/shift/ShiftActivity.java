package com.municipalpolice.officerapp.ui.shift;

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
import com.municipalpolice.officerapp.data.FakeMissionRepository;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.data.FakeAuthRepository;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.EndShiftDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.ui.settings.SettingsActivity;
import com.municipalpolice.officerapp.util.TimeFormat;

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
    private long shiftStartElapsedRealtime;
    private boolean onDuty = false;
    private boolean simulatedOffline = false;

    private final Runnable timerTick = new Runnable() {
        @Override
        public void run() {
            if (!onDuty) return;
            long elapsed = SystemClock.elapsedRealtime() - shiftStartElapsedRealtime;
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

        Officer officer = FakeAuthRepository.getInstance().getCachedOfficer();
        tvTopBarTitle.setText(officer != null ? officer.getFullName() : getString(R.string.app_name));

        findViewById(R.id.btnSettings).setOnClickListener(v ->
                startActivity(new Intent(this, SettingsActivity.class)));

        findViewById(R.id.btnStartShift).setOnClickListener(v -> startShift());
        findViewById(R.id.btnMissions).setOnClickListener(v ->
                startActivity(new Intent(this, MissionListActivity.class)));
        findViewById(R.id.btnEndShift).setOnClickListener(v ->
                EndShiftDialogFragment.newInstance().show(getSupportFragmentManager(), "end_shift"));

        setUpPanicHoldButton();
        renderOffDuty();
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
        onDuty = false;
        handler.removeCallbacks(timerTick);
        renderOffDuty();
    }

    public void onPanicSent() {
        Toast.makeText(this, R.string.panic_toast_sent, Toast.LENGTH_SHORT).show();
    }

    private void startShift() {
        onDuty = true;
        shiftStartElapsedRealtime = SystemClock.elapsedRealtime();
        flipper.setDisplayedChild(PAGE_ON_DUTY);
        groupOfflineNotice.setVisibility(simulatedOffline ? android.view.View.VISIBLE : android.view.View.GONE);
        updateStatusPill();
        handler.post(timerTick);
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
