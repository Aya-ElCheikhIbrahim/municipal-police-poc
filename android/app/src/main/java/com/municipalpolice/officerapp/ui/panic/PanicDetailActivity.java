package com.municipalpolice.officerapp.ui.panic;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.ImageButton;
import android.widget.TextView;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.ui.common.BaseActivity;

import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class PanicDetailActivity extends BaseActivity {

    public static final String EXTRA_PANIC_ID = "extra_panic_id";
    public static final String EXTRA_USER_NAME = "extra_user_name";
    public static final String EXTRA_USER_PHONE = "extra_user_phone";
    public static final String EXTRA_LAT = "extra_lat";
    public static final String EXTRA_LON = "extra_lon";

    private MapView mapView;
    private TextView tvUserName;
    private TextView tvUserPhone;
    private TextView tvLastUpdated;
    private ImageButton btnBack;

    private String userName = "Unknown Officer";
    private String userPhone = "N/A";
    private double currentLat = 0.0;
    private double currentLon = 0.0;

    private Marker panicMarker;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable locationPollRunnable;
    private static final long POLL_INTERVAL_MS = 10000; // Poll every 10 seconds

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Configuration.getInstance().setUserAgentValue(getApplicationContext().getPackageName());
        setContentView(R.layout.activity_panic_detail);

        // Read intent extras
        if (getIntent() != null) {
            if (getIntent().getStringExtra(EXTRA_USER_NAME) != null) {
                userName = getIntent().getStringExtra(EXTRA_USER_NAME);
            }
            if (getIntent().getStringExtra(EXTRA_USER_PHONE) != null) {
                userPhone = getIntent().getStringExtra(EXTRA_USER_PHONE);
            }
            currentLat = getIntent().getDoubleExtra(EXTRA_LAT, 31.9539); // Default to Amman if 0
            currentLon = getIntent().getDoubleExtra(EXTRA_LON, 35.9106);
        }

        tvUserName = findViewById(R.id.tvUserName);
        tvUserPhone = findViewById(R.id.tvUserPhone);
        tvLastUpdated = findViewById(R.id.tvLastUpdated);
        btnBack = findViewById(R.id.btnBack);
        mapView = findViewById(R.id.mapView);

        tvUserName.setText(userName);
        tvUserPhone.setText("Phone: " + userPhone);

        btnBack.setOnClickListener(v -> finish());

        setupMap();
        startLocationPolling();
    }

    private void setupMap() {
        mapView.setTileSource(TileSourceFactory.MAPNIK);
        mapView.setMultiTouchControls(true);
        mapView.getController().setZoom(16.0);

        updateMapLocation(currentLat, currentLon);
    }

    private void updateMapLocation(double lat, double lon) {
        if (lat == 0.0 && lon == 0.0) return;

        currentLat = lat;
        currentLon = lon;

        GeoPoint point = new GeoPoint(lat, lon);
        mapView.getController().setCenter(point);

        if (panicMarker == null) {
            panicMarker = new Marker(mapView);
            panicMarker.setTitle(userName + " (IN PANIC)");
            panicMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            mapView.getOverlays().add(panicMarker);
        }

        panicMarker.setPosition(point);
        mapView.invalidate();

        String timeStr = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        tvLastUpdated.setText("Live location updated at " + timeStr);
    }

    private void startLocationPolling() {
        locationPollRunnable = new Runnable() {
            @Override
            public void run() {
                // Periodically update timestamp / keep-alive while on the page
                updateMapLocation(currentLat, currentLon);
                handler.postDelayed(this, POLL_INTERVAL_MS);
            }
        };
        handler.postDelayed(locationPollRunnable, POLL_INTERVAL_MS);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapView != null) mapView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mapView != null) mapView.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (handler != null && locationPollRunnable != null) {
            handler.removeCallbacks(locationPollRunnable);
        }
        if (mapView != null) mapView.onDetach();
    }
}
