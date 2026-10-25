package com.municipalpolice.officerapp.data;

public interface PanicRepository {
    void triggerPanic(Double lat, Double lon, Callback<PanicEventResponse> callback);
    void triggerPanic(Double lat, Double lon, Float accuracy, Integer battery, Callback<PanicEventResponse> callback);
    void cancelPanic(int panicId, Callback<PanicEventResponse> callback);

    /**
     * Latest position of a colleague's active alert. Reports a 404 as
     * {@link PanicEndedException}; anything else is a plain error.
     */
    void getPanicLocation(int panicId, Callback<PanicLocationResponse> callback);
}
