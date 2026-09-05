package com.municipalpolice.officerapp.ui.missions;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.TextView;
import android.widget.ViewFlipper;

import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.tabs.TabLayout;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.NetworkMonitor;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.missiondetail.MissionDetailActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.util.ArrayList;
import java.util.List;

/**
 * Mission list screen.
 *
 * Uses the same backend-aware NetworkMonitor as ShiftActivity,
 * so both screens agree on Online / No signal.
 */
public class MissionListActivity extends BaseActivity {

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

        setContentView(R.layout.activity_mission_list);

        // ---------------------------------------------------------
        // REPOSITORY
        // ---------------------------------------------------------

        missionRepository =
                new RetrofitMissionRepository(
                        new PrefsManager(this),
                        this
                );

        // ---------------------------------------------------------
        // VIEWS
        // ---------------------------------------------------------

        flipper =
                findViewById(R.id.flipper);

        swipeRefresh =
                findViewById(R.id.swipeRefresh);

        tvStatusPill =
                findViewById(R.id.tvStatusPill);

        groupOfflineNotice =
                findViewById(R.id.groupOfflineNotice);

        RecyclerView recyclerView =
                findViewById(R.id.recyclerMissions);

        recyclerView.setLayoutManager(
                new LinearLayoutManager(this)
        );

        adapter =
                new MissionAdapter(
                        this::openMissionDetail
                );

        recyclerView.setAdapter(adapter);

        // ---------------------------------------------------------
        // NETWORK MONITOR
        // ---------------------------------------------------------

        networkMonitor =
                new NetworkMonitor(
                        this,
                        new NetworkMonitor.Listener() {

                            @Override
                            public void onNetworkAvailable() {

                                handler.post(() -> {

                                    boolean wasOffline =
                                            firstNetworkResultReceived
                                                    && !backendOnline;

                                    backendOnline = true;
                                    firstNetworkResultReceived = true;

                                    setOnlineStatus();

                                    if (groupOfflineNotice != null) {
                                        groupOfflineNotice.setVisibility(View.GONE);
                                    }

                                    /*
                                     * If Django has just returned,
                                     * reload missions automatically.
                                     */
                                    if (wasOffline
                                            || flipper.getDisplayedChild()
                                            == PAGE_ERROR) {

                                        loadMissions();
                                    }
                                });
                            }

                            @Override
                            public void onNetworkLost() {

                                handler.post(() -> {

                                    backendOnline = false;
                                    firstNetworkResultReceived = true;

                                    setOfflineStatus();

                                    swipeRefresh.setRefreshing(false);

                                    if (groupOfflineNotice != null) {
                                        groupOfflineNotice.setVisibility(View.VISIBLE);
                                    }

                                    /*
                                     * Only show full error page if we don't have
                                     * any data to show yet.
                                     */
                                    if (allMissions.isEmpty()) {
                                        showErrorPage();
                                    }
                                });
                            }
                        }
                );

        // ---------------------------------------------------------
        // BACK
        // ---------------------------------------------------------

        findViewById(R.id.btnBack)
                .setOnClickListener(
                        v -> finish()
                );

        // ---------------------------------------------------------
        // TRY AGAIN
        // ---------------------------------------------------------

        findViewById(R.id.btnTryAgain)
                .setOnClickListener(
                        v -> loadMissions()
                );

        // ---------------------------------------------------------
        // PULL TO REFRESH
        // ---------------------------------------------------------

        swipeRefresh.setOnRefreshListener(
                this::loadMissions
        );

        // ---------------------------------------------------------
        // TABS
        // ---------------------------------------------------------

        TabLayout tabLayout =
                findViewById(R.id.tabLayout);

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
                        // Nothing required
                    }

                    @Override
                    public void onTabReselected(
                            TabLayout.Tab tab
                    ) {
                        // Nothing required
                    }
                }
        );

        // Start with loading UI.
        showLoading();
    }

    // ---------------------------------------------------------
    // LIFECYCLE
    // ---------------------------------------------------------

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
    protected void onDestroy() {

        handler.removeCallbacksAndMessages(null);

        if (networkMonitor != null) {
            networkMonitor.stop();
        }

        super.onDestroy();
    }

    // ---------------------------------------------------------
    // MISSION DETAIL
    // ---------------------------------------------------------

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
                String.valueOf(mission.getId())
        );

        startActivity(intent);
    }

    // ---------------------------------------------------------
    // LOAD MISSIONS
    // ---------------------------------------------------------

    private void loadMissions() {

        showLoading();

        missionRepository.fetchMissions(
                new Callback<List<Mission>>() {

                    @Override
                    public void onSuccess(
                            List<Mission> result
                    ) {

                        handler.post(() -> {

                            swipeRefresh.setRefreshing(false);

                            /*
                             * Do NOT decide connectivity here.
                             *
                             * NetworkMonitor owns Online/No signal.
                             */

                            allMissions.clear();

                            if (result != null) {
                                allMissions.addAll(result);
                            }

                            renderFilteredList();
                        });
                    }

                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        handler.post(() -> {

                            swipeRefresh.setRefreshing(false);

                            /*
                             * A mission request can fail for reasons
                             * other than connectivity (401, 403, 500).
                             *
                             * Therefore we don't automatically call
                             * setOfflineStatus() here.
                             */

                            showErrorPage();
                        });
                    }
                }
        );
    }

    // ---------------------------------------------------------
    // LOADING
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // ERROR
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // STATUS
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // FILTER MISSIONS
    // ---------------------------------------------------------

    private void renderFilteredList() {

        List<Mission> filtered =
                new ArrayList<>();

        for (Mission mission : allMissions) {

            boolean matchesTab =

                    // NEW
                    (
                            selectedTab == 0
                                    &&
                                    (
                                            mission.getStatus()
                                                    == MissionStatus.NEW

                                                    ||

                                                    mission.getStatus()
                                                            == MissionStatus.ASSIGNED
                                    )
                    )

                            ||

                            // IN PROGRESS
                            (
                                    selectedTab == 1
                                            &&
                                            (
                                                    mission.getStatus()
                                                            == MissionStatus.ACKNOWLEDGED

                                                            ||

                                                            mission.getStatus()
                                                                    == MissionStatus.IN_PROGRESS
                                            )
                            )

                            ||

                            // COMPLETED
                            (
                                    selectedTab == 2
                                            &&
                                            mission.getStatus()
                                                    == MissionStatus.COMPLETED
                            );

            if (matchesTab) {
                filtered.add(mission);
            }
        }

        adapter.submitList(filtered);

        if (filtered.isEmpty()) {

            flipper.setDisplayedChild(
                    PAGE_EMPTY
            );

        } else {

            flipper.setDisplayedChild(
                    PAGE_CONTENT
            );
        }
    }

    // ---------------------------------------------------------
    // RETURNING FROM MISSION DETAIL
    // ---------------------------------------------------------

    @Override
    protected void onResume() {

        super.onResume();

        if (firstNetworkResultReceived
                && backendOnline
                && (
                flipper.getDisplayedChild()
                        == PAGE_CONTENT

                        ||

                        flipper.getDisplayedChild()
                                == PAGE_EMPTY
        )) {

            loadMissions();
        }
    }
}

