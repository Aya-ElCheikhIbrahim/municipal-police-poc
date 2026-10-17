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
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.RealLocationTracker;
import com.municipalpolice.officerapp.data.RetrofitAuthRepository;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.data.RetrofitShiftRepository;
import com.municipalpolice.officerapp.data.ShiftRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Officer;
import com.municipalpolice.officerapp.model.Priority;
import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.service.LocationService;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.EndShiftDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.ui.missiondetail.MissionDetailActivity;
import com.municipalpolice.officerapp.ui.missions.MissionAdapter;
import com.municipalpolice.officerapp.ui.missions.MissionListActivity;
import com.municipalpolice.officerapp.ui.settings.SettingsActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ShiftActivity extends BaseActivity implements EndShiftDialogFragment.EndShiftListener, PanicAlertDialogFragment.PanicListener {

    private static final String TAG = "ShiftActivity";

    private static final int PAGE_LOADING = 0;
    private static final int PAGE_CONTENT = 1;
    private static final int PAGE_EMPTY = 2;
    private static final int PAGE_ERROR = 3;

    private ViewFlipper flipper;
    private SwipeRefreshLayout swipeRefresh;
    private TextView tvTopBarTitle;
    private TextView tvStatusPill;

    private MissionAdapter adapter;
    private MissionRepository missionRepository;
    private ShiftRepository shiftRepository;
    private PrefsManager prefs;
    private RealLocationTracker locationTracker;
    private FusedLocationProviderClient fusedLocationClient;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Mission> allMissions = new ArrayList<>();

    private static final long POLL_INTERVAL_MS = 5000L; // 5 seconds polling interval
    private final Runnable pollingRunnable = new Runnable() {
        @Override
        public void run() {
            loadMissionsQuietly();
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

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
        swipeRefresh = findViewById(R.id.swipeRefresh);
        tvTopBarTitle = findViewById(R.id.tvTopBarTitle);
        tvStatusPill = findViewById(R.id.tvStatusPill);

        prefs = new PrefsManager(this);
        shiftRepository = new RetrofitShiftRepository(prefs, this);
        missionRepository = new RetrofitMissionRepository(prefs, this);
        locationTracker = new RealLocationTracker(this);
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        Officer officer = RetrofitAuthRepository.getInstance(prefs).getCachedOfficer();
        tvTopBarTitle.setText(officer != null ? officer.getFullName() : getString(R.string.app_name));

        findViewById(R.id.btnSettings).setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));
        findViewById(R.id.btnStartShift).setOnClickListener(v -> requestLocationThenStartShift());

        View btnTryAgain = findViewById(R.id.btnTryAgain);
        if (btnTryAgain != null) {
            btnTryAgain.setOnClickListener(v -> loadMissions());
        }

        if (swipeRefresh != null) {
            swipeRefresh.setOnRefreshListener(this::loadMissions);
        }

        RecyclerView recyclerView = findViewById(R.id.recyclerMissions);
        if (recyclerView != null) {
            recyclerView.setLayoutManager(new LinearLayoutManager(this));
            adapter = new MissionAdapter(new MissionAdapter.OnMissionClickListener() {
                @Override
                public void onMissionClick(Mission mission) {
                    Toast.makeText(
                            ShiftActivity.this,
                            R.string.shift_start_required_for_mission,
                            Toast.LENGTH_SHORT
                    ).show();
                }

                @Override
                public void onActionClick(Mission mission) {
                    // No mission actions (start/stop work) in off-duty mode
                }
            }, false); // showActionButtons = false
            recyclerView.setAdapter(adapter);
        }

        setupPanicButton();

        setOnlineStatusPill();

        if (prefs.isShiftActive()) {
            navigateToMissions();
            return;
        }

        loadMissions();
    }

    @Override
    protected void onStart() {
        super.onStart();
        handler.removeCallbacks(pollingRunnable);
        handler.postDelayed(pollingRunnable, POLL_INTERVAL_MS);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (prefs.isShiftActive()) {
            navigateToMissions();
            return;
        }
        loadMissionsQuietly();
        handler.removeCallbacks(pollingRunnable);
        handler.postDelayed(pollingRunnable, POLL_INTERVAL_MS);
    }

    @Override
    protected void onStop() {
        handler.removeCallbacks(pollingRunnable);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(pollingRunnable);
        handler.removeCallbacksAndMessages(null);
        if (adapter != null) {
            adapter.stopTimerUpdates();
        }
        super.onDestroy();
    }

    private void updateUserLocation() {
        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED) {

            fusedLocationClient
                    .getLastLocation()
                    .addOnSuccessListener(
                            location -> {
                                if (location != null && adapter != null) {
                                    adapter.setUserLocation(location);
                                }
                            }
                    );
        }
    }

    private void loadMissions() {
        loadMissionsInternal(true);
    }

    private void loadMissionsQuietly() {
        loadMissionsInternal(false);
    }

    private int getStatusWeight(MissionStatus status) {
        if (status == null) return 0;
        switch (status) {
            case PAUSED:
            case IN_PROGRESS:
                return 2;
            case NEW:
            case ASSIGNED:
                return 1;
            default:
                return 0;
        }
    }

    private int getPriorityWeight(Priority priority) {
        if (priority == null) return 0;
        switch (priority) {
            case URGENT:
                return 4;
            case HIGH:
                return 3;
            case MEDIUM:
                return 2;
            case LOW:
                return 1;
            default:
                return 0;
        }
    }

    private void loadMissionsInternal(boolean showLoadingIndicator) {
        if (showLoadingIndicator && allMissions.isEmpty()) {
            showLoading();
        }

        updateUserLocation();

        missionRepository.fetchMissions(new Callback<List<Mission>>() {
            @Override
            public void onSuccess(List<Mission> result) {
                handler.post(() -> {
                    if (swipeRefresh != null) {
                        swipeRefresh.setRefreshing(false);
                    }
                    List<Mission> openMissions = new ArrayList<>();
                    if (result != null) {
                        for (Mission mission : result) {
                            if (mission.getStatus() != MissionStatus.COMPLETED && mission.getStatus() != MissionStatus.CANCELLED) {
                                openMissions.add(mission);
                            }
                        }
                        Collections.sort(openMissions, (m1, m2) -> {
                            int s1 = getStatusWeight(m1.getStatus());
                            int s2 = getStatusWeight(m2.getStatus());
                            if (s1 != s2) {
                                return Integer.compare(s2, s1);
                            }
                            int p1 = getPriorityWeight(m1.getPriority());
                            int p2 = getPriorityWeight(m2.getPriority());
                            if (p1 != p2) {
                                return Integer.compare(p2, p1);
                            }
                            return Integer.compare(m2.getId(), m1.getId());
                        });
                    }
                    allMissions.clear();
                    allMissions.addAll(openMissions);

                    if (adapter != null) {
                        adapter.submitList(allMissions);
                    }
                    if (flipper != null) {
                        flipper.setDisplayedChild(allMissions.isEmpty() ? PAGE_EMPTY : PAGE_CONTENT);
                    }
                });
            }

            @Override
            public void onError(Throwable error) {
                handler.post(() -> {
                    if (swipeRefresh != null) {
                        swipeRefresh.setRefreshing(false);
                    }
                    if (showLoadingIndicator || allMissions.isEmpty()) {
                        if (flipper != null) {
                            flipper.setDisplayedChild(PAGE_ERROR);
                        }
                    }
                });
            }
        });
    }

    private void openMissionDetail(Mission mission) {
        Intent intent = new Intent(this, MissionDetailActivity.class);
        intent.putExtra(MissionDetailActivity.EXTRA_MISSION_ID, String.valueOf(mission.getId()));
        startActivity(intent);
    }

    private void showLoading() {
        if (flipper != null) {
            flipper.setDisplayedChild(PAGE_LOADING);
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
            Log.w(TAG, "Could not start LocationService", e);
        }
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
