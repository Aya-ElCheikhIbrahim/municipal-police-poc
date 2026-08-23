package com.municipalpolice.officerapp.data;

/**
 * Minimal async callback so every repository method below already has the
 * right shape for a future Retrofit/Room/Firebase-backed implementation
 * without changing any call sites in the UI layer.
 */
public interface Callback<T> {
    void onSuccess(T result);
    void onError(Throwable error);
}
