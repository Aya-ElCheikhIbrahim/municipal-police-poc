package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.model.Shift;

public interface ShiftRepository {
    void startShift(Double latitude, Double longitude, Callback<Shift> callback);
    void endShift(Double latitude, Double longitude, String refresh, Callback<Shift> callback);
}
