package com.municipalpolice.officerapp.ui.shift;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.BulkLocationPingResponse;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.LocationSyncRepository;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.NetworkMonitor;
import com.municipalpolice.officerapp.data.RealLocationTracker;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.data.RetrofitShiftRepository;
import com.municipalpolice.officerapp.data.ShiftRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.EndShiftDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.ui.settings.SettingsActivity;
import com.municipalpolice.officerapp.util.PrefsManager;
import com.municipalpolice.officerapp.util.TimeFormat;

import java.text.SimpleDateFormat;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

public class ShiftActivity extends BaseActivity {

    private static final int PAGE_OFF_DUTY = 0;
    private static final int PAGE_ON_DUTY = 1;
    private static final int PAGE_SYNCING = 2;

    private static final long PANIC_HOLD_MILLIS = 2000;
    private static final long MISSION_REFRESH_INTERVAL = 10000; // 10 seconds

    private ViewFlipper flipper;

    private TextView tvTopBarTitle;
    private TextView tvStatusPill;
    private TextView tvShiftTimer;
    private TextView tvLocationLine;
    private TextView tvLastSynced;
    private TextView tvSavedDetail;
    private TextView tvSyncingDetail;

    private View dividerLastSynced;

    private android.widget.LinearLayout groupOfflineNotice;

    private Button btnPanic;
    private Button btnMissions;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private long shiftStartMillis;

    private boolean onDuty = false;
    private boolean syncing = false;

    private boolean backendReachable = false;

    private ShiftRepository shiftRepository;
    private MissionRepository missionRepository;

    private PrefsManager prefs;

    private RealLocationTracker locationTracker;
    private LocationSyncRepository locationSyncRepository;
    private NetworkMonitor networkMonitor;

