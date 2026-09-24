package com.municipalpolice.officerapp.ui.missiondetail;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.format.DateFormat;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.bumptech.glide.Glide;
import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.LocationTracker;
import com.municipalpolice.officerapp.data.MissionRepository;
import com.municipalpolice.officerapp.data.NetworkMonitor;
import com.municipalpolice.officerapp.data.RetrofitMissionRepository;
import com.municipalpolice.officerapp.data.StandardLocationTracker;
import com.municipalpolice.officerapp.model.Mission;
import com.municipalpolice.officerapp.model.MissionPhoto;
import com.municipalpolice.officerapp.model.MissionStatus;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.ui.dialogs.CancelMissionDialogFragment;
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;

import org.osmdroid.api.IMapController;
import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

public class MissionDetailActivity extends BaseActivity
        implements PanicAlertDialogFragment.PanicListener {

    public static final String EXTRA_MISSION_ID = "extra_mission_id";

    private static final int PAGE_ASSIGNED = 0;
    private static final int PAGE_IN_PROGRESS = 1;

    private ViewFlipper flipper;

    private TextView tvMissionTitle;
    private TextView tvPriorityPill;
    private TextView tvAssignedBy;
    private TextView tvStartedAt;
    private TextView tvPhotoProgress;
    private TextView tvStatusPill;

    private MapView mapView;
    private View groupOfflineNotice;

    private FrameLayout photoSlot1;
    private FrameLayout photoSlot2;
    private FrameLayout photoSlot3;

    private String missionId;
    private Mission mission;

    private MissionRepository missionRepository;
    private LocationTracker locationTracker;
    private NetworkMonitor networkMonitor;

    private File currentPhotoFile;
    private Uri currentPhotoUri;

    private final Handler handler =
            new Handler(Looper.getMainLooper());

    private ActivityResultLauncher<Uri> cameraLauncher;
    private ActivityResultLauncher<String> cameraPermissionLauncher;

    private final ActivityResultLauncher<String[]>
            locationPermissionLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    result -> {

                        boolean granted =
                                result.getOrDefault(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        false
                                ) ||
                                        result.getOrDefault(
                                                Manifest.permission.ACCESS_COARSE_LOCATION,
                                                false
                                        );

                        if (granted) {
                            startLocationTrackingIfNecessary();
                        } else {
                            Toast.makeText(
                                    this,
                                    R.string.mission_location_permission_denied,
                                    Toast.LENGTH_LONG
                            ).show();
                        }
                    }
            );

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        Configuration.getInstance()
                .setUserAgentValue(getPackageName());

        setContentView(R.layout.activity_mission_detail);

        missionRepository =
                new RetrofitMissionRepository(
                        new PrefsManager(this),
                        this
                );

        locationTracker =
                new StandardLocationTracker(this);

        missionId =
                getIntent().getStringExtra(EXTRA_MISSION_ID);

        flipper =
                findViewById(R.id.flipper);

        tvMissionTitle =
                findViewById(R.id.tvMissionTitle);

        tvPriorityPill =
                findViewById(R.id.tvPriorityPill);

        tvAssignedBy =
                findViewById(R.id.tvAssignedBy);

        mapView =
                findViewById(R.id.mapView);

        tvStartedAt =
                findViewById(R.id.tvStartedAt);

        tvPhotoProgress =
                findViewById(R.id.tvPhotoProgress);

        tvStatusPill =
                findViewById(R.id.tvStatusPill);

        groupOfflineNotice =
                findViewById(R.id.groupOfflineNotice);

        photoSlot1 =
                findViewById(R.id.photoSlot1);

        photoSlot2 =
                findViewById(R.id.photoSlot2);

        photoSlot3 =
                findViewById(R.id.photoSlot3);

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
                .setOnClickListener(v -> startMission());

        findViewById(R.id.btnNavigate)
                .setOnClickListener(v -> openNavigation());

        findViewById(R.id.btnMapNavigate)
                .setOnClickListener(v -> openNavigation());

        findViewById(R.id.btnTakePhoto)
                .setOnClickListener(v -> takePhoto());

        findViewById(R.id.btnCompleteMission)
                .setOnClickListener(v -> completeMission());

        View panicButton =
                findViewById(R.id.btnPanicCircle);

        if (panicButton != null) {
            panicButton.setOnClickListener(
                    v -> {
                        PrefsManager prefs = new PrefsManager(this);
                        if (!prefs.isShiftActive()) {
                            Toast.makeText(this, "Please start a shift before pressing the panic button.", Toast.LENGTH_LONG).show();
                            return;
                        }
                        PanicAlertDialogFragment
                                .newInstance()
                                .show(
                                        getSupportFragmentManager(),
                                        "panic"
                                );
                    }
            );
        }

        // FULL-RESOLUTION CAMERA
        cameraLauncher =
                registerForActivityResult(
                        new ActivityResultContracts.TakePicture(),
                        success -> {

                            if (success &&
                                    currentPhotoFile != null &&
                                    currentPhotoFile.exists()) {

                                uploadCapturedPhoto();

                            } else {

                                currentPhotoFile = null;
                                currentPhotoUri = null;

                                Toast.makeText(
                                        this,
                                        "Photo cancelled",
                                        Toast.LENGTH_SHORT
                                ).show();
                            }
                        }
                );

        cameraPermissionLauncher =
                registerForActivityResult(
                        new ActivityResultContracts.RequestPermission(),
                        granted -> {

                            if (granted) {
                                launchFullResolutionCamera();
                            } else {
                                Toast.makeText(
                                        this,
                                        "Camera required",
                                        Toast.LENGTH_SHORT
                                ).show();
                            }
                        }
                );

        networkMonitor =
                new NetworkMonitor(
                        this,
                        new NetworkMonitor.Listener() {

                            @Override
                            public void onNetworkAvailable() {

                                handler.post(() -> {

                                    setOnlineStatus();

                                    if (groupOfflineNotice != null) {
                                        groupOfflineNotice.setVisibility(
                                                View.GONE
                                        );
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
                                        groupOfflineNotice.setVisibility(
                                                View.VISIBLE
                                        );
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

        mapView.setTileSource(
                TileSourceFactory.MAPNIK
        );

        mapView.setMultiTouchControls(true);
        mapView.setBuiltInZoomControls(false);
    }

    private void checkLocationPermissions() {

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED) {

            locationPermissionLauncher.launch(
                    new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    }
            );

        } else {
            startLocationTrackingIfNecessary();
        }
    }

    private void startLocationTrackingIfNecessary() {

        if (mission != null &&
                mission.getStatus() ==
                        MissionStatus.IN_PROGRESS) {

            locationTracker.startTracking(missionId);
        }
    }

    private void updateMapLocation() {

        if (mission == null ||
                mission.getLatitude() == null ||
                mission.getLongitude() == null) {

            return;
        }

        GeoPoint point =
                new GeoPoint(
                        mission.getLatitude(),
                        mission.getLongitude()
                );

        IMapController controller =
                mapView.getController();

        controller.setZoom(17.5);
        controller.setCenter(point);

        Marker marker =
                new Marker(mapView);

        marker.setPosition(point);

        marker.setAnchor(
                Marker.ANCHOR_CENTER,
                Marker.ANCHOR_BOTTOM
        );

        marker.setTitle(mission.getTitle());

        mapView.getOverlays().clear();
        mapView.getOverlays().add(marker);
        mapView.invalidate();
    }

    private void setUpStepRow(
            View row,
            String number,
            int label
    ) {

        if (row == null) {
            return;
        }

        ((TextView) row.findViewById(
                R.id.tvStepNumber
        )).setText(number);

        ((TextView) row.findViewById(
                R.id.tvStepLabel
        )).setText(label);
    }

    private void loadMission() {

        missionRepository.getMissionById(
                missionId,
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(Mission result) {

                        mission = result;

                        if (mission != null) {
                            render();
                        }
                    }

                    @Override
                    public void onError(Throwable error) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : "Error",
                                Toast.LENGTH_SHORT
                        ).show();

                        finish();
                    }
                }
        );
    }

    private void setOnlineStatus() {

        if (tvStatusPill != null) {

            tvStatusPill.setText(
                    R.string.status_online
            );

            tvStatusPill.setBackgroundResource(
                    R.drawable.pill_active
            );
        }
    }

    private void setOfflineStatus() {

        if (tvStatusPill != null) {

            tvStatusPill.setText(
                    R.string.status_no_signal
            );

            tvStatusPill.setBackgroundResource(
                    R.drawable.pill_offline
            );
        }
    }

    private void updateStepRowStatus(
            View row,
            boolean done,
            boolean current
    ) {

        if (row == null) {
            return;
        }

        View number =
                row.findViewById(R.id.tvStepNumber);

        View label =
                row.findViewById(R.id.tvStepLabel);

        if (done) {

            number.setBackgroundResource(
                    R.drawable.circle_step_done
            );

            if (number instanceof TextView) {
                ((TextView) number).setText("");
            }

            label.setAlpha(0.5f);

        } else if (current) {

            number.setBackgroundResource(
                    R.drawable.circle_step_current
            );

            label.setAlpha(1.0f);

        } else {

            number.setBackgroundResource(
                    R.drawable.circle_step_pending
            );

            label.setAlpha(0.5f);
        }
    }

    private void render() {

        tvMissionTitle.setText(
                mission.getTitle()
        );

        tvAssignedBy.setText(
                getString(
                        R.string.mission_assigned_by,
                        mission.getLocationDisplay(),
                        "Dispatch"
                )
        );

        updateMapLocation();

        int priorityResource;
        String priorityLabel;

        switch (mission.getPriority()) {

            case URGENT:
            case HIGH:

                priorityResource =
                        R.drawable.pill_urgent;

                priorityLabel =
                        getString(R.string.priority_urgent);

                break;

            case MEDIUM:

                priorityResource =
                        R.drawable.pill_pending;

                priorityLabel =
                        getString(R.string.priority_medium);

                break;

            default:

                priorityResource =
                        R.drawable.pill_active;

                priorityLabel =
                        getString(R.string.priority_low);

                break;
        }

        tvPriorityPill.setBackgroundResource(
                priorityResource
        );

        tvPriorityPill.setText(
                priorityLabel
        );

        boolean inProgress =
                mission.getStatus() ==
                        MissionStatus.IN_PROGRESS ||
                        mission.getStatus() ==
                                MissionStatus.COMPLETED;

        flipper.setDisplayedChild(
                inProgress
                        ? PAGE_IN_PROGRESS
                        : PAGE_ASSIGNED
        );

        if (!inProgress) {

            TextView button =
                    findViewById(R.id.btnAcknowledge);

            button.setText(
                    R.string.mission_step_start
            );

            updateStepRowStatus(
                    findViewById(R.id.step1),
                    true,
                    false
            );

            updateStepRowStatus(
                    findViewById(R.id.step2),
                    false,
                    true
            );

            updateStepRowStatus(
                    findViewById(R.id.step3),
                    false,
                    false
            );

        } else {

            // Only show the mission start time.
            // "Acknowledged" has been removed from the UI.
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

    private String formatTime(String value) {

        if (value == null) {
            return "--:--";
        }

        try {

            SimpleDateFormat format =
                    new SimpleDateFormat(
                            "yyyy-MM-dd'T'HH:mm:ss",
                            Locale.US
                    );

            format.setTimeZone(
                    TimeZone.getTimeZone("UTC")
            );

            return DateFormat.format(
                    "HH:mm",
                    format.parse(value)
            ).toString();

        } catch (Exception e) {
            return "--:--";
        }
    }

    private void renderPhotos() {

        int totalPhotos =
                mission.getPhotos() != null
                        ? mission.getPhotos().size()
                        : 0;

        tvPhotoProgress.setText(
                totalPhotos + " photo" +
                        (totalPhotos == 1 ? "" : "s") +
                        " added"
        );

        FrameLayout[] slots = {
                photoSlot1,
                photoSlot2,
                photoSlot3
        };

        for (FrameLayout slot : slots) {

            if (slot == null) {
                continue;
            }

            slot.removeAllViews();
            slot.setBackgroundResource(
                    R.drawable.bg_photo_slot
            );
        }

        if (mission.getPhotos() == null ||
                mission.getPhotos().isEmpty()) {

            return;
        }

        int photosToShow =
                Math.min(
                        mission.getPhotos().size(),
                        slots.length
                );

        for (int i = 0; i < photosToShow; i++) {

            MissionPhoto photo =
                    mission.getPhotos().get(i);

            if (photo == null ||
                    photo.getImage() == null ||
                    photo.getImage().trim().isEmpty()) {

                continue;
            }

            FrameLayout slot = slots[i];

            ImageView imageView =
                    new ImageView(this);

            imageView.setScaleType(
                    ImageView.ScaleType.CENTER_CROP
            );

            FrameLayout.LayoutParams params =
                    new FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.MATCH_PARENT,
                            FrameLayout.LayoutParams.MATCH_PARENT
                    );

            slot.addView(
                    imageView,
                    params
            );

            String imageUrl =
                    photo.getImage().trim();

            if (imageUrl.startsWith("/")) {

                imageUrl =
                        "http://10.0.2.2:8000" +
                                imageUrl;

            } else if (!imageUrl.startsWith("http://") &&
                    !imageUrl.startsWith("https://")) {

                imageUrl =
                        "http://10.0.2.2:8000/" +
                                imageUrl;
            }

            Glide.with(this)
                    .load(imageUrl)
                    .centerCrop()
                    .into(imageView);
        }
    }

    private void startMission() {

        missionRepository.startMission(
                missionId,
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(Mission result) {

                        mission = result;

                        render();

                        startLocationTrackingIfNecessary();
                    }

                    @Override
                    public void onError(Throwable error) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : "Failed to start mission",
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
                            : mission.getLatitude() +
                              "," +
                            mission.getLongitude();

            Intent intent =
                    new Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse(
                                    "geo:0,0?q=" +
                                            Uri.encode(query)
                            )
                    );

            startActivity(intent);

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    mission.getTitle(),
                    Toast.LENGTH_SHORT
            ).show();
        }
    }

    private void takePhoto() {

        if (mission == null) {
            return;
        }

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED) {

            launchFullResolutionCamera();

        } else {

            cameraPermissionLauncher.launch(
                    Manifest.permission.CAMERA
            );
        }
    }

    private void launchFullResolutionCamera() {

        try {

            currentPhotoFile =
                    new File(
                            getCacheDir(),
                            "mission_" +
                                    missionId +
                                    "_" +
                                    System.currentTimeMillis() +
                                    ".jpg"
                    );

            currentPhotoUri =
                    FileProvider.getUriForFile(
                            this,
                            getPackageName() +
                                    ".fileprovider",
                            currentPhotoFile
                    );

            cameraLauncher.launch(
                    currentPhotoUri
            );

        } catch (Exception e) {

            currentPhotoFile = null;
            currentPhotoUri = null;

            Toast.makeText(
                    this,
                    e.getMessage() != null
                            ? e.getMessage()
                            : "Unable to open camera",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    private void uploadCapturedPhoto() {

        if (currentPhotoFile == null ||
                !currentPhotoFile.exists()) {

            Toast.makeText(
                    this,
                    "Photo file not found",
                    Toast.LENGTH_SHORT
            ).show();

            return;
        }

        final File photoToUpload =
                currentPhotoFile;

        missionRepository.addMissionPhoto(
                missionId,
                photoToUpload.getAbsolutePath(),
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(Mission result) {

                        mission = result;

                        currentPhotoFile = null;
                        currentPhotoUri = null;

                        render();

                        Toast.makeText(
                                MissionDetailActivity.this,
                                "Photo added",
                                Toast.LENGTH_SHORT
                        ).show();
                    }

                    @Override
                    public void onError(Throwable error) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : "Photo upload failed",
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }
        );
    }

    private void completeMission() {

        if (!mission.hasMinimumPhotos()) {

            Toast.makeText(
                    this,
                    "Please add the required photo first",
                    Toast.LENGTH_SHORT
            ).show();

            return;
        }

        missionRepository.completeMission(
                missionId,
                new Callback<Mission>() {

                    @Override
                    public void onSuccess(Mission result) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                R.string.mission_completed_toast,
                                Toast.LENGTH_SHORT
                        ).show();

                        finish();
                    }

                    @Override
                    public void onError(Throwable error) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : "Failed to complete mission",
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
                    public void onSuccess(Void result) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                R.string.cancel_mission_toast,
                                Toast.LENGTH_SHORT
                        ).show();

                        finish();
                    }

                    @Override
                    public void onError(Throwable error) {

                        Toast.makeText(
                                MissionDetailActivity.this,
                                error.getMessage() != null
                                        ? error.getMessage()
                                        : "Cancel failed",
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                }
        );
    }

    @Override
    public void onPanicSent() {
        Toast.makeText(
                this,
                "PANIC ACTIVE - DISPATCH NOTIFIED",
                Toast.LENGTH_LONG
        ).show();

        View panicButton = findViewById(R.id.btnPanicCircle);
        if (panicButton instanceof android.widget.ImageView) {
            ((android.widget.ImageView) panicButton).setColorFilter(
                    ContextCompat.getColor(this, R.color.urgent_alert)
            );
        }
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

        if (mapView != null) {
            mapView.onResume();
        }
    }

    @Override
    protected void onPause() {

        super.onPause();

        if (mapView != null) {
            mapView.onPause();
        }
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

        if (item.getItemId() ==
                R.id.menu_cancel_mission) {

            CancelMissionDialogFragment
                    .newInstance()
                    .show(
                            getSupportFragmentManager(),
                            "cancel_mission"
                    );

            return true;
        }

        return super.onOptionsItemSelected(item);
    }
}
