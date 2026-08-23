package com.municipalpolice.officerapp.data;

import com.municipalpolice.officerapp.model.Officer;

/**
 * Contract for authentication. Swap FakeAuthRepository for a real
 * implementation (e.g. Retrofit hitting POST /auth/login) once the backend
 * exists — nothing in the UI layer needs to change.
 */
public interface AuthRepository {
    void login(String username, String password, Callback<Officer> callback);
    void logout();
    Officer getCachedOfficer();
}
