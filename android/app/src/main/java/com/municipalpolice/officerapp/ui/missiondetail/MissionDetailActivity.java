package com.municipalpolice.officerapp.ui.missiondetail;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
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

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.CancelMissionDialogFragment;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Screens "5 - Mission detail" and "6 - Mission, in progress".
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

    private FrameLayout photoSlot1;
    private FrameLayout photoSlot2;
    private FrameLayout photoSlot3;

    private String missionId;
    private Mission mission;
    private MissionRepository missionRepository;

    private ActivityResultLauncher<Void> cameraLauncher;
    private ActivityResultLauncher<String> cameraPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_mission_detail);

        missionRepository =
                new RetrofitMissionRepository(
                        new PrefsManager(this),
                        this
                );

        missionId =
                getIntent().getStringExtra(
                        EXTRA_MISSION_ID
                );

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

        findViewById(R.id.btnBack)
                .setOnClickListener(v -> finish());

        setUpStepRow(
                findViewById(R.id.step1),
                "1",
                R.string.mission_step_acknowledge
        );

        setUpStepRow(
                findViewById(R.id.step2),
                "2",
                R.string.mission_step_start
        );

        setUpStepRow(
                findViewById(R.id.step3),
                "3",
                R.string.mission_step_complete
        );

        findViewById(R.id.btnAcknowledge)
                .setOnClickListener(v -> {

                    if (mission == null) {
                        return;
                    }

                    if (mission.getStatus()
                            == MissionStatus.ACKNOWLEDGED) {

                        startMission();

                    } else {

                        acknowledgeMission();
                    }
                });

        findViewById(R.id.btnNavigate)
                .setOnClickListener(v ->
                        openNavigation()
                );

        findViewById(R.id.btnTakePhoto)
                .setOnClickListener(v ->
                        takePhoto()
                );

        findViewById(R.id.btnCompleteMission)
                .setOnClickListener(v ->
                        completeMission()
                );

        // ---------------------------------------------------------
        // CAMERA
        // ---------------------------------------------------------

        cameraLauncher =
                registerForActivityResult(
                        new ActivityResultContracts.TakePicturePreview(),
                        bitmap -> {

                            if (bitmap != null) {
                                saveAndUploadPhoto(bitmap);
                            }
                        }
                );

        cameraPermissionLauncher =
                registerForActivityResult(
                        new ActivityResultContracts.RequestPermission(),
                        granted -> {

                            if (granted) {

                                cameraLauncher.launch(null);

                            } else {

                                Toast.makeText(
                                        this,
                                        "Camera permission is required",
                                        Toast.LENGTH_SHORT
                                ).show();
                            }
                        }
                );

        loadMission();
    }

    private void setUpStepRow(
            View row,
            String number,
            int labelRes
    ) {

        TextView tvNumber =
                row.findViewById(
                        R.id.tvStepNumber
                );

        TextView tvLabel =
                row.findViewById(
                        R.id.tvStepLabel
                );

        tvNumber.setText(number);
        tvLabel.setText(labelRes);
    }

    private void loadMission() {

        missionRepository.getMissionById(
                missionId,
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(
                            Mission result
                    ) {

                        mission = result;

                        if (mission != null) {
                            render();
                        }
                    }

                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        String message =
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : getString(
                                        R.string.missions_error_title
                                );

                        Toast.makeText(
                                MissionDetailActivity.this,
                                message,
                                Toast.LENGTH_SHORT
                        ).show();

                        finish();
                    }
                }
        );
    }

    private void render() {

        tvMissionTitle.setText(
                mission.getTitle()
        );

        String location =
                mission.getAddress() != null
                        ? mission.getAddress()
                        : mission.getLatitude()
                          + ", "
                          + mission.getLongitude();

        tvAssignedBy.setText(
                getString(
                        R.string.mission_assigned_by,
                        location,
                        "Dispatch"
                )
        );

        tvMapDistance.setText(
                getString(
                        R.string.mission_map_distance,
                        "--"
                )
        );

        int pillRes;
        String label;

        switch (mission.getPriority()) {

            case URGENT:
            case HIGH:

                pillRes =
                        R.drawable.pill_urgent;

                label =
                        getString(
                                R.string.priority_urgent
                        );

                break;

            case MEDIUM:

                pillRes =
                        R.drawable.pill_pending;

                label =
                        getString(
                                R.string.priority_medium
                        );

                break;

            default:

                pillRes =
                        R.drawable.pill_active;

                label =
                        getString(
                                R.string.priority_low
                        );
        }

        tvPriorityPill.setBackgroundResource(
                pillRes
        );

        tvPriorityPill.setText(
                label
        );

        boolean isAwaitingStart =
                mission.getStatus()
                        == MissionStatus.ACKNOWLEDGED;

        boolean inProgress =
                mission.getStatus()
                        == MissionStatus.IN_PROGRESS

                        ||

                        mission.getStatus()
                                == MissionStatus.COMPLETED;

        flipper.setDisplayedChild(
                inProgress
                        ? PAGE_IN_PROGRESS
                        : PAGE_ASSIGNED
        );

        if (!inProgress) {

            TextView btnAction =
                    findViewById(
                            R.id.btnAcknowledge
                    );

            if (isAwaitingStart) {

                btnAction.setText(
                        R.string.mission_step_start
                );

            } else {

                btnAction.setText(
                        R.string.mission_acknowledge_button
                );
            }

        } else {

            tvAcknowledgedAt.setText(
                    getString(
                            R.string.mission_acknowledged_at,
                            formatTime(
                                    mission.getAcknowledgedAt()
                            )
                    )
            );

            tvStartedAt.setText(
                    getString(
                            R.string.mission_started_at,
                            formatTime(
                                    mission.getStartedAt()
                            )
                    )
            );

            renderPhotos();
        }
    }

    private String formatTime(
            String isoString
    ) {

        if (isoString == null) {
            return "--:--";
        }

        try {

            java.text.SimpleDateFormat sdf =
                    new java.text.SimpleDateFormat(
                            "yyyy-MM-dd'T'HH:mm:ss",
                            java.util.Locale.US
                    );

            sdf.setTimeZone(
                    java.util.TimeZone
                            .getTimeZone("UTC")
            );

            java.util.Date date =
                    sdf.parse(isoString);

            return DateFormat
                    .format(
                            "HH:mm",
                            date
                    )
                    .toString();

        } catch (Exception e) {

            return "--:--";
        }
    }

    private void renderPhotos() {

        int taken =
                mission.getPhotos().size();

        tvPhotoProgress.setText(
                getString(
                        R.string.mission_photo_progress,
                        taken,
                        mission.getRequiredPhotoCount()
                )
        );

        FrameLayout[] slots = {
                photoSlot1,
                photoSlot2,
                photoSlot3
        };

        for (int i = 0;
             i < slots.length;
             i++) {

            slots[i].setBackgroundResource(
                    i < taken
                            ? R.drawable.bg_map_preview
                            : R.drawable.bg_photo_slot
            );
        }
    }

    private void acknowledgeMission() {

        new androidx.appcompat.app.AlertDialog
                .Builder(this)

                .setTitle(
                        R.string.mission_acknowledge_warning_title
                )

                .setMessage(
                        R.string.mission_acknowledge_warning_body
                )

                .setPositiveButton(
                        R.string.generic_proceed,
                        (dialog, which) -> {

                            missionRepository
                                    .acknowledgeMission(
                                            missionId,
                                            new Callback<Mission>() {

                                                @Override
                                                public void onSuccess(
                                                        Mission result
                                                ) {

                                                    mission = result;

                                                    render();

                                                    Toast.makeText(
                                                            MissionDetailActivity.this,
                                                            R.string.mission_toast_acknowledged,
                                                            Toast.LENGTH_SHORT
                                                    ).show();
                                                }

                                                @Override
                                                public void onError(
                                                        Throwable error
                                                ) {

                                                    String message =
                                                            error.getMessage() != null
                                                                    ? error.getMessage()
                                                                    : getString(
                                                                    R.string.missions_error_title
                                                            );

                                                    Toast.makeText(
                                                            MissionDetailActivity.this,
                                                            message,
                                                            Toast.LENGTH_SHORT
                                                    ).show();
                                                }
                                            }
                                    );
                        }
                )

                .setNegativeButton(
                        R.string.generic_cancel,
                        null
                )

                .show();
    }

    private void startMission() {

        missionRepository.startMission(
                missionId,
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(
                            Mission result
                    ) {

                        mission = result;

                        render();
                    }

                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        String message =
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : getString(
                                        R.string.missions_error_title
                                );

                        Toast.makeText(
                                MissionDetailActivity.this,
                                message,
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                }
        );
    }

    private void openNavigation() {

        try {

            String query =
                    mission.getAddress() != null
                            ? mission.getAddress()
                            : mission.getLatitude()
                              + ","
                              + mission.getLongitude();

            Uri gmmIntentUri =
                    Uri.parse(
                            "geo:0,0?q="
                                    + Uri.encode(query)
                    );

            Intent mapIntent =
                    new Intent(
                            Intent.ACTION_VIEW,
                            gmmIntentUri
                    );

            startActivity(
                    mapIntent
            );

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    mission.getTitle(),
                    Toast.LENGTH_SHORT
            ).show();
        }
    }

    // ---------------------------------------------------------
    // TAKE PHOTO
    // ---------------------------------------------------------

    private void takePhoto() {

        if (mission == null) {
            return;
        }

        if (mission.getPhotos().size()
                >= mission.getRequiredPhotoCount()) {

            return;
        }

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED) {

            cameraLauncher.launch(null);

        } else {

            cameraPermissionLauncher.launch(
                    Manifest.permission.CAMERA
            );
        }
    }

    // ---------------------------------------------------------
    // SAVE PHOTO + UPLOAD TO DJANGO
    // ---------------------------------------------------------

    private void saveAndUploadPhoto(
            Bitmap bitmap
    ) {

        try {

            File photoFile =
                    new File(
                            getCacheDir(),
                            "mission_"
                                    + missionId
                                    + "_"
                                    + System.currentTimeMillis()
                                    + ".jpg"
                    );

            FileOutputStream outputStream =
                    new FileOutputStream(
                            photoFile
                    );

            bitmap.compress(
                    Bitmap.CompressFormat.JPEG,
                    90,
                    outputStream
            );

            outputStream.flush();
            outputStream.close();

            Toast.makeText(
                    this,
                    "Uploading photo...",
                    Toast.LENGTH_SHORT
            ).show();

            missionRepository.addMissionPhoto(
                    missionId,
                    photoFile.getAbsolutePath(),
                    new Callback<Mission>() {

                        @Override
                        public void onSuccess(
                                Mission result
                        ) {

                            mission = result;

                            render();

                            Toast.makeText(
                                    MissionDetailActivity.this,
                                    "Photo uploaded",
                                    Toast.LENGTH_SHORT
                            ).show();
                        }

                        @Override
                        public void onError(
                                Throwable error
                        ) {

                            String message =
                                    error.getMessage() != null
                                            ? error.getMessage()
                                            : "Photo upload failed";

                            Toast.makeText(
                                    MissionDetailActivity.this,
                                    message,
                                    Toast.LENGTH_LONG
                            ).show();
                        }
                    }
            );

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "Could not save photo: "
                            + e.getMessage(),
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private void completeMission() {

        if (!mission.hasMinimumPhotos()) {

            Toast.makeText(
                    this,
                    R.string.mission_take_photo,
                    Toast.LENGTH_SHORT
            ).show();

            return;
        }

        missionRepository.completeMission(
                missionId,
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(
                            Mission result
                    ) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                R.string.mission_completed_toast,
                                Toast.LENGTH_SHORT
                        ).show();

                        finish();
                    }

                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        String message =
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : getString(
                                        R.string.missions_error_title
                                );

                        Toast.makeText(
                                MissionDetailActivity.this,
                                message,
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                }
        );
    }

    public void onMissionCancelConfirmed(
            String reason
    ) {

        missionRepository.cancelMission(
                missionId,
                reason,
                new Callback<Void>() {

                    @Override
                    public void onSuccess(
                            Void result
                    ) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                R.string.cancel_mission_toast,
                                Toast.LENGTH_SHORT
                        ).show();

                        finish();
                    }

                    @Override
                    public void onError(
                            Throwable error
                    ) {

                        String message =
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : getString(
                                        R.string.missions_error_title
                                );

                        Toast.makeText(
                                MissionDetailActivity.this,
                                message,
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                }
        );
    }

    @Override
    public boolean onCreateOptionsMenu(
            Menu menu
    ) {

        getMenuInflater().inflate(
                R.menu.menu_mission_detail,
                menu
        );

        return true;
    }

    @Override
    public boolean onOptionsItemSelected(
            @NonNull MenuItem item
    ) {

        if (item.getItemId()
                == R.id.menu_cancel_mission) {

            CancelMissionDialogFragment
                    .newInstance()
                    .show(
                            getSupportFragmentManager(),
                            "cancel_mission"
                    );

            return true;
        }

        return super
                .onOptionsItemSelected(
                        item
                );
    }
}
