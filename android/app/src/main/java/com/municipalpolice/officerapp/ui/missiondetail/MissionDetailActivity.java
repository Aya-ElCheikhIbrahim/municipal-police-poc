package com.municipalpolice.officerapp.ui.missiondetail;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.format.DateFormat;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import androidx.annotation.NonNull;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.FakeMissionRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.CancelMissionDialogFragment;

/**
 * Screens "5 - Mission detail" (assigned: steps + Acknowledge/Navigate) and
 * "6 - Mission, in progress" (checklist + photos + Complete mission).
 * Both are one Activity with a ViewFlipper since they're the same mission,
 * just at different points in its lifecycle.
 */
public class MissionDetailActivity extends BaseActivity {

    public static final String EXTRA_MISSION_ID = "extra_mission_id";

    private static final int PAGE_ASSIGNED = 0;
    private static final int PAGE_IN_PROGRESS = 1;

    private ViewFlipper flipper;
    private TextView tvMissionTitle;
    private TextView tvPriorityPill;
    private TextView tvAssignedBy;
    private TextView tvMapDistance;
    private TextView tvAcknowledgedAt;
    private TextView tvStartedAt;
    private TextView tvPhotoProgress;
    private FrameLayout photoSlot1, photoSlot2, photoSlot3;

    private String missionId;
    private Mission mission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_mission_detail);

        missionId = getIntent().getStringExtra(EXTRA_MISSION_ID);

        flipper = findViewById(R.id.flipper);
        tvMissionTitle = findViewById(R.id.tvMissionTitle);
        tvPriorityPill = findViewById(R.id.tvPriorityPill);
        tvAssignedBy = findViewById(R.id.tvAssignedBy);
        tvMapDistance = findViewById(R.id.tvMapDistance);
        tvAcknowledgedAt = findViewById(R.id.tvAcknowledgedAt);
        tvStartedAt = findViewById(R.id.tvStartedAt);
        tvPhotoProgress = findViewById(R.id.tvPhotoProgress);
        photoSlot1 = findViewById(R.id.photoSlot1);
        photoSlot2 = findViewById(R.id.photoSlot2);
        photoSlot3 = findViewById(R.id.photoSlot3);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        setUpStepRow(findViewById(R.id.step1), "1", R.string.mission_step_acknowledge);
        setUpStepRow(findViewById(R.id.step2), "2", R.string.mission_step_start);
        setUpStepRow(findViewById(R.id.step3), "3", R.string.mission_step_complete);

        findViewById(R.id.btnAcknowledge).setOnClickListener(v -> acknowledgeMission());
        findViewById(R.id.btnNavigate).setOnClickListener(v -> openNavigation());
        findViewById(R.id.btnTakePhoto).setOnClickListener(v -> takePhoto());
        findViewById(R.id.btnCompleteMission).setOnClickListener(v -> completeMission());

        loadMission();
    }

    private void setUpStepRow(View row, String number, int labelRes) {
        TextView tvNumber = row.findViewById(R.id.tvStepNumber);
        TextView tvLabel = row.findViewById(R.id.tvStepLabel);
        tvNumber.setText(number);
        tvLabel.setText(labelRes);
    }

    private void loadMission() {
        FakeMissionRepository.getInstance().fetchMissions(new Callback<java.util.List<Mission>>() {
            @Override
            public void onSuccess(java.util.List<Mission> result) {
                for (Mission m : result) {
                    if (m.getId().equals(missionId)) {
                        mission = m;
                        break;
                    }
                }
                if (mission != null) render();
            }

            @Override
            public void onError(Throwable error) {
                Toast.makeText(MissionDetailActivity.this, R.string.missions_error_title, Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void render() {
        tvMissionTitle.setText(mission.getTitle());
        tvAssignedBy.setText(getString(R.string.mission_assigned_by, mission.getLocation(), mission.getAssignedBy()));
        tvMapDistance.setText(getString(R.string.mission_map_distance, mission.getDistanceMeters()));

        int pillRes;
        String label;
        switch (mission.getPriority()) {
            case URGENT:
                pillRes = R.drawable.pill_urgent;
                label = getString(R.string.priority_urgent);
                break;
            case MEDIUM:
                pillRes = R.drawable.pill_pending;
                label = getString(R.string.priority_medium);
                break;
            default:
                pillRes = R.drawable.pill_active;
                label = getString(R.string.priority_low);
        }
        tvPriorityPill.setBackgroundResource(pillRes);
        tvPriorityPill.setText(label);

        boolean inProgress = mission.getStatus() == MissionStatus.IN_PROGRESS
                || mission.getStatus() == MissionStatus.COMPLETED;
        flipper.setDisplayedChild(inProgress ? PAGE_IN_PROGRESS : PAGE_ASSIGNED);

        if (inProgress) {
            tvAcknowledgedAt.setText(getString(R.string.mission_acknowledged_at, formatTime(mission.getAcknowledgedAtMillis())));
            tvStartedAt.setText(getString(R.string.mission_started_at, formatTime(mission.getStartedAtMillis())));
            renderPhotos();
        }
    }

    private String formatTime(long millis) {
        if (millis <= 0) return "--:--";
        return DateFormat.format("HH:mm", millis).toString();
    }

    private void renderPhotos() {
        int taken = mission.getPhotoUris().size();
        tvPhotoProgress.setText(getString(R.string.mission_photo_progress, taken, mission.getRequiredPhotoCount()));

        FrameLayout[] slots = { photoSlot1, photoSlot2, photoSlot3 };
        for (int i = 0; i < slots.length; i++) {
            slots[i].setBackgroundResource(i < taken ? R.drawable.bg_map_preview : R.drawable.bg_photo_slot);
        }
    }

    private void acknowledgeMission() {
        FakeMissionRepository.getInstance().acknowledgeMission(missionId, new Callback<Mission>() {
            @Override
            public void onSuccess(Mission result) {
                mission = result;
                render();
            }

            @Override
            public void onError(Throwable error) {
                Toast.makeText(MissionDetailActivity.this, R.string.missions_error_title, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void openNavigation() {
        // TODO(backend): replace with real coordinates once dispatch sends them;
        // for now this opens a generic maps search on the mission's location text.
        try {
            Uri gmmIntentUri = Uri.parse("geo:0,0?q=" + Uri.encode(mission.getLocation()));
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            startActivity(mapIntent);
        } catch (Exception e) {
            Toast.makeText(this, mission.getLocation(), Toast.LENGTH_SHORT).show();
        }
    }

    private void takePhoto() {
        // TODO(backend): launch the real camera via ACTION_IMAGE_CAPTURE / CameraX,
        // then upload through MissionRepository#addMissionPhoto. For this UI mock we
        // just record a placeholder so the "N of 5 photos" state is demonstrable.
        if (mission.getPhotoUris().size() >= mission.getRequiredPhotoCount()) return;
        FakeMissionRepository.getInstance().addMissionPhoto(
                missionId, "mock://photo-" + System.currentTimeMillis(), new Callback<Mission>() {
                    @Override
                    public void onSuccess(Mission result) {
                        mission = result;
                        renderPhotos();
                    }

                    @Override
                    public void onError(Throwable error) { }
                });
    }

    private void completeMission() {
        if (!mission.hasMinimumPhotos()) {
            Toast.makeText(this, R.string.mission_take_photo, Toast.LENGTH_SHORT).show();
            return;
        }
        FakeMissionRepository.getInstance().completeMission(missionId, new Callback<Mission>() {
            @Override
            public void onSuccess(Mission result) {
                Toast.makeText(MissionDetailActivity.this, R.string.mission_completed_toast, Toast.LENGTH_SHORT).show();
                finish();
            }

            @Override
            public void onError(Throwable error) {
                Toast.makeText(MissionDetailActivity.this, R.string.missions_error_title, Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void onMissionCancelConfirmed(String reason) {
        FakeMissionRepository.getInstance().cancelMission(missionId, reason, new Callback<Void>() {
            @Override
            public void onSuccess(Void result) {
                Toast.makeText(MissionDetailActivity.this, R.string.cancel_mission_toast, Toast.LENGTH_SHORT).show();
                finish();
            }

            @Override
            public void onError(Throwable error) {
                Toast.makeText(MissionDetailActivity.this, R.string.missions_error_title, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_mission_detail, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.menu_cancel_mission) {
            CancelMissionDialogFragment.newInstance().show(getSupportFragmentManager(), "cancel_mission");
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
