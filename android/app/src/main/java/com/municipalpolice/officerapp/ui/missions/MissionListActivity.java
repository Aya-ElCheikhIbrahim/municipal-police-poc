package com.municipalpolice.officerapp.ui.missions;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.material.tabs.TabLayout;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.NetworkMonitor;
import com.municipalpolice.officerapp.data.RealLocationTracker;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.data.RetrofitShiftRepository;
import com.municipalpolice.officerapp.data.ShiftRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.model.Shift;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.EndShiftDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.ui.missiondetail.MissionDetailActivity;
import com.municipalpolice.officerapp.ui.shift.ShiftActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.util.ArrayList;
import java.util.List;

public class MissionListActivity extends BaseActivity
        implements EndShiftDialogFragment.EndShiftListener,
        PanicAlertDialogFragment.PanicListener {

    private static final int PAGE_LOADING = 0;
    private static final int PAGE_CONTENT = 1;
    private static final int PAGE_EMPTY = 2;
    private static final int PAGE_ERROR = 3;

    private static final String TAG_MISSION_TIMER = "MISSION_TIMER";

    private ViewFlipper flipper;
    private SwipeRefreshLayout swipeRefresh;
    private TextView tvStatusPill;
    private View groupOfflineNotice;

    private MissionAdapter adapter;
    private MissionRepository missionRepository;
    private ShiftRepository shiftRepository;
    private PrefsManager prefs;
    private RealLocationTracker locationTracker;
    private FusedLocationProviderClient fusedLocationClient;

    private NetworkMonitor networkMonitor;

    private final Handler handler =
            new Handler(Looper.getMainLooper());

    private final List<Mission> allMissions =
            new ArrayList<>();

    private int selectedTab = 0;

    private boolean backendOnline = false;
    private boolean firstNetworkResultReceived = false;


    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        setContentView(
                R.layout.activity_mission_list
        );


        // =====================================================
        // REPOSITORIES / SERVICES
        // =====================================================

        prefs =
                new PrefsManager(this);

        missionRepository =
                new RetrofitMissionRepository(
                        prefs,
                        this
                );

        shiftRepository =
                new RetrofitShiftRepository(
                        prefs,
                        this
                );

        locationTracker =
                new RealLocationTracker(this);

        fusedLocationClient =
                LocationServices
                        .getFusedLocationProviderClient(
                                this
                        );


        // =====================================================
        // VIEWS
        // =====================================================

        flipper =
                findViewById(
                        R.id.flipper
                );

        swipeRefresh =
                findViewById(
                        R.id.swipeRefresh
                );

        tvStatusPill =
                findViewById(
                        R.id.tvStatusPill
                );

        groupOfflineNotice =
                findViewById(
                        R.id.groupOfflineNotice
                );


        RecyclerView recyclerView =
                findViewById(
                        R.id.recyclerMissions
                );

        recyclerView.setLayoutManager(
                new LinearLayoutManager(this)
        );


        // =====================================================
        // MISSION ADAPTER
        // =====================================================

        adapter =
                new MissionAdapter(
                        new MissionAdapter
                                .OnMissionClickListener() {

                            @Override
                            public void onMissionClick(
                                    Mission mission
                            ) {

                                openMissionDetail(
                                        mission
                                );
                            }


                            @Override
                            public void onActionClick(
                                    Mission mission
                            ) {

                                handleMissionAction(
                                        mission
                                );
                            }
                        }
                );

        recyclerView.setAdapter(
                adapter
        );


        // =====================================================
        // NETWORK MONITOR
        // =====================================================

        networkMonitor =
                new NetworkMonitor(
                        this,
                        new NetworkMonitor.Listener() {

                            @Override
                            public void onNetworkAvailable() {

                                handler.post(() -> {

                                    backendOnline = true;

                                    firstNetworkResultReceived =
                                            true;

                                    setOnlineStatus();

                                    if (groupOfflineNotice != null) {

                                        groupOfflineNotice
                                                .setVisibility(
                                                        View.GONE
                                                );
                                    }

                                    loadMissions();
                                });
                            }


                            @Override
                            public void onNetworkLost() {

                                handler.post(() -> {

                                    backendOnline = false;

                                    firstNetworkResultReceived =
                                            true;

                                    setOfflineStatus();

                                    if (groupOfflineNotice != null) {

                                        groupOfflineNotice
                                                .setVisibility(
                                                        View.VISIBLE
                                                );
                                    }

                                    if (allMissions.isEmpty()) {
                                        showErrorPage();
                                    }
                                });
                            }
                        }
                );


        // =====================================================
        // BUTTONS
        // =====================================================

        findViewById(
                R.id.btnBack
        ).setOnClickListener(
                v -> finish()
        );


        findViewById(
                R.id.btnEndShift
        ).setOnClickListener(
                v -> checkMissionsBeforeEndShift()
        );


        findViewById(
                R.id.btnTryAgain
        ).setOnClickListener(
                v -> loadMissions()
        );


        swipeRefresh.setOnRefreshListener(
                this::loadMissions
        );


        // =====================================================
        // PANIC BUTTON
        // =====================================================

        View panicButton =
                findViewById(
                        R.id.btnPanicCircle
                );

        if (panicButton != null) {

            panicButton.setOnClickListener(
                    v ->
                            PanicAlertDialogFragment
                                    .newInstance()
                                    .show(
                                            getSupportFragmentManager(),
                                            "panic"
                                    )
            );
        }


        // =====================================================
        // NEW / COMPLETED TABS
        // =====================================================

        TabLayout tabLayout =
                findViewById(
                        R.id.tabLayout
                );

        tabLayout.addOnTabSelectedListener(
                new TabLayout.OnTabSelectedListener() {

                    @Override
                    public void onTabSelected(
                            TabLayout.Tab tab
                    ) {

                        selectedTab =
                                tab.getPosition();

                        renderFilteredList();
                    }


                    @Override
                    public void onTabUnselected(
                            TabLayout.Tab tab
                    ) {
                    }


                    @Override
                    public void onTabReselected(
                            TabLayout.Tab tab
                    ) {
                    }
                }
        );


        // =====================================================
        // INITIAL LOAD
        // =====================================================

        showLoading();

        loadMissions();
    }


    // =========================================================
    // START / STOP ACTION
    // =========================================================

    private void handleMissionAction(
            Mission mission
    ) {

        /*
         * START WORK
         */
        if (mission.getStatus() ==
                MissionStatus.NEW ||
                mission.getStatus() ==
                        MissionStatus.ASSIGNED) {

            startMission(
                    mission
            );

            return;
        }


        /*
         * STOP WORK
         *
         * In the current workflow, Stop means:
         * Complete this mission.
         */
        if (mission.getStatus() ==
                MissionStatus.ACKNOWLEDGED ||
                mission.getStatus() ==
                        MissionStatus.IN_PROGRESS) {

            completeMission(
                    mission
            );
        }
    }


    // =========================================================
    // START MISSION
    // =========================================================

    private void startMission(
            Mission mission
    ) {

        missionRepository.startMission(
                String.valueOf(
                        mission.getId()
                ),
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(
                            Mission result
                    ) {

                        handler.post(() -> {

                            Toast.makeText(
                                    MissionListActivity.this,
                                    "Mission started",
                                    Toast.LENGTH_SHORT
                            ).show();

                            loadMissions();
                        });
                    }


                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        handler.post(() ->

                                Toast.makeText(
                                        MissionListActivity.this,
                                        "Failed: " +
                                                safeMessage(
                                                        error
                                                ),
                                        Toast.LENGTH_LONG
                                ).show()
                        );
                    }
                }
        );
    }


    // =========================================================
    // COMPLETE MISSION
    // =========================================================

    private void completeMission(
            Mission mission
    ) {

        missionRepository.completeMission(
                String.valueOf(
                        mission.getId()
                ),
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(
                            Mission result
                    ) {

                        handler.post(() -> {

                            Toast.makeText(
                                    MissionListActivity.this,
                                    "Mission completed",
                                    Toast.LENGTH_SHORT
                            ).show();

                            loadMissions();
                        });
                    }


                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        handler.post(() -> {

                            Toast.makeText(
                                    MissionListActivity.this,
                                    "Failed: " +
                                            safeMessage(
                                                    error
                                            ),
                                    Toast.LENGTH_LONG
                            ).show();

                            openMissionDetail(
                                    mission
                            );
                        });
                    }
                }
        );
    }


    // =========================================================
    // END SHIFT
    // =========================================================

    private boolean hasActiveOrAssignedMissions() {
        for (Mission mission : allMissions) {
            if (mission.getStatus() == MissionStatus.NEW ||
                mission.getStatus() == MissionStatus.ASSIGNED ||
                mission.getStatus() == MissionStatus.ACKNOWLEDGED ||
                mission.getStatus() == MissionStatus.IN_PROGRESS ||
                mission.getStatus() == MissionStatus.PAUSED) {
                return true;
            }
        }
        return false;
    }

    private void checkMissionsBeforeEndShift() {
        if (hasActiveOrAssignedMissions()) {
            Toast.makeText(this, R.string.end_shift_error_active_missions, Toast.LENGTH_LONG).show();
            return;
        }

        EndShiftDialogFragment
                .newInstance()
                .show(
                        getSupportFragmentManager(),
                        "end_shift"
                );
    }


    @Override
    public void onEndShiftConfirmed() {

        shiftRepository.endShift(
                null,
                null,
                prefs.getRefreshToken(),
                new Callback<Shift>() {

                    @Override
                    public void onSuccess(
                            Shift result
                    ) {

                        prefs.setShiftActive(
                                false
                        );

                        Toast.makeText(
                                MissionListActivity.this,
                                "Shift ended",
                                Toast.LENGTH_LONG
                        ).show();

                        Intent intent =
                                new Intent(
                                        MissionListActivity.this,
                                        ShiftActivity.class
                                );

                        intent.addFlags(
                                Intent.FLAG_ACTIVITY_NEW_TASK |
                                        Intent.FLAG_ACTIVITY_CLEAR_TASK
                        );

                        startActivity(
                                intent
                        );

                        finish();
                    }


                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        Toast.makeText(
                                MissionListActivity.this,
                                "Failed: " +
                                        safeMessage(
                                                error
                                        ),
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                }
        );
    }


    // =========================================================
    // PANIC
    // =========================================================

    @Override
    public void onPanicSent() {

        Toast.makeText(
                this,
                R.string.panic_toast_sent,
                Toast.LENGTH_SHORT
        ).show();
    }


    // =========================================================
    // ACTIVITY LIFECYCLE
    // =========================================================

    @Override
    protected void onStart() {

        super.onStart();

        if (networkMonitor != null) {
            networkMonitor.start();
        }

        if (locationTracker != null) {

            locationTracker.startTracking(
                    "missions"
            );
        }

        updateUserLocation();
    }


    @Override
    protected void onStop() {

        if (networkMonitor != null) {
            networkMonitor.stop();
        }

        if (locationTracker != null) {
            locationTracker.stopTracking();
        }

        super.onStop();
    }


    @Override
    protected void onDestroy() {

        handler.removeCallbacksAndMessages(
                null
        );

        if (adapter != null) {
            adapter.stopTimerUpdates();
        }

        if (networkMonitor != null) {
            networkMonitor.stop();
        }

        if (locationTracker != null) {
            locationTracker.stopTracking();
        }

        super.onDestroy();
    }


    @Override
    protected void onResume() {

        super.onResume();

        if (firstNetworkResultReceived &&
                backendOnline) {

            loadMissions();
        }
    }


    // =========================================================
    // LOCATION
    // =========================================================

    private void updateUserLocation() {

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED) {

            fusedLocationClient
                    .getLastLocation()
                    .addOnSuccessListener(
                            location -> {

                                if (location != null &&
                                        adapter != null) {

                                    adapter.setUserLocation(
                                            location
                                    );
                                }
                            }
                    );
        }
    }


    // =========================================================
    // OPEN MISSION
    // =========================================================

    private void openMissionDetail(
            Mission mission
    ) {

        Intent intent =
                new Intent(
                        this,
                        MissionDetailActivity.class
                );

        intent.putExtra(
                MissionDetailActivity.EXTRA_MISSION_ID,
                String.valueOf(
                        mission.getId()
                )
        );

        startActivity(
                intent
        );
    }


    // =========================================================
    // LOAD MISSIONS
    // =========================================================

    private void loadMissions() {

        showLoading();

        updateUserLocation();

        missionRepository.fetchMissions(
                new Callback<List<Mission>>() {

                    @Override
                    public void onSuccess(
                            List<Mission> result
                    ) {

                        handler.post(() -> {

                            swipeRefresh.setRefreshing(
                                    false
                            );

                            allMissions.clear();

                            int openMissionCount = 0;

                            if (result != null) {

                                allMissions.addAll(
                                        result
                                );

                                for (Mission mission : result) {

                                    // =====================================
                                    // TEMPORARY TIMER DEBUG
                                    // =====================================
                                    Log.d(
                                            TAG_MISSION_TIMER,
                                            "id=" + mission.getId()
                                                    + " status=" + mission.getStatus()
                                                    + " durationSeconds=" + mission.getDurationSeconds()
                                                    + " workedSeconds=" + mission.getWorkedSeconds()
                                                    + " resumedAt=" + mission.getResumedAt()
                                    );

                                    if (isOpenMission(
                                            mission
                                    )) {

                                        openMissionCount++;
                                    }
                                }
                            }

                            TextView tvMissionCount =
                                    findViewById(
                                            R.id.tvMissionCount
                                    );

                            if (tvMissionCount != null) {

                                tvMissionCount.setText(
                                        String.valueOf(
                                                openMissionCount
                                        )
                                );
                            }

                            renderFilteredList();
                        });
                    }


                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        handler.post(() -> {

                            swipeRefresh.setRefreshing(
                                    false
                            );

                            Toast.makeText(
                                    MissionListActivity.this,
                                    "Error: " +
                                            safeMessage(
                                                    error
                                            ),
                                    Toast.LENGTH_LONG
                            ).show();

                            showErrorPage();
                        });
                    }
                }
        );
    }


    // =========================================================
    // FILTERING
    // =========================================================

    private boolean isOpenMission(
            Mission mission
    ) {

        return mission.getStatus() ==
                MissionStatus.NEW ||

                mission.getStatus() ==
                        MissionStatus.ASSIGNED ||

                mission.getStatus() ==
                        MissionStatus.ACKNOWLEDGED ||

                mission.getStatus() ==
                        MissionStatus.IN_PROGRESS ||

                mission.getStatus() ==
                        MissionStatus.PAUSED;
    }


    private void renderFilteredList() {

        List<Mission> filtered =
                new ArrayList<>();

        for (Mission mission : allMissions) {

            /*
             * NEW TAB
             */
            if (selectedTab == 0 &&
                    isOpenMission(
                            mission
                    )) {

                filtered.add(
                        mission
                );
            }

            /*
             * COMPLETED TAB
             */
            else if (selectedTab == 1 &&
                    mission.getStatus() ==
                            MissionStatus.COMPLETED) {

                filtered.add(
                        mission
                );
            }
        }

        adapter.submitList(
                filtered
        );

        flipper.setDisplayedChild(
                filtered.isEmpty()
                        ? PAGE_EMPTY
                        : PAGE_CONTENT
        );
    }


    // =========================================================
    // PAGE STATE
    // =========================================================

    private void showLoading() {

        flipper.setDisplayedChild(
                PAGE_LOADING
        );

        if (firstNetworkResultReceived) {

            if (backendOnline) {
                setOnlineStatus();
            } else {
                setOfflineStatus();
            }
        }
    }


    private void showErrorPage() {

        flipper.setDisplayedChild(
                PAGE_ERROR
        );

        if (firstNetworkResultReceived) {

            if (backendOnline) {
                setOnlineStatus();
            } else {
                setOfflineStatus();
            }
        }
    }


    // =========================================================
    // ONLINE / OFFLINE
    // =========================================================

    private void setOnlineStatus() {

        tvStatusPill.setText(
                R.string.status_online
        );

        tvStatusPill.setBackgroundResource(
                R.drawable.pill_active
        );
    }


    private void setOfflineStatus() {

        tvStatusPill.setText(
                R.string.status_no_signal
        );

        tvStatusPill.setBackgroundResource(
                R.drawable.pill_offline
        );
    }


    // =========================================================
    // ERROR MESSAGE
    // =========================================================

    private String safeMessage(
            Throwable error
    ) {

        if (error == null ||
                error.getMessage() == null ||
                error.getMessage()
                        .trim()
                        .isEmpty()) {

            return "Unknown error";
        }

        return error.getMessage();
    }
}