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
  postApiV1AuthTotpVerify,
} from '../../api/generated/auth/auth';
import { getApiV1Profile } from '../../api/generated/profile/profile';
import type { ResponseAuthLoginData, UserInfo } from '../../api/generated/models';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessTokenForTests(token: string | null): void {
  accessToken = token;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessTokenInternal(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const resp = await postApiV1AuthRefresh({});
      if (resp.success && resp.data?.access_token) {
        accessToken = resp.data.access_token;
        return accessToken;
      }
      accessToken = null;
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function fetchProfile(): Promise<UserInfo | null> {
  const resp = await getApiV1Profile();
  if (resp.success && resp.data && 'email' in resp.data) return resp.data;

  return null;
}

export type LoginResult = { totpRequired: false } | { totpRequired: true };

export type AuthContextValue = {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  totpPending: boolean;
  login: (creds: { username: string; password: string }) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  initialise: () => Promise<void>;
  verifyTOTP: (code: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export type AuthProviderProps = {
  children: ReactNode;
  onAuthFailed?: () => void;
};

export function AuthProvider({ children, onAuthFailed }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totpPendingToken, setTotpPendingTokenState] = useState<string | null>(null);
  const totpPendingTokenRef = useRef<string | null>(null);
  const setTotpPendingToken = useCallback((token: string | null) => {
    totpPendingTokenRef.current = token;
    setTotpPendingTokenState(token);
  }, []);
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

  useEffect(() => {
    initialise().catch(() => {
      setIsLoading(false);
    });
  }, [initialise]);

  const login = useCallback(
    async (creds: { username: string; password: string }): Promise<LoginResult> => {
      const resp = await postApiV1AuthLogin(creds);
      if (!resp.success || !resp.data) {
        throw new Error('login response did not contain data');
      }
      if ('totp_required' in resp.data && resp.data.totp_required) {
        setTotpPendingToken(resp.data.temporary_token);
        return { totpRequired: true };
      }
      const data = resp.data as Extract<typeof resp.data, { access_token: string }>;
      accessToken = data.access_token;
      setUser(data.user);
      void fetchProfile().then((p) => {
        if (p) setUser(p);
      });
      return { totpRequired: false };
    },
    []
  );

  const verifyTOTP = useCallback(async (code: string) => {
    const tokenAtCallTime = totpPendingTokenRef.current;
    if (!tokenAtCallTime) {
      throw new Error('no pending TOTP challenge — call login first');
    }
    const resp = (await postApiV1AuthTotpVerify(
      { code },
      { headers: { Authorization: `Bearer ${tokenAtCallTime}` } }
    )) as ResponseAuthLoginData;
    if (!resp.success || !resp.data) {
      throw new Error('totp verify response did not contain data');
    }
    accessToken = resp.data.access_token;
    setUser(resp.data.user);
    setTotpPendingToken(null);
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
      totpPending: totpPendingToken !== null,
      login,
      logout,
      refresh,
      initialise,
      verifyTOTP,
    }),
    [user, isLoading, totpPendingToken, login, logout, refresh, initialise, verifyTOTP]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
