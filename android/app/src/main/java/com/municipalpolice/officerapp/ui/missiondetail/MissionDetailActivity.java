package com.municipalpolice.officerapp.ui.missiondetail;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
import com.municipalpolice.officerapp.data.LocationTracker;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.NetworkMonitor;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.data.StandardLocationTracker;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.CancelMissionDialogFragment;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.io.File;
import java.io.FileOutputStream;

import org.osmdroid.api.IMapController;
import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

public class MissionDetailActivity extends BaseActivity {

    public static final String EXTRA_MISSION_ID = "extra_mission_id";

    private static final int PAGE_ASSIGNED = 0;
    private static final int PAGE_IN_PROGRESS = 1;

    private ViewFlipper flipper;
    private TextView tvMissionTitle;
    private TextView tvPriorityPill;
    private TextView tvAssignedBy;
    private MapView mapView;
    private TextView tvAcknowledgedAt;
    private TextView tvStartedAt;
    private TextView tvPhotoProgress;
    private TextView tvStatusPill;

    private View groupOfflineNotice;

    private FrameLayout photoSlot1;
    private FrameLayout photoSlot2;
    private FrameLayout photoSlot3;

    private String missionId;
    private Mission mission;
    private MissionRepository missionRepository;
    private LocationTracker locationTracker;

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                Boolean fineLocationGranted = result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false);
                Boolean coarseLocationGranted = result.getOrDefault(Manifest.permission.ACCESS_COARSE_LOCATION, false);
                if (fineLocationGranted != null && fineLocationGranted) {
                    startLocationTrackingIfNecessary();
                } else if (coarseLocationGranted != null && coarseLocationGranted) {
                    startLocationTrackingIfNecessary();
                } else {
                    Toast.makeText(this, R.string.mission_location_permission_denied, Toast.LENGTH_LONG).show();
                }
            });

    private NetworkMonitor networkMonitor;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private ActivityResultLauncher<Void> cameraLauncher;
    private ActivityResultLauncher<String> cameraPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // OSMdroid initialization
        Configuration.getInstance().setUserAgentValue(getPackageName());

        setContentView(R.layout.activity_mission_detail);

        missionRepository = new RetrofitMissionRepository(new PrefsManager(this), this);
        locationTracker = new StandardLocationTracker(this);
        missionId = getIntent().getStringExtra(EXTRA_MISSION_ID);

        flipper = findViewById(R.id.flipper);
        tvMissionTitle = findViewById(R.id.tvMissionTitle);
        tvPriorityPill = findViewById(R.id.tvPriorityPill);
        tvAssignedBy = findViewById(R.id.tvAssignedBy);
        mapView = findViewById(R.id.mapView);
        tvAcknowledgedAt = findViewById(R.id.tvAcknowledgedAt);
        tvStartedAt = findViewById(R.id.tvStartedAt);
        tvPhotoProgress = findViewById(R.id.tvPhotoProgress);
        tvStatusPill = findViewById(R.id.tvStatusPill);

        groupOfflineNotice = findViewById(R.id.groupOfflineNotice);

        photoSlot1 = findViewById(R.id.photoSlot1);
        photoSlot2 = findViewById(R.id.photoSlot2);
        photoSlot3 = findViewById(R.id.photoSlot3);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        setUpStepRow(findViewById(R.id.step1), "1", R.string.mission_step_acknowledge);
        setUpStepRow(findViewById(R.id.step2), "2", R.string.mission_step_start);
        setUpStepRow(findViewById(R.id.step3), "3", R.string.mission_step_complete);

        findViewById(R.id.btnAcknowledge).setOnClickListener(v -> {
            if (mission.getStatus() == MissionStatus.ACKNOWLEDGED) {
                startMission();
            } else {
                acknowledgeMission();
            }
        });
        findViewById(R.id.btnNavigate).setOnClickListener(v -> openNavigation());
        findViewById(R.id.btnMapNavigate).setOnClickListener(v -> openNavigation());
        findViewById(R.id.btnTakePhoto).setOnClickListener(v -> takePhoto());
        findViewById(R.id.btnCompleteMission).setOnClickListener(v -> completeMission());

        // Camera
        cameraLauncher = registerForActivityResult(
                new ActivityResultContracts.TakePicturePreview(),
                bitmap -> {
                    if (bitmap != null) {
                        saveAndUploadPhoto(bitmap);
                    }
                }
        );

        cameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                granted -> {
                    if (granted) {
                        cameraLauncher.launch(null);
                    } else {
                        Toast.makeText(this, "Camera permission is required", Toast.LENGTH_SHORT).show();
                    }
                }
        );

        // Network Monitor
        networkMonitor = new NetworkMonitor(
                this,
                new NetworkMonitor.Listener() {
                    @Override
                    public void onNetworkAvailable() {
                        handler.post(() -> {
                            setOnlineStatus();
                            if (groupOfflineNotice != null) {
                                groupOfflineNotice.setVisibility(View.GONE);
                            }
                            if (mission == null) {
                                loadMission();
                            }
                        });
                    }

                    @Override
                    public void onNetworkLost() {
                        handler.post(() -> {
                            setOfflineStatus();
                            if (groupOfflineNotice != null) {
                                groupOfflineNotice.setVisibility(View.VISIBLE);
                            }
                        });
                    }
                }
        );

        initMap();
        checkLocationPermissions();
        loadMission();
    }

    private void initMap() {
        mapView.setTileSource(TileSourceFactory.MAPNIK);
        mapView.setMultiTouchControls(true);
        mapView.setBuiltInZoomControls(false);
    }

    private void checkLocationPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            locationPermissionLauncher.launch(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            });
        } else {
            startLocationTrackingIfNecessary();
        }
    }

    private void startLocationTrackingIfNecessary() {
        if (mission != null && mission.getStatus() == MissionStatus.IN_PROGRESS) {
            locationTracker.startTracking(missionId);
        }
    }

    private void updateMapLocation() {
        if (mission == null || mission.getLatitude() == null || mission.getLongitude() == null) return;

        GeoPoint startPoint = new GeoPoint(mission.getLatitude(), mission.getLongitude());
        IMapController mapController = mapView.getController();
        mapController.setZoom(17.5);
        mapController.setCenter(startPoint);

        Marker startMarker = new Marker(mapView);
        startMarker.setPosition(startPoint);
        startMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
        startMarker.setTitle(mission.getTitle());

        mapView.getOverlays().clear();
        mapView.getOverlays().add(startMarker);
        mapView.invalidate();
    }

    private void setUpStepRow(View row, String number, int labelRes) {
        TextView tvNumber = row.findViewById(R.id.tvStepNumber);
        TextView tvLabel = row.findViewById(R.id.tvStepLabel);
        tvNumber.setText(number);
        tvLabel.setText(labelRes);
    }

    private void loadMission() {
        missionRepository.getMissionById(missionId, new Callback<Mission>() {
            @Override
            public void onSuccess(Mission result) {
                mission = result;
                if (mission != null) {
                    render();
                }
            }

            @Override
            public void onError(Throwable error) {
                String message = error.getMessage() != null
                        ? error.getMessage()
                        : getString(R.string.missions_error_title);
                Toast.makeText(MissionDetailActivity.this, message, Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void setOnlineStatus() {
        if (tvStatusPill == null) return;
        tvStatusPill.setText(R.string.status_online);
        tvStatusPill.setBackgroundResource(R.drawable.pill_active);
    }

    private void setOfflineStatus() {
        if (tvStatusPill == null) return;
        tvStatusPill.setText(R.string.status_no_signal);
        tvStatusPill.setBackgroundResource(R.drawable.pill_offline);
    }

    private void updateStepRowStatus(View row, boolean isDone, boolean isCurrent) {
        View vNumber = row.findViewById(R.id.tvStepNumber);
        View vLabel = row.findViewById(R.id.tvStepLabel);

        if (isDone) {
            vNumber.setBackgroundResource(R.drawable.circle_step_done);
            if (vNumber instanceof TextView) ((TextView) vNumber).setText("");
            vLabel.setAlpha(0.5f);
        } else if (isCurrent) {
            vNumber.setBackgroundResource(R.drawable.circle_step_current);
            vLabel.setAlpha(1.0f);
        } else {
            vNumber.setBackgroundResource(R.drawable.circle_step_pending);
            vLabel.setAlpha(0.5f);
        }
    }

    private void render() {
        tvMissionTitle.setText(mission.getTitle());
        String location = mission.getLocationDisplay();
        tvAssignedBy.setText(getString(R.string.mission_assigned_by, location, "Dispatch"));
        updateMapLocation();

        int pillRes;
        String label;

        switch (mission.getPriority()) {
            case URGENT:
            case HIGH:
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

        boolean isAcknowledged = mission.getStatus() == MissionStatus.ACKNOWLEDGED;
        boolean inProgress = mission.getStatus() == MissionStatus.IN_PROGRESS
                || mission.getStatus() == MissionStatus.COMPLETED;

        flipper.setDisplayedChild(inProgress ? PAGE_IN_PROGRESS : PAGE_ASSIGNED);

        if (!inProgress) {
            TextView btnAction = findViewById(R.id.btnAcknowledge);
            if (isAcknowledged) {
                btnAction.setText(R.string.mission_step_start);
                updateStepRowStatus(findViewById(R.id.step1), true, false);
                updateStepRowStatus(findViewById(R.id.step2), false, true);
                updateStepRowStatus(findViewById(R.id.step3), false, false);
            } else {
                btnAction.setText(R.string.mission_acknowledge_button);
                updateStepRowStatus(findViewById(R.id.step1), false, true);
                updateStepRowStatus(findViewById(R.id.step2), false, false);
                updateStepRowStatus(findViewById(R.id.step3), false, false);
            }
        } else {
            tvAcknowledgedAt.setText(
                    getString(R.string.mission_acknowledged_at, formatTime(mission.getAcknowledgedAt()))
            );
            tvStartedAt.setText(
                    getString(R.string.mission_started_at, formatTime(mission.getStartedAt()))
            );
            renderPhotos();
        }
    }

    private String formatTime(String isoString) {
        if (isoString == null) return "--:--";
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat(
                    "yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US
            );
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.util.Date date = sdf.parse(isoString);
            return DateFormat.format("HH:mm", date).toString();
        } catch (Exception e) {
            return "--:--";
        }
    }

    private void renderPhotos() {
        int taken = mission.getPhotos().size();
        tvPhotoProgress.setText(
                getString(R.string.mission_photo_progress, taken, mission.getRequiredPhotoCount())
        );

        FrameLayout[] slots = {photoSlot1, photoSlot2, photoSlot3};
        for (int i = 0; i < slots.length; i++) {
            slots[i].setBackgroundResource(
                    i < taken ? R.drawable.bg_map_preview : R.drawable.bg_photo_slot
            );
        }
    }

    private void acknowledgeMission() {
        new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle(R.string.mission_acknowledge_warning_title)
                .setMessage(R.string.mission_acknowledge_warning_body)
                .setPositiveButton(R.string.generic_proceed, (dialog, which) -> {
                    missionRepository.acknowledgeMission(missionId, new Callback<Mission>() {
                        @Override
                        public void onSuccess(Mission result) {
                            mission = result;
                            render();
                            Toast.makeText(MissionDetailActivity.this,
                                    R.string.mission_toast_acknowledged, Toast.LENGTH_SHORT).show();
                        }

                        @Override
                        public void onError(Throwable error) {
                            String message = error.getMessage() != null
                                    ? error.getMessage()
                                    : getString(R.string.missions_error_title);
                            Toast.makeText(MissionDetailActivity.this, message, Toast.LENGTH_SHORT).show();
                        }
                    });
                })
                .setNegativeButton(R.string.generic_cancel, null)
                .show();
    }

    private void startMission() {
        missionRepository.startMission(missionId, new Callback<Mission>() {
            @Override
            public void onSuccess(Mission result) {
                mission = result;
                render();
                startLocationTrackingIfNecessary();
            }

            @Override
            public void onError(Throwable error) {
                String message = error.getMessage() != null
                        ? error.getMessage()
                        : getString(R.string.missions_error_title);
                Toast.makeText(MissionDetailActivity.this, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void openNavigation() {
        try {
            String query = mission.getAddress() != null
                    ? mission.getAddress()
                    : mission.getLatitude() + "," + mission.getLongitude();
            Uri gmmIntentUri = Uri.parse("geo:0,0?q=" + Uri.encode(query));
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            startActivity(mapIntent);
        } catch (Exception e) {
            Toast.makeText(this, mission.getTitle(), Toast.LENGTH_SHORT).show();
        }
    }

    private void takePhoto() {
        if (mission == null) return;
        if (mission.getPhotos().size() >= mission.getRequiredPhotoCount()) return;

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            cameraLauncher.launch(null);
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
        }
    }

    private void saveAndUploadPhoto(Bitmap bitmap) {
        try {
            File photoFile = new File(getCacheDir(),
                    "mission_" + missionId + "_" + System.currentTimeMillis() + ".jpg");
            FileOutputStream outputStream = new FileOutputStream(photoFile);
            bitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream);
            outputStream.flush();
            outputStream.close();

            Toast.makeText(this, "Uploading photo...", Toast.LENGTH_SHORT).show();

            missionRepository.addMissionPhoto(missionId, photoFile.getAbsolutePath(), new Callback<Mission>() {
                @Override
                public void onSuccess(Mission result) {
                    mission = result;
                    render();
                    Toast.makeText(MissionDetailActivity.this, "Photo uploaded", Toast.LENGTH_SHORT).show();
                }

                @Override
                public void onError(Throwable error) {
                    String message = error.getMessage() != null ? error.getMessage() : "Photo upload failed";
                    Toast.makeText(MissionDetailActivity.this, message, Toast.LENGTH_LONG).show();
                }
            });
        } catch (Exception e) {
            Toast.makeText(this, "Could not save photo: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void completeMission() {
        if (!mission.hasMinimumPhotos()) {
            Toast.makeText(this, R.string.mission_take_photo, Toast.LENGTH_SHORT).show();
            return;
        }

        missionRepository.completeMission(missionId, new Callback<Mission>() {
            @Override
            public void onSuccess(Mission result) {
                Toast.makeText(MissionDetailActivity.this, R.string.mission_completed_toast, Toast.LENGTH_SHORT).show();
                finish();
            }

            @Override
            public void onError(Throwable error) {
                String message = error.getMessage() != null
                        ? error.getMessage()
                        : getString(R.string.missions_error_title);
                Toast.makeText(MissionDetailActivity.this, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    public void onMissionCancelConfirmed(String reason) {
        missionRepository.cancelMission(missionId, reason, new Callback<Void>() {
            @Override
            public void onSuccess(Void result) {
                Toast.makeText(MissionDetailActivity.this, R.string.cancel_mission_toast, Toast.LENGTH_SHORT).show();
                finish();
            }

            @Override
            public void onError(Throwable error) {
                String message = error.getMessage() != null
                        ? error.getMessage()
                        : getString(R.string.missions_error_title);
                Toast.makeText(MissionDetailActivity.this, message, Toast.LENGTH_SHORT).show();
            }
        });
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
        mapView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        mapView.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (networkMonitor != null) {
            networkMonitor.stop();
        }
        locationTracker.stopTracking();
        super.onDestroy();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.menu_mission_detail, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == R.id.menu_cancel_mission) {
            CancelMissionDialogFragment.newInstance()
                    .show(getSupportFragmentManager(), "cancel_mission");
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}