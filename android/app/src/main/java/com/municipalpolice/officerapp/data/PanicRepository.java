package com.municipalpolice.officerapp.data;

public interface PanicRepository {
    void triggerPanic(Double lat, Double lon, Callback<PanicEventResponse> callback);
    void triggerPanic(Double lat, Double lon, Float accuracy, Integer battery, Callback<PanicEventResponse> callback);
    void cancelPanic(int panicId, Callback<PanicEventResponse> callback);
}
