package com.municipalpolice.officerapp.ui.missions;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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

public class MissionListActivity extends BaseActivity implements EndShiftDialogFragment.EndShiftListener, PanicAlertDialogFragment.PanicListener {

    private static final int PAGE_LOADING = 0;
    private static final int PAGE_CONTENT = 1;
    private static final int PAGE_EMPTY = 2;
    private static final int PAGE_ERROR = 3;

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
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Mission> allMissions = new ArrayList<>();
    private int selectedTab = 0;
    private boolean backendOnline = false;
    private boolean firstNetworkResultReceived = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mission_list);

        prefs = new PrefsManager(this);
        missionRepository = new RetrofitMissionRepository(prefs, this);
        shiftRepository = new RetrofitShiftRepository(prefs, this);
        locationTracker = new RealLocationTracker(this);
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        flipper = findViewById(R.id.flipper);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        tvStatusPill = findViewById(R.id.tvStatusPill);
        groupOfflineNotice = findViewById(R.id.groupOfflineNotice);

        RecyclerView recyclerView = findViewById(R.id.recyclerMissions);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new MissionAdapter(new MissionAdapter.OnMissionClickListener() {
            @Override
            public void onMissionClick(Mission m) { openMissionDetail(m); }
            @Override
            public void onActionClick(Mission m) { handleMissionAction(m); }
        });
        recyclerView.setAdapter(adapter);

        networkMonitor = new NetworkMonitor(this, new NetworkMonitor.Listener() {
            @Override
            public void onNetworkAvailable() {
                handler.post(() -> {
                    backendOnline = true; firstNetworkResultReceived = true; setOnlineStatus();
                    if (groupOfflineNotice != null) groupOfflineNotice.setVisibility(View.GONE);
                    loadMissions();
                });
            }
            @Override
            public void onNetworkLost() {
                handler.post(() -> {
                    backendOnline = false; firstNetworkResultReceived = true; setOfflineStatus();
                    if (groupOfflineNotice != null) groupOfflineNotice.setVisibility(View.VISIBLE);
                    if (allMissions.isEmpty()) showErrorPage();
                });
            }
        });

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.btnEndShift).setOnClickListener(v -> checkMissionsBeforeEndShift());
        findViewById(R.id.btnTryAgain).setOnClickListener(v -> loadMissions());
        swipeRefresh.setOnRefreshListener(this::loadMissions);

        View bp = findViewById(R.id.btnPanicCircle);
        if (bp != null) {
            bp.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    PanicAlertDialogFragment.newInstance().show(getSupportFragmentManager(), "panic");
                }
            });
        }

        TabLayout tabLayout = findViewById(R.id.tabLayout);
        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) { selectedTab = tab.getPosition(); renderFilteredList(); }
            @Override
            public void onTabUnselected(TabLayout.Tab tab) {}
            @Override
            public void onTabReselected(TabLayout.Tab tab) {}
        });

        showLoading(); loadMissions();
    }

    private void handleMissionAction(Mission m) {
        if (m.getStatus() == MissionStatus.NEW || m.getStatus() == MissionStatus.ASSIGNED) acknowledgeAndStartMission(m);
        else if (m.getStatus() == MissionStatus.ACKNOWLEDGED || m.getStatus() == MissionStatus.IN_PROGRESS) completeMission(m);
    }

    private void acknowledgeAndStartMission(Mission m) {
        missionRepository.startMission(String.valueOf(m.getId()), new Callback<Mission>() {
            @Override
            public void onSuccess(Mission result) { handler.post(() -> { Toast.makeText(MissionListActivity.this, "Mission started", Toast.LENGTH_SHORT).show(); loadMissions(); }); }
            @Override
            public void onError(Throwable error) { handler.post(() -> Toast.makeText(MissionListActivity.this, "Failed: " + error.getMessage(), Toast.LENGTH_SHORT).show()); }
        });
    }

    private void completeMission(Mission m) {
        missionRepository.completeMission(String.valueOf(m.getId()), new Callback<Mission>() {
            @Override
            public void onSuccess(Mission result) { handler.post(() -> { Toast.makeText(MissionListActivity.this, "Completed", Toast.LENGTH_SHORT).show(); loadMissions(); }); }
            @Override
            public void onError(Throwable error) { handler.post(() -> { Toast.makeText(MissionListActivity.this, "Failed: " + error.getMessage(), Toast.LENGTH_LONG).show(); openMissionDetail(m); }); }
        });
    }

    private void checkMissionsBeforeEndShift() {
        EndShiftDialogFragment.newInstance().show(getSupportFragmentManager(), "end_shift");
    }

    @Override
    public void onEndShiftConfirmed() {
        shiftRepository.endShift(null, null, prefs.getRefreshToken(), new Callback<Shift>() {
            @Override
            public void onSuccess(Shift result) {
                prefs.setShiftActive(false); Toast.makeText(MissionListActivity.this, "Shift ended", Toast.LENGTH_LONG).show();
                Intent endShiftIntent = new Intent(MissionListActivity.this, ShiftActivity.class);
                endShiftIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(endShiftIntent); finish();
            }
            @Override
            public void onError(Throwable error) { Toast.makeText(MissionListActivity.this, "Failed: " + error.getMessage(), Toast.LENGTH_SHORT).show(); }
        });
    }

    @Override
    public void onPanicSent() { Toast.makeText(this, R.string.panic_toast_sent, Toast.LENGTH_SHORT).show(); }

    @Override protected void onStart() { 
        super.onStart(); 
        if (networkMonitor != null) networkMonitor.start(); 
        if (locationTracker != null) locationTracker.startTracking("missions");
        updateUserLocation();
    }

    @Override protected void onStop() { 
        if (networkMonitor != null) networkMonitor.stop(); 
        if (locationTracker != null) locationTracker.stopTracking();
        super.onStop(); 
    }

    @Override protected void onDestroy() { 
        handler.removeCallbacksAndMessages(null); 
        if (networkMonitor != null) networkMonitor.stop(); 
        if (locationTracker != null) locationTracker.stopTracking();
        super.onDestroy(); 
    }

    private void updateUserLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
                if (location != null && adapter != null) {
                    adapter.setUserLocation(location);
                }
            });
        }
    }

    private void openMissionDetail(Mission m) {
        Intent i = new Intent(this, MissionDetailActivity.class);
        i.putExtra(MissionDetailActivity.EXTRA_MISSION_ID, String.valueOf(m.getId()));
        startActivity(i);
    }

    private void loadMissions() {
        showLoading();
        updateUserLocation();
        missionRepository.fetchMissions(new Callback<List<Mission>>() {
            @Override
            public void onSuccess(List<Mission> result) {
                handler.post(() -> {
                    swipeRefresh.setRefreshing(false); allMissions.clear();
                    int assignedCount = 0;
                    if (result != null) { 
                        allMissions.addAll(result); 
                        for (Mission m : result) {
                            if (m.getStatus() == MissionStatus.ASSIGNED) {
                                assignedCount++;
                            }
                        }
                    }
                    TextView tvMissionCount = MissionListActivity.this.findViewById(R.id.tvMissionCount);
                    if (tvMissionCount != null) {
                        tvMissionCount.setText(String.valueOf(assignedCount));
                    }
                    renderFilteredList();
                });
            }
            @Override
            public void onError(Throwable error) { handler.post(() -> { swipeRefresh.setRefreshing(false); Toast.makeText(MissionListActivity.this, "Error: " + error.getMessage(), Toast.LENGTH_LONG).show(); showErrorPage(); }); }
        });
    }

    private void showLoading() { flipper.setDisplayedChild(PAGE_LOADING); if (firstNetworkResultReceived) { if (backendOnline) setOnlineStatus(); else setOfflineStatus(); } }
    private void showErrorPage() { flipper.setDisplayedChild(PAGE_ERROR); if (firstNetworkResultReceived) { if (backendOnline) setOnlineStatus(); else setOfflineStatus(); } }
    private void setOnlineStatus() { tvStatusPill.setText(R.string.status_online); tvStatusPill.setBackgroundResource(R.drawable.pill_active); }
    private void setOfflineStatus() { tvStatusPill.setText(R.string.status_no_signal); tvStatusPill.setBackgroundResource(R.drawable.pill_offline); }

    private void renderFilteredList() {
        List<Mission> f = new ArrayList<>();
        for (Mission m : allMissions) {
            if (selectedTab == 0 && (m.getStatus() == MissionStatus.NEW || m.getStatus() == MissionStatus.ASSIGNED || m.getStatus() == MissionStatus.ACKNOWLEDGED || m.getStatus() == MissionStatus.IN_PROGRESS)) f.add(m);
            else if (selectedTab == 1 && m.getStatus() == MissionStatus.COMPLETED) f.add(m);
        }
        adapter.submitList(f); flipper.setDisplayedChild(f.isEmpty() ? PAGE_EMPTY : PAGE_CONTENT);
    }

    @Override protected void onResume() { super.onResume(); if (firstNetworkResultReceived && backendOnline) loadMissions(); }
}
