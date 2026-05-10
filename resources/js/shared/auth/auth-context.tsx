import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { configureAuth, resetAuth } from '../../api/client';
import {
  postApiV1AuthLogin,
  postApiV1AuthLogout,
  postApiV1AuthRefresh,
} from '../../api/generated/auth/auth';
import { getApiV1Profile } from '../../api/generated/profile/profile';
import type { UserInfo } from '../../api/generated/models';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessTokenForTests(token: string | null): void {
  accessToken = token;
}

async function refreshAccessTokenInternal(): Promise<string | null> {
  const resp = await postApiV1AuthRefresh({});
  if (resp.success && resp.data?.access_token) {
    accessToken = resp.data.access_token;
    return accessToken;
  }

  accessToken = null;
  return null;
}

async function fetchProfile(): Promise<UserInfo | null> {
  const resp = await getApiV1Profile();
  if (resp.success && resp.data) return resp.data;

  return null;
}

export type AuthContextValue = {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (creds: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  initialise: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = {
  children: ReactNode;
  onAuthFailed?: () => void;
};

export function AuthProvider({ children, onAuthFailed }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const initialisePromise = useRef<Promise<void> | null>(null);

  const handleAuthFailed = useCallback(() => {
    setUser(null);
    if (onAuthFailed) {
      onAuthFailed();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/auth/login');
    }
  }, [onAuthFailed]);

  useEffect(() => {
    configureAuth({
      getAccessToken,
      onUnauthorized: async () => {
        const newTok = await refreshAccessTokenInternal();
        if (!newTok) handleAuthFailed();
        return newTok;
      },
    });
    return () => {
      resetAuth();
    };
  }, [handleAuthFailed]);

  const initialise = useCallback(async () => {
    if (initialisePromise.current) return initialisePromise.current;
    initialisePromise.current = (async () => {
      const tok = await refreshAccessTokenInternal();
      if (tok) {
        const profile = await fetchProfile();
        if (profile) setUser(profile);
      }
      setIsLoading(false);
    })();
    return initialisePromise.current;
  }, []);

  const login = useCallback(async (creds: { username: string; password: string }) => {
    const resp = await postApiV1AuthLogin(creds);
    if (!resp.success || !resp.data) {
      throw new Error('login response did not contain data');
    }
    accessToken = resp.data.access_token;
    setUser(resp.data.user);
    void fetchProfile().then((p) => {
      if (p) setUser(p);
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await postApiV1AuthLogout({});
    } catch {
      // failed logout?
    } finally {
      accessToken = null;
      setUser(null);
      queryClient.clear();
      handleAuthFailed();
    }
  }, [queryClient, handleAuthFailed]);

  const refresh = useCallback(async () => {
    const tok = await refreshAccessTokenInternal();
    if (!tok) handleAuthFailed();
    return tok;
  }, [handleAuthFailed]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      refresh,
      initialise,
    }),
    [user, isLoading, login, logout, refresh, initialise]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
