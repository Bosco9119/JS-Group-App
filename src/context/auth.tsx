import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setUnauthorizedHandler } from '@/lib/api';
import { fetchMe, login as loginRequest, logout as logoutRequest } from '@/lib/driver-api';
import { clearToken, getToken, setToken } from '@/lib/token';
import type { DriverProfile, DriverUser } from '@/lib/types';
import { ApiError } from '@/lib/types';

type AuthState = {
  ready: boolean;
  token: string | null;
  user: DriverUser | null;
  driver: DriverProfile | null;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ready: false,
    token: null,
    user: null,
    driver: null,
  });

  const resetSession = useCallback(async () => {
    await clearToken();
    setState({
      ready: true,
      token: null,
      user: null,
      driver: null,
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setState((prev) => ({
        ...prev,
        ready: true,
        token: null,
        user: null,
        driver: null,
      }));
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setState({ ready: true, token: null, user: null, driver: null });
          }
          return;
        }

        const me = await fetchMe();
        if (!cancelled) {
          setState({
            ready: true,
            token,
            user: me.user,
            driver: me.driver,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await clearToken();
        }
        if (!cancelled) {
          setState({ ready: true, token: null, user: null, driver: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email.trim(), password);
    await setToken(response.token);
    setState({
      ready: true,
      token: response.token,
      user: response.user,
      driver: response.driver,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (state.token) {
        await logoutRequest();
      }
    } catch {
      // Always clear local session even if network logout fails.
    } finally {
      await resetSession();
    }
  }, [resetSession, state.token]);

  const refreshMe = useCallback(async () => {
    const me = await fetchMe();
    setState((prev) => ({
      ...prev,
      user: me.user,
      driver: me.driver,
    }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.token && state.user && state.driver),
      login,
      logout,
      refreshMe,
    }),
    [state, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
