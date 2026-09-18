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
import com.municipalpolice.officerapp.ui.dialogs.PanicAlertDialogFragment;
import com.municipalpolice.officerapp.util.PrefsManager;

import java.io.File;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;

import org.osmdroid.api.IMapController;
import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

public class MissionDetailActivity extends BaseActivity implements PanicAlertDialogFragment.PanicListener {

    public static final String EXTRA_MISSION_ID = "extra_mission_id";
    private static final int PAGE_ASSIGNED = 0;
    private static final int PAGE_IN_PROGRESS = 1;

    private ViewFlipper flipper;
    private TextView tvMissionTitle, tvPriorityPill, tvAssignedBy, tvAcknowledgedAt, tvStartedAt, tvPhotoProgress, tvStatusPill;
    private MapView mapView;
    private View groupOfflineNotice;
    private FrameLayout photoSlot1, photoSlot2, photoSlot3;

    private String missionId;
    private Mission mission;
    private MissionRepository missionRepository;
    private LocationTracker locationTracker;

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
                boolean granted = result.getOrDefault(Manifest.permission.ACCESS_FINE_LOCATION, false) || result.getOrDefault(Manifest.permission.ACCESS_COARSE_LOCATION, false);
                if (granted) startLocationTrackingIfNecessary();
                else Toast.makeText(this, R.string.mission_location_permission_denied, Toast.LENGTH_LONG).show();
            });

    private NetworkMonitor networkMonitor;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ActivityResultLauncher<Void> cameraLauncher;
    private ActivityResultLauncher<String> cameraPermissionLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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

        findViewById(R.id.btnAcknowledge).setOnClickListener(v -> startMission());
        findViewById(R.id.btnNavigate).setOnClickListener(v -> openNavigation());
        findViewById(R.id.btnMapNavigate).setOnClickListener(v -> openNavigation());
        findViewById(R.id.btnTakePhoto).setOnClickListener(v -> takePhoto());
        findViewById(R.id.btnCompleteMission).setOnClickListener(v -> completeMission());

        View bp = findViewById(R.id.btnPanicCircle);
        if (bp != null) bp.setOnClickListener(v -> PanicAlertDialogFragment.newInstance().show(getSupportFragmentManager(), "panic"));

        cameraLauncher = registerForActivityResult(new ActivityResultContracts.TakePicturePreview(), bitmap -> { if (bitmap != null) saveAndUploadPhoto(bitmap); });
        cameraPermissionLauncher = registerForActivityResult(new ActivityResultContracts.RequestPermission(), g -> { if (g) cameraLauncher.launch(null); else Toast.makeText(this, "Camera required", Toast.LENGTH_SHORT).show(); });

        networkMonitor = new NetworkMonitor(this, new NetworkMonitor.Listener() {
            @Override public void onNetworkAvailable() { handler.post(() -> { setOnlineStatus(); if (groupOfflineNotice != null) groupOfflineNotice.setVisibility(View.GONE); if (mission == null) loadMission(); }); }
            @Override public void onNetworkLost() { handler.post(() -> { setOfflineStatus(); if (groupOfflineNotice != null) groupOfflineNotice.setVisibility(View.VISIBLE); }); }
        });

        initMap(); checkLocationPermissions(); loadMission();
    }

    private void initMap() { mapView.setTileSource(TileSourceFactory.MAPNIK); mapView.setMultiTouchControls(true); mapView.setBuiltInZoomControls(false); }
    private void checkLocationPermissions() { if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) locationPermissionLauncher.launch(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}); else startLocationTrackingIfNecessary(); }
    private void startLocationTrackingIfNecessary() { if (mission != null && mission.getStatus() == MissionStatus.IN_PROGRESS) locationTracker.startTracking(missionId); }
    private void updateMapLocation() {
        if (mission == null || mission.getLatitude() == null || mission.getLongitude() == null) return;
        GeoPoint p = new GeoPoint(mission.getLatitude(), mission.getLongitude());
        IMapController c = mapView.getController(); c.setZoom(17.5); c.setCenter(p);
        Marker m = new Marker(mapView); m.setPosition(p); m.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM); m.setTitle(mission.getTitle());
        mapView.getOverlays().clear(); mapView.getOverlays().add(m); mapView.invalidate();
    }
    private void setUpStepRow(View r, String n, int l) { if (r != null) { ((TextView)r.findViewById(R.id.tvStepNumber)).setText(n); ((TextView)r.findViewById(R.id.tvStepLabel)).setText(l); } }
    private void loadMission() {
        missionRepository.getMissionById(missionId, new Callback<Mission>() {
            @Override public void onSuccess(Mission r) { mission = r; if (mission != null) render(); }
            @Override public void onError(Throwable e) { Toast.makeText(MissionDetailActivity.this, e.getMessage() != null ? e.getMessage() : "Error", Toast.LENGTH_SHORT).show(); finish(); }
        });
    }
    private void setOnlineStatus() { if (tvStatusPill != null) { tvStatusPill.setText(R.string.status_online); tvStatusPill.setBackgroundResource(R.drawable.pill_active); } }
    private void setOfflineStatus() { if (tvStatusPill != null) { tvStatusPill.setText(R.string.status_no_signal); tvStatusPill.setBackgroundResource(R.drawable.pill_offline); } }
    private void updateStepRowStatus(View r, boolean done, boolean curr) {
        if (r == null) return; View vN = r.findViewById(R.id.tvStepNumber); View vL = r.findViewById(R.id.tvStepLabel);
        if (done) { vN.setBackgroundResource(R.drawable.circle_step_done); if (vN instanceof TextView) ((TextView) vN).setText(""); vL.setAlpha(0.5f); }
        else if (curr) { vN.setBackgroundResource(R.drawable.circle_step_current); vL.setAlpha(1.0f); }
        else { vN.setBackgroundResource(R.drawable.circle_step_pending); vL.setAlpha(0.5f); }
    }
    private void render() {
        tvMissionTitle.setText(mission.getTitle()); tvAssignedBy.setText(getString(R.string.mission_assigned_by, mission.getLocationDisplay(), "Dispatch")); updateMapLocation();
        int pr; String l;
        switch (mission.getPriority()) { case URGENT: case HIGH: pr = R.drawable.pill_urgent; l = getString(R.string.priority_urgent); break; case MEDIUM: pr = R.drawable.pill_pending; l = getString(R.string.priority_medium); break; default: pr = R.drawable.pill_active; l = getString(R.string.priority_low); }
        tvPriorityPill.setBackgroundResource(pr); tvPriorityPill.setText(l);
        boolean inProgress = mission.getStatus() == MissionStatus.IN_PROGRESS || mission.getStatus() == MissionStatus.COMPLETED;
        flipper.setDisplayedChild(inProgress ? PAGE_IN_PROGRESS : PAGE_ASSIGNED);
        if (!inProgress) { TextView b = findViewById(R.id.btnAcknowledge); b.setText(R.string.mission_step_start); updateStepRowStatus(findViewById(R.id.step1), true, false); updateStepRowStatus(findViewById(R.id.step2), false, true); updateStepRowStatus(findViewById(R.id.step3), false, false); }
        else { tvAcknowledgedAt.setText(getString(R.string.mission_acknowledged_at, fmtT(mission.getAcknowledgedAt()))); tvStartedAt.setText(getString(R.string.mission_started_at, fmtT(mission.getStartedAt()))); renderPhotos(); }
    }
    private String fmtT(String s) { if (s == null) return "--:--"; try { SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US); f.setTimeZone(TimeZone.getTimeZone("UTC")); return DateFormat.format("HH:mm", f.parse(s)).toString(); } catch (Exception e) { return "--:--"; } }
    private void renderPhotos() {
        int t = mission.getPhotos().size(); tvPhotoProgress.setText(getString(R.string.mission_photo_progress, t, mission.getRequiredPhotoCount()));
        FrameLayout[] s = {photoSlot1, photoSlot2, photoSlot3}; for (int i = 0; i < s.length; i++) if (s[i] != null) s[i].setBackgroundResource(i < t ? R.drawable.bg_map_preview : R.drawable.bg_photo_slot);
    }
    private void startMission() { missionRepository.startMission(missionId, new Callback<Mission>() { @Override public void onSuccess(Mission r) { mission = r; render(); startLocationTrackingIfNecessary(); } @Override public void onError(Throwable e) { Toast.makeText(MissionDetailActivity.this, e.getMessage(), Toast.LENGTH_SHORT).show(); } }); }
    private void openNavigation() { try { String q = mission.getAddress() != null ? mission.getAddress() : mission.getLatitude() + "," + mission.getLongitude(); startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(q)))); } catch (Exception e) { Toast.makeText(this, mission.getTitle(), Toast.LENGTH_SHORT).show(); } }
    private void takePhoto() { if (mission == null || mission.getPhotos().size() >= mission.getRequiredPhotoCount()) return; if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) cameraLauncher.launch(null); else cameraPermissionLauncher.launch(Manifest.permission.CAMERA); }
    private void saveAndUploadPhoto(Bitmap b) {
        try {
            File f = new File(getCacheDir(), "m_" + missionId + "_" + System.currentTimeMillis() + ".jpg"); FileOutputStream o = new FileOutputStream(f); b.compress(Bitmap.CompressFormat.JPEG, 90, o); o.flush(); o.close();
            missionRepository.addMissionPhoto(missionId, f.getAbsolutePath(), new Callback<Mission>() { @Override public void onSuccess(Mission r) { mission = r; render(); Toast.makeText(MissionDetailActivity.this, "Uploaded", Toast.LENGTH_SHORT).show(); } @Override public void onError(Throwable e) { Toast.makeText(MissionDetailActivity.this, e.getMessage(), Toast.LENGTH_LONG).show(); } });
        } catch (Exception e) { Toast.makeText(this, e.getMessage(), Toast.LENGTH_LONG).show(); }
    }
    private void completeMission() { if (!mission.hasMinimumPhotos()) { Toast.makeText(this, R.string.mission_take_photo, Toast.LENGTH_SHORT).show(); return; } missionRepository.completeMission(missionId, new Callback<Mission>() { @Override public void onSuccess(Mission r) { Toast.makeText(MissionDetailActivity.this, R.string.mission_completed_toast, Toast.LENGTH_SHORT).show(); finish(); } @Override public void onError(Throwable e) { Toast.makeText(MissionDetailActivity.this, e.getMessage(), Toast.LENGTH_SHORT).show(); } }); }
    public void onMissionCancelConfirmed(String r) { missionRepository.cancelMission(missionId, r, new Callback<Void>() { @Override public void onSuccess(Void x) { Toast.makeText(MissionDetailActivity.this, R.string.cancel_mission_toast, Toast.LENGTH_SHORT).show(); finish(); } @Override public void onError(Throwable e) { Toast.makeText(MissionDetailActivity.this, e.getMessage(), Toast.LENGTH_SHORT).show(); } }); }
    @Override public void onPanicSent() { Toast.makeText(this, R.string.panic_toast_sent, Toast.LENGTH_SHORT).show(); }
    @Override protected void onStart() { super.onStart(); if (networkMonitor != null) networkMonitor.start(); }
    @Override protected void onStop() { if (networkMonitor != null) networkMonitor.stop(); super.onStop(); }
    @Override protected void onResume() { super.onResume(); if (mapView != null) mapView.onResume(); }
    @Override protected void onPause() { super.onPause(); if (mapView != null) mapView.onPause(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); if (networkMonitor != null) networkMonitor.stop(); locationTracker.stopTracking(); super.onDestroy(); }
    @Override public boolean onCreateOptionsMenu(Menu m) { getMenuInflater().inflate(R.menu.menu_mission_detail, m); return true; }
    @Override public boolean onOptionsItemSelected(@NonNull MenuItem i) { if (i.getItemId() == R.id.menu_cancel_mission) CancelMissionDialogFragment.newInstance().show(getSupportFragmentManager(), "cancel_mission"); return super.onOptionsItemSelected(i); }
}
