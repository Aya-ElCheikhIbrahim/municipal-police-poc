import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { tokenStore, setSessionExpiredHandler, ApiError } from '../../shared/api/client';
import { authApi } from './api';
import type { LoginUser } from './types';

interface AuthContextValue {
  user: LoginUser | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.getAccess()) {
        setIsRestoring(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  async function login(username: string, password: string) {
    const data = await authApi.login({ username, password });

    if (data.user.role === 'officer') {
      throw new ApiError(403, null, 'Officers must use the mobile app.');
    }

    tokenStore.set(data.access, data.refresh);
    setUser(data.user);
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, isRestoring, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}