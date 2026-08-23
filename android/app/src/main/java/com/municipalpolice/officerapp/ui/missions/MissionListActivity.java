package com.municipalpolice.officerapp.ui.missions;

import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.widget.ViewFlipper;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.tabs.TabLayout;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.FakeMissionRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.missiondetail.MissionDetailActivity;

import java.util.ArrayList;
import java.util.List;

/** Screen "4 - Mission list" with New / In progress / Completed tabs and every load state from the mockups. */
public class MissionListActivity extends BaseActivity {

    private static final int PAGE_LOADING = 0;
    private static final int PAGE_CONTENT = 1;
    private static final int PAGE_EMPTY = 2;
    private static final int PAGE_ERROR = 3;

    private ViewFlipper flipper;
    private SwipeRefreshLayout swipeRefresh;
    private MissionAdapter adapter;
    private final List<Mission> allMissions = new ArrayList<>();
    private int selectedTab = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mission_list);

        flipper = findViewById(R.id.flipper);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        RecyclerView recyclerView = findViewById(R.id.recyclerMissions);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new MissionAdapter(this::openMissionDetail);
        recyclerView.setAdapter(adapter);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.btnTryAgain).setOnClickListener(v -> loadMissions());
        swipeRefresh.setOnRefreshListener(this::loadMissions);

        TabLayout tabLayout = findViewById(R.id.tabLayout);
        tabLayout.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override public void onTabSelected(TabLayout.Tab tab) {
                selectedTab = tab.getPosition();
                renderFilteredList();
            }
            @Override public void onTabUnselected(TabLayout.Tab tab) { }
            @Override public void onTabReselected(TabLayout.Tab tab) { }
        });

        loadMissions();
    }

    private void openMissionDetail(Mission mission) {
        Intent intent = new Intent(this, MissionDetailActivity.class);
        intent.putExtra(MissionDetailActivity.EXTRA_MISSION_ID, mission.getId());
        startActivity(intent);
    }

    private void loadMissions() {
        flipper.setDisplayedChild(PAGE_LOADING);
        FakeMissionRepository.getInstance().fetchMissions(new Callback<List<Mission>>() {
            @Override
            public void onSuccess(List<Mission> result) {
                swipeRefresh.setRefreshing(false);
                allMissions.clear();
                allMissions.addAll(result);
                renderFilteredList();
            }

            @Override
            public void onError(Throwable error) {
                swipeRefresh.setRefreshing(false);
                flipper.setDisplayedChild(PAGE_ERROR);
            }
        });
    }

    private void renderFilteredList() {
        List<Mission> filtered = new ArrayList<>();
        for (Mission m : allMissions) {
            boolean matchesTab =
                    (selectedTab == 0 && m.getStatus() == MissionStatus.NEW) ||
                    (selectedTab == 1 && (m.getStatus() == MissionStatus.ACKNOWLEDGED || m.getStatus() == MissionStatus.IN_PROGRESS)) ||
                    (selectedTab == 2 && m.getStatus() == MissionStatus.COMPLETED);
            if (matchesTab) filtered.add(m);
        }
        adapter.submitList(filtered);
        flipper.setDisplayedChild(filtered.isEmpty() ? PAGE_EMPTY : PAGE_CONTENT);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Re-pull so status changes made in MissionDetailActivity (acknowledge/
        // complete/cancel) are reflected when the officer comes back to the list.
        if (flipper.getDisplayedChild() == PAGE_CONTENT || flipper.getDisplayedChild() == PAGE_EMPTY) {
            loadMissions();
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_missions, menu);
        return true;
    }

    /** Demo-only: lets you preview loading/empty/error states without a real backend. */
    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        int id = item.getItemId();
        if (id == R.id.menu_state_loading) {
            flipper.setDisplayedChild(PAGE_LOADING);
            return true;
        } else if (id == R.id.menu_state_success) {
            FakeMissionRepository.getInstance().resetSeed();
            loadMissions();
            return true;
        } else if (id == R.id.menu_state_empty) {
            FakeMissionRepository.getInstance().clearAll();
            loadMissions();
            return true;
        } else if (id == R.id.menu_state_error) {
            flipper.setDisplayedChild(PAGE_ERROR);
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
