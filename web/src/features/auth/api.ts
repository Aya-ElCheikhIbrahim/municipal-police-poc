import { apiClient, tokenStore } from '../../shared/api/client';
import type { LoginRequest, LoginResponse, User } from './types';

export const authApi = {
  /** POST /login/ : anonymous: no token to send yet. */
  login: (credentials: LoginRequest) =>
    apiClient.post<LoginResponse>('/login/', credentials, { anonymous: true }),

  /**
   * POST /logout/ : blacklists the refresh token server-side.
   * Clearing localStorage alone leaves the refresh token usable.
   */
  logout: async () => {
    const refresh = tokenStore.getRefresh();
    if (refresh) {
      await apiClient.post('/logout/', { refresh });
    }
  },

  /** GET /users/me/ : the authoritative current user. */
  me: () => apiClient.get<User>('/users/me/'),
};