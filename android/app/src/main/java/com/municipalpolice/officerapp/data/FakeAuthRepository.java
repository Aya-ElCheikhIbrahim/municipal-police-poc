package com.municipalpolice.officerapp.data;

import android.os.Handler;
import android.os.Looper;

import com.municipalpolice.officerapp.model.Officer;

/** In-memory stand-in for a real auth backend. Accepts any non-empty credentials. */
public class FakeAuthRepository implements AuthRepository {

    private static FakeAuthRepository instance;
    private Officer cachedOfficer;
    private final Handler handler = new Handler(Looper.getMainLooper());

    public static synchronized FakeAuthRepository getInstance() {
        if (instance == null) instance = new FakeAuthRepository();
        return instance;
    }

    private FakeAuthRepository() { }

    @Override
    public void login(String username, String password, Callback<Officer> callback) {
        handler.postDelayed(() -> {
            if (username == null || username.trim().isEmpty() || password == null || password.isEmpty()) {
                callback.onError(new IllegalArgumentException("missing credentials"));
                return;
            }
            cachedOfficer = new Officer("off-1001", "Karim Haddad", "TR-2281");
            callback.onSuccess(cachedOfficer);
        }, 500);
    }

    @Override
    public void logout() {
        cachedOfficer = null;
    }

    @Override
    public Officer getCachedOfficer() {
        return cachedOfficer;
    }
}