    // Location Permission
    private final ActivityResultLauncher<String> locationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestPermission(),
                    granted -> {
                        if (granted && onDuty && locationTracker != null) {
                            locationTracker.startTracking("shift");
                        } else if (!granted) {
                            Toast.makeText(
                                    this,
                                    "Location permission is required while on duty.",
                                    Toast.LENGTH_SHORT
                            ).show();
                        }
                    }
            );

    // Timer
    private final Runnable timerTick = new Runnable() {
        @Override
        public void run() {
            if (!onDuty) return;
            long elapsed = System.currentTimeMillis() - shiftStartMillis;
            if (elapsed < 0) elapsed = 0;
            tvShiftTimer.setText(TimeFormat.hms(elapsed));
            handler.postDelayed(this, 1000);
        }
    };

    // Mission Refresh
    private final Runnable missionRefreshTick = new Runnable() {
        @Override
        public void run() {
            if (!onDuty) return;
            updateMissionCount();
            handler.postDelayed(this, MISSION_REFRESH_INTERVAL);
        }
    };

    // Panic
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
        tvLocationLine = findViewById(R.id.tvLocationLine);
        tvLastSynced = findViewById(R.id.tvLastSynced);
        dividerLastSynced = findViewById(R.id.dividerLastSynced);
        tvSavedDetail = findViewById(R.id.tvSavedDetail);
        tvSyncingDetail = findViewById(R.id.tvSyncingDetail);
        groupOfflineNotice = findViewById(R.id.groupOfflineNotice);
        btnPanic = findViewById(R.id.btnPanic);
        btnMissions = findViewById(R.id.btnMissions);

        prefs = new PrefsManager(this);
        shiftRepository = new RetrofitShiftRepository(prefs, this);
        missionRepository = new RetrofitMissionRepository(prefs, this);
        locationTracker = new RealLocationTracker(this);
        locationSyncRepository = new LocationSyncRepository(this);

        // Real Backend Monitor
        networkMonitor = new NetworkMonitor(
                this,
                new NetworkMonitor.Listener() {
                    @Override
                    public void onNetworkAvailable() {
                        handler.post(() -> {
                            backendReachable = true;
                            setOnlineStatusPill();
                            if (onDuty) {
                                handleNetworkAvailable();
                            }
                        });
                    }

                    @Override
                    public void onNetworkLost() {
                        handler.post(() -> {
                            backendReachable = false;
                            setOfflineStatusPill();
                            if (onDuty) {
                                showOfflineState();
                            }
                        });
                    }
                }
        );

        // Officer
        Officer officer = RetrofitAuthRepository.getInstance(prefs).getCachedOfficer();
        tvTopBarTitle.setText(
                officer != null ? officer.getFullName() : getString(R.string.app_name)
        );

        // Buttons
        findViewById(R.id.btnSettings).setOnClickListener(
                v -> startActivity(new Intent(this, SettingsActivity.class))
        );

        findViewById(R.id.btnStartShift).setOnClickListener(v -> startShift());
        btnMissions.setOnClickListener(v ->
                startActivity(new Intent(this, MissionListActivity.class))
        );
        findViewById(R.id.btnEndShift).setOnClickListener(v -> checkMissionsBeforeEndShift());

        setUpPanicHoldButton();
        renderOffDuty();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (networkMonitor != null) {
            networkMonitor.start();
        }
    }

    @Override
    protected void onStop() {
        if (networkMonitor != null) {
            networkMonitor.stop();
        }
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (onDuty) {
            updateMissionCount();
            handler.post(timerTick);
            handler.postDelayed(missionRefreshTick, MISSION_REFRESH_INTERVAL);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(timerTick);
        handler.removeCallbacks(missionRefreshTick);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (networkMonitor != null) {
            networkMonitor.stop();
        }
        super.onDestroy();
    }

    private void startShift() {
        shiftRepository.startShift(null, null, new Callback<Shift>() {
            @Override
            public void onSuccess(Shift result) {
                backendReachable = true;
                onDuty = true;
                prefs.setShiftActive(true);

                try {
                    // Use java.time for robust ISO 8601 parsing
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        shiftStartMillis = OffsetDateTime.parse(result.getStartedAt()).toInstant().toEpochMilli();
                    } else {
                        // Fallback for older devices
                        String dateStr = result.getStartedAt();
                        if (dateStr.contains(".")) {
                            int dot = dateStr.indexOf(".");
                            int sign = dateStr.indexOf("+", dot);
                            if (sign == -1) sign = dateStr.indexOf("-", dot);
                            if (sign == -1 && dateStr.endsWith("Z")) sign = dateStr.length() - 1;
                            if (sign != -1) {
                                dateStr = dateStr.substring(0, dot) + dateStr.substring(sign);
                            }
                        }
                        SimpleDateFormat sdf;
                        if (dateStr.endsWith("Z")) {
                            sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
                            sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                        } else {
                            sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US);
                        }
                        shiftStartMillis = sdf.parse(dateStr).getTime();
                    }
                } catch (Exception e) {
                    shiftStartMillis = System.currentTimeMillis();
                }

                handler.removeCallbacks(timerTick);
                handler.post(timerTick);
                startLocationTrackingIfAllowed();
                handleNetworkAvailable();
            }

            @Override
            public void onError(Throwable error) {
                Toast.makeText(ShiftActivity.this,
                        "Failed to start shift: " + error.getMessage(),
                        Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void handleNetworkAvailable() {
        if (!onDuty || syncing) return;
        setOnlineStatusPill();

        new Thread(() -> {
            try {
                int pending = locationSyncRepository.getPendingCount();
                handler.post(() -> {
                    if (!onDuty) return;
                    if (pending > 0) {
                        startSync(pending);
                    } else {
                        showOnlineState();
                    }
                });
            } catch (Exception e) {
                handler.post(() -> {
                    if (onDuty) showOnlineState();
                });
            }
        }).start();
    }

    private void showOnlineState() {
        if (!onDuty) return;
        syncing = false;
        backendReachable = true;
        flipper.setDisplayedChild(PAGE_ON_DUTY);
        groupOfflineNotice.setVisibility(View.GONE);
        tvLastSynced.setVisibility(View.GONE);
        dividerLastSynced.setVisibility(View.GONE);
        tvLocationLine.setVisibility(View.VISIBLE);
        setOnlineStatusPill();
    }

    private void showOfflineState() {
        if (!onDuty) return;
        syncing = false;
        backendReachable = false;
        flipper.setDisplayedChild(PAGE_ON_DUTY);
        setOfflineStatusPill();
        tvLocationLine.setVisibility(View.GONE);
        dividerLastSynced.setVisibility(View.VISIBLE);
        tvLastSynced.setVisibility(View.VISIBLE);
        groupOfflineNotice.setVisibility(View.VISIBLE);
        updatePendingCount();
    }

    private void setOnlineStatusPill() {
        tvStatusPill.setText(R.string.status_online);
        tvStatusPill.setBackgroundResource(R.drawable.pill_active);
    }

    private void setOfflineStatusPill() {
        tvStatusPill.setText(R.string.status_no_signal);
        tvStatusPill.setBackgroundResource(R.drawable.pill_offline);
    }

    private void updatePendingCount() {
        new Thread(() -> {
            try {
                int pending = locationSyncRepository.getPendingCount();
                handler.post(() -> {
                    if (!onDuty) return;
                    String text;
                    if (pending == 1) {
                        text = "1 location saved. It will upload when the signal returns.";
                    } else {
                        text = pending + " locations saved. They will upload when the signal returns.";
                    }
                    tvSavedDetail.setText(text);
                });
            } catch (Exception ignored) {
            }
        }).start();
    }

    private void startSync(int pendingCount) {
        if (!onDuty || syncing) return;
        syncing = true;
        flipper.setDisplayedChild(PAGE_SYNCING);
        setOnlineStatusPill();

        if (pendingCount == 1) {
            tvSyncingDetail.setText("Uploading 1 saved location to dispatch.");
        } else {
            tvSyncingDetail.setText("Uploading " + pendingCount + " saved locations to dispatch.");
        }

        locationSyncRepository.syncPending(new Callback<BulkLocationPingResponse>() {
            @Override
            public void onSuccess(BulkLocationPingResponse result) {
                handler.post(() -> {
                    syncing = false;
                    if (!onDuty) return;
                    handleNetworkAvailable();
                });
            }

            @Override
            public void onError(Throwable error) {
                handler.post(() -> {
                    syncing = false;
                    if (!onDuty) return;
                    if (!backendReachable) {
                        showOfflineState();
                    } else {
                        flipper.setDisplayedChild(PAGE_ON_DUTY);
                        groupOfflineNotice.setVisibility(View.VISIBLE);
                        tvLocationLine.setVisibility(View.GONE);
                        dividerLastSynced.setVisibility(View.VISIBLE);
                        tvLastSynced.setVisibility(View.VISIBLE);
                        setOnlineStatusPill();
                        updatePendingCount();
                        Toast.makeText(ShiftActivity.this,
                                "Saved work is still on this phone. Sync failed: " + error.getMessage(),
                                Toast.LENGTH_LONG).show();
                    }
                });
            }
        });
    }

    private void startLocationTrackingIfAllowed() {
        boolean fineGranted = ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED;

        if (fineGranted) {
            locationTracker.startTracking("shift");
        } else {
            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
        }
    }

    private void updateMissionCount() {
        missionRepository.fetchMissions(new Callback<List<Mission>>() {
            @Override
            public void onSuccess(List<Mission> result) {
                int count = 0;
                for (Mission m : result) {
                    if (m.getStatus() == MissionStatus.NEW || m.getStatus() == MissionStatus.ASSIGNED) {
                        count++;
                    }
                }
                if (count > 0) {
                    btnMissions.setText(ShiftActivity.this.getString(
                            R.string.shift_missions_button_with_count, count));
                } else {
                    btnMissions.setText(R.string.shift_missions_button);
                }
            }

            @Override
            public void onError(Throwable error) {
                // Keep default text on error
            }
        });
    }

    private void checkMissionsBeforeEndShift() {
        final android.app.Dialog loading = new androidx.appcompat.app.AlertDialog.Builder(this)
                .setMessage(R.string.logout_validation_loading)
                .setCancelable(false)
                .show();

        missionRepository.fetchMissions(new Callback<List<Mission>>() {
            @Override
            public void onSuccess(List<Mission> result) {
                loading.dismiss();
                boolean active = false;
                if (result != null) {
                    for (Mission mission : result) {
                        if (mission.getStatus() == MissionStatus.ACKNOWLEDGED
                                || mission.getStatus() == MissionStatus.IN_PROGRESS) {
                            active = true;
                            break;
                        }
                    }
                }

                if (active) {
                    new androidx.appcompat.app.AlertDialog.Builder(ShiftActivity.this)
                            .setTitle(R.string.shift_end_button)
                            .setMessage(R.string.end_shift_error_active_missions)
                            .setPositiveButton(android.R.string.ok, null)
                            .show();
                } else {
                    EndShiftDialogFragment.newInstance()
                            .show(getSupportFragmentManager(), "end_shift");
                }
            }

            @Override
            public void onError(Throwable error) {
                loading.dismiss();
                Toast.makeText(ShiftActivity.this, error.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void onEndShiftConfirmed() {
        shiftRepository.endShift(null, null, prefs.getRefreshToken(), new Callback<Shift>() {
            @Override
            public void onSuccess(Shift result) {
                backendReachable = true;
                onDuty = false;
                syncing = false;
                prefs.setShiftActive(false);
                handler.removeCallbacks(timerTick);
                if (locationTracker != null) {
                    locationTracker.stopTracking();
                }
                renderOffDuty();
                setOnlineStatusPill();
                Toast.makeText(ShiftActivity.this,
                        "Shift ended. Duration: " + TimeFormat.hms(result.getDurationSeconds() * 1000L),
                        Toast.LENGTH_LONG).show();
            }

            @Override
            public void onError(Throwable error) {
                Toast.makeText(ShiftActivity.this,
                        "Failed to end shift: " + error.getMessage(),
                        Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setUpPanicHoldButton() {
        btnPanic.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
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

    public void onPanicSent() {
        Toast.makeText(this, R.string.panic_toast_sent, Toast.LENGTH_SHORT).show();
    }

    private void renderOffDuty() {
        flipper.setDisplayedChild(PAGE_OFF_DUTY);
        groupOfflineNotice.setVisibility(View.GONE);
        tvLastSynced.setVisibility(View.GONE);
        dividerLastSynced.setVisibility(View.GONE);
        tvLocationLine.setVisibility(View.VISIBLE);

        if (backendReachable) {
            setOnlineStatusPill();
        } else {
            setOfflineStatusPill();
        }
    }
}