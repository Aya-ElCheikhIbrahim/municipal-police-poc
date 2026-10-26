package com.municipalpolice.officerapp.ui.panic;

import android.widget.TextView;

import com.municipalpolice.officerapp.R;

import org.osmdroid.views.MapView;
import org.osmdroid.views.overlay.infowindow.InfoWindow;

/**
 * The small red bubble above the pin that names the officer in panic. It takes
 * the place of the old red banner: the name now travels with the marker on the
 * map. Kept open the whole time the screen is up (re-shown on every location
 * update and on a tap), rather than toggling the way a default marker bubble
 * would.
 */
public class PanicNameInfoWindow extends InfoWindow {

    public PanicNameInfoWindow(MapView mapView) {
        super(R.layout.marker_panic_name, mapView);
    }

    /** The officer's name, shown in the bubble. */
    public void setName(String name) {
        TextView label = mView.findViewById(R.id.tvMarkerName);
        if (label != null) {
            label.setText(name);
        }
    }

    @Override
    public void onOpen(Object item) {
        // Nothing to wire up: the bubble only shows a name, with no close button.
    }

    @Override
    public void onClose() {
        // No-op.
    }
}
