package com.municipalpolice.officerapp.data;

public interface PanicRepository {
    void triggerPanic(Double lat, Double lon, Callback<Object> callback);
}
