package com.municipalpolice.officerapp.ui.panic;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.core.text.BidiFormatter;
import androidx.core.text.TextDirectionHeuristicsCompat;

import com.municipalpolice.officerapp.R;
import com.municipalpolice.officerapp.data.Callback;
import com.municipalpolice.officerapp.data.PanicEndedException;
import com.municipalpolice.officerapp.data.PanicLocationResponse;
import com.municipalpolice.officerapp.data.PanicRepository;
import com.municipalpolice.officerapp.data.RetrofitPanicRepository;
import com.municipalpolice.officerapp.notifications.ActivePanic;
import com.municipalpolice.officerapp.notifications.PanicAlert;
import com.municipalpolice.officerapp.ui.common.BaseActivity;
import com.municipalpolice.officerapp.util.PrefsManager;

import org.osmdroid.config.Configuration;
import org.osmdroid.tileprovider.tilesource.TileSourceFactory;
import org.osmdroid.util.GeoPoint;
import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.Marker;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class PanicDetailActivity extends BaseActivity {

    private static final String TAG = "PanicDetail";

    public static final String EXTRA_PANIC_ID = "extra_panic_id";
    public static final String EXTRA_USER_NAME = "extra_user_name";
    public static final String EXTRA_USER_PHONE = "extra_user_phone";
    public static final String EXTRA_LAT = "extra_lat";
    public static final String EXTRA_LON = "extra_lon";

    private MapView mapView;
    private TextView tvUserName;
    private TextView tvUserPhone;
    private TextView tvLastUpdated;
    private TextView tvLocationStatus;
    private ImageButton btnBack;
    private Button btnCallOfficer;

    private PanicRepository panicRepository;

    private int panicId = -1;
    private String userName = "Unknown Officer";
    // Null when there is no dialable number; never a placeholder like "N/A".
    private String userPhone;
    private double currentLat = 0.0;
    private double currentLon = 0.0;

    private Marker panicMarker;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable locationPollRunnable = this::pollLocation;
    private static final long POLL_INTERVAL_MS = 10000; // Poll every 10 seconds

    // Bumped whenever polling stops, so a response that lands after onPause
    // (or after the alert ended) is dropped instead of touching the screen or
    // scheduling another poll.
    private int pollGeneration = 0;
    private boolean polling = false;
    private boolean alertEnded = false;
    private boolean confirmedByBackend = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Configuration.getInstance().setUserAgentValue(getApplicationContext().getPackageName());
        setContentView(R.layout.activity_panic_detail);

        panicRepository = new RetrofitPanicRepository(getApplicationContext());

        // Read intent extras
        if (getIntent() != null) {
            panicId = getIntent().getIntExtra(EXTRA_PANIC_ID, -1);
            if (getIntent().getStringExtra(EXTRA_USER_NAME) != null) {
                userName = getIntent().getStringExtra(EXTRA_USER_NAME);
            }
            userPhone = dialableOrNull(getIntent().getStringExtra(EXTRA_USER_PHONE));
            // No made-up default position: 0,0 means "none yet" to
            // updateMapLocation, and the first poll supplies the real one.
            currentLat = getIntent().getDoubleExtra(EXTRA_LAT, 0.0);
            currentLon = getIntent().getDoubleExtra(EXTRA_LON, 0.0);
        }

        tvUserName = findViewById(R.id.tvUserName);
        tvUserPhone = findViewById(R.id.tvUserPhone);
        tvLastUpdated = findViewById(R.id.tvLastUpdated);
        tvLocationStatus = findViewById(R.id.tvLocationStatus);
        btnBack = findViewById(R.id.btnBack);
        btnCallOfficer = findViewById(R.id.btnCallOfficer);
        mapView = findViewById(R.id.mapView);

        tvUserName.setText(userName);
        renderPhone();

        btnBack.setOnClickListener(v -> finish());
        btnCallOfficer.setOnClickListener(v -> dialOfficer());

        // Until a poll answers, the only position is the one in the push, and
        // its age is unknown: say so rather than calling it live.
        tvLastUpdated.setText(R.string.panic_detail_location_from_alert);
        if (panicId <= 0) {
            Log.w(TAG, "Opened without a panic id; live tracking is unavailable");
            tvLastUpdated.setVisibility(View.GONE); // it would say "connecting"
            showStatus(R.string.panic_detail_tracking_unavailable);
        }

        setupMap();
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
            panicMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM);
            mapView.getOverlays().add(panicMarker);
        }
        panicMarker.setTitle(userName + " (IN PANIC)");

        panicMarker.setPosition(point);
        mapView.invalidate();
    }

    // =========================================================
    // LIVE LOCATION
    // =========================================================

    private void startLocationPolling() {
        // isFinishing: BaseActivity.onResume may have just sent us to login.
        if (polling || alertEnded || panicId <= 0 || isFinishing()) return;
        polling = true;
        pollLocation(); // now, not after a full interval: the screen just became visible
    }

    private void stopLocationPolling() {
        polling = false;
        pollGeneration++;
        handler.removeCallbacks(locationPollRunnable);
    }

    /**
     * One request at a time: the next poll is scheduled only once this one has
     * answered, so a slow network cannot stack requests up behind each other.
     */
    private void pollLocation() {
        final int generation = pollGeneration;
        panicRepository.getPanicLocation(panicId, new Callback<PanicLocationResponse>() {
            @Override
            public void onSuccess(PanicLocationResponse result) {
                if (isStale(generation)) return;
                applyLocation(result);
                handler.postDelayed(locationPollRunnable, POLL_INTERVAL_MS);
            }

            @Override
            public void onError(Throwable error) {
                if (isStale(generation)) return;
                if (error instanceof PanicEndedException) {
                    onAlertEnded();
                    return;
                }
                // A dead zone is temporary, so keep trying. The timestamp is
                // left exactly as it was; the warning says it is getting old.
                showStatus(R.string.panic_detail_connection_lost);
                handler.postDelayed(locationPollRunnable, POLL_INTERVAL_MS);
            }
        });
    }

    private boolean isStale(int generation) {
        return generation != pollGeneration || isFinishing() || isDestroyed();
    }

    private void applyLocation(PanicLocationResponse result) {
        double lat;
        double lon;
        try {
            lat = Double.parseDouble(result.getLatitude());
            lon = Double.parseDouble(result.getLongitude());
        } catch (NullPointerException | NumberFormatException e) {
            // Not a usable answer, so it must not refresh the timestamp either.
            Log.w(TAG, "Unparseable position in location response", e);
            showStatus(R.string.panic_detail_connection_lost);
            return;
        }

        // The poll is the authoritative source for who and how to reach them;
        // the push extras were only there to fill the screen on open.
        PanicLocationResponse.Officer officer = result.getOfficer();
        if (officer != null) {
            if (officer.getFullName() != null && !officer.getFullName().trim().isEmpty()) {
                userName = officer.getFullName();
                tvUserName.setText(userName);
            }
            userPhone = dialableOrNull(officer.getPhone());
            renderPhone();
        }

        updateMapLocation(lat, lon);
        tvLocationStatus.setVisibility(View.GONE);

        // The backend has now confirmed this alert is real and active, so it
        // is safe to hold it and keep its ongoing notification. Done here and
        // not from the launch intent, whose extras any app could have sent.
        if (!confirmedByBackend) {
            confirmedByBackend = true;
            ActivePanic.remember(this, new PanicAlert(panicId, userName, userPhone, lat, lon), false);
        }

        // recorded_at, not "now": when the colleague's phone stops reporting,
        // the server keeps answering with the same old ping, and the label
        // must show that age rather than tick forward.
        tvLastUpdated.setText(getString(
                R.string.panic_detail_location_as_of, formatClockTime(result.getRecordedAt())));
    }

    private void onAlertEnded() {
        alertEnded = true;
        stopLocationPolling();
        // Its ongoing notification would otherwise keep pointing here.
        ActivePanic.forget(this, panicId);

        new AlertDialog.Builder(this)
                .setTitle(R.string.panic_detail_ended_title)
                .setMessage(R.string.panic_detail_ended_message)
                .setCancelable(false)
                .setPositiveButton(R.string.generic_ok, (dialog, which) -> finish())
                .show();
    }

    private void showStatus(int messageRes) {
        tvLocationStatus.setText(messageRes);
        tvLocationStatus.setVisibility(View.VISIBLE);
    }

    /**
     * recorded_at is ISO 8601 with an offset ("2026-10-25T14:02:11.123456+03:00"),
     * with the fraction left out when it is zero. java.time needs API 26 and
     * minSdk is 24, so drop the fraction and parse with SimpleDateFormat.
     */
    private static String formatClockTime(String iso) {
        if (iso != null) {
            try {
                String noFraction = iso.replaceFirst("\\.\\d+", "");
                Date parsed = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(noFraction);
                if (parsed != null) {
                    return new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(parsed);
                }
            } catch (Exception e) {
                Log.w(TAG, "Unparseable recorded_at: " + iso, e);
            }
        }
        // Never substitute the current time: that is the lie this label exists to avoid.
        return "--:--:--";
    }

    // =========================================================
    // PHONE
    // =========================================================

    /**
     * A number only counts if there is something to dial. Covers the backend's
     * "" for an officer with no phone, a missing extra, and the "N/A" the push
     * handler substitutes when the key is absent.
     */
    private static String dialableOrNull(String phone) {
        if (phone == null) return null;
        String trimmed = phone.trim();
        for (int i = 0; i < trimmed.length(); i++) {
            if (Character.isDigit(trimmed.charAt(i))) return trimmed;
        }
        return null;
    }

    private void renderPhone() {
        if (userPhone == null) {
            tvUserPhone.setText(R.string.panic_detail_no_phone);
            btnCallOfficer.setVisibility(View.GONE);
        } else {
            // Forced LTR so "+961 3 ..." does not get reordered inside Arabic text.
            String wrapped = BidiFormatter.getInstance()
                    .unicodeWrap(userPhone, TextDirectionHeuristicsCompat.LTR);
            tvUserPhone.setText(getString(R.string.panic_detail_phone, wrapped));
            btnCallOfficer.setVisibility(View.VISIBLE);
        }
    }

    /**
     * ACTION_DIAL, not ACTION_CALL: it only fills the number in, so a mis-tap
     * during an emergency cannot place a call on its own, and it needs no
     * CALL_PHONE permission.
     */
    private void dialOfficer() {
        if (userPhone == null) return;
        Intent dial = new Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", userPhone, null));
        try {
            startActivity(dial);
        } catch (ActivityNotFoundException e) {
            // Tablets and some emulators have no dialer.
            Log.w(TAG, "No activity handles ACTION_DIAL", e);
            Toast.makeText(this, R.string.panic_detail_no_dialer, Toast.LENGTH_LONG).show();
        }
    }

    // =========================================================
    // LIFECYCLE
    // =========================================================

    /** Login is handled in onResume instead, so the alert survives it. */
    @Override
    protected boolean requiresLogin() {
        return false;
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (mapView != null) mapView.onResume();

        // Reached from the ongoing notification after the session died.
        // BaseActivity's redirect would drop the alert; this one carries it
        // through login, and LoginActivity reopens this screen afterwards.
        if (!new PrefsManager(this).isLoggedIn()) {
            startActivity(new PanicAlert(panicId, userName, userPhone, currentLat, currentLon)
                    .loginIntent(this));
            finish();
            return;
        }

        startLocationPolling();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Not visible, so nobody is reading it: stop hitting the endpoint.
        stopLocationPolling();
        if (mapView != null) mapView.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopLocationPolling();
        if (mapView != null) mapView.onDetach();
    }
}
