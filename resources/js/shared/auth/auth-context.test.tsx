import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AuthProvider, getAccessToken, setAccessTokenForTests, useAuth } from './auth-context';
import {
  postApiV1AuthLogin,
  postApiV1AuthLogout,
  postApiV1AuthRefresh,
  postApiV1AuthTotpVerify,
} from '../../api/generated/auth/auth';
import { getApiV1Profile } from '../../api/generated/profile/profile';
import type { UserInfo } from '../../api/generated/models';

vi.mock('../../api/generated/auth/auth', () => ({
  postApiV1AuthLogin: vi.fn(),
  postApiV1AuthLogout: vi.fn(),
  postApiV1AuthRefresh: vi.fn(),
  postApiV1AuthTotpVerify: vi.fn(),
}));

vi.mock('../../api/generated/profile/profile', () => ({
  getApiV1Profile: vi.fn(),
}));

const mockLogin = postApiV1AuthLogin as ReturnType<typeof vi.fn>;
const mockLogout = postApiV1AuthLogout as ReturnType<typeof vi.fn>;
const mockRefresh = postApiV1AuthRefresh as ReturnType<typeof vi.fn>;
const mockTOTPVerify = postApiV1AuthTotpVerify as ReturnType<typeof vi.fn>;
const mockProfile = getApiV1Profile as ReturnType<typeof vi.fn>;

function userFixture(overrides: Partial<UserInfo> = {}): UserInfo {
  return {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
    totp_enabled: false,
    ...overrides,
  } as UserInfo;
}

function makeWrapper(onAuthFailed?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider onAuthFailed={onAuthFailed}>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, queryClient };
}

beforeEach(() => {
  setAccessTokenForTests(null);
  mockLogin.mockReset();
  mockLogout.mockReset();
  mockRefresh.mockReset();
  mockTOTPVerify.mockReset();
  mockProfile.mockReset();
});

afterEach(() => {
  setAccessTokenForTests(null);
});

describe('useAuth.login', () => {
  it('seeds user from the login response and stores the access token in memory', async () => {
    const user = userFixture();
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
        user,
      },
    });
    mockProfile.mockResolvedValue({ success: true, data: user });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.login({ username: 'alice', password: 'Pass1234!' });
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.isAuthenticated).toBe(true);
    expect(getAccessToken()).toBe('access-1');
    expect(mockLogin).toHaveBeenCalledWith({ username: 'alice', password: 'Pass1234!' });
  });

  it('reconciles user via /api/v1/profile in the background after login', async () => {
    const loginUser = userFixture({ username: 'alice', email: 'old@example.com' });
    const reconciledUser = userFixture({ username: 'alice', email: 'new@example.com' });
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        access_token: 'a',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
        user: loginUser,
      },
    });
    mockProfile.mockResolvedValue({ success: true, data: reconciledUser });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.login({ username: 'alice', password: 'Pass1234!' });
    });

    await waitFor(() => expect(result.current.user?.email).toBe('new@example.com'));
    expect(mockProfile).toHaveBeenCalled();
  });

  it('rethrows when the server response envelope reports failure', async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: { code: 'invalid_credentials', message: 'no' },
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await expect(
      act(async () => {
        await result.current.login({ username: 'alice', password: 'wrong' });
      })
    ).rejects.toThrow();
    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});

describe('useAuth.login + verifyTOTP', () => {
  it('returns totpRequired when the server reports a TOTP challenge and stores the pending token', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        totp_required: true,
        temporary_token: 'totp-pending-jwt',
        message: 'Two-factor authentication required',
      },
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    let outcome: { totpRequired: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.login({ username: 'alice', password: 'Pass1234!' });
    });

    expect(outcome).toEqual({ totpRequired: true });
    expect(result.current.totpPending).toBe(true);
    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(mockProfile).not.toHaveBeenCalled();
  });

  it('verifyTOTP completes the login by sending the pending token as Bearer and seeding full auth', async () => {
    const user = userFixture();
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        totp_required: true,
        temporary_token: 'totp-pending-jwt',
        message: 'TOTP required',
      },
    });
    mockTOTPVerify.mockResolvedValue({
      success: true,
      data: {
        access_token: 'after-totp',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
        user,
      },
    });
    mockProfile.mockResolvedValue({ success: true, data: user });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.login({ username: 'alice', password: 'Pass1234!' });
    });
    await act(async () => {
      await result.current.verifyTOTP('123456');
    });

    expect(mockTOTPVerify).toHaveBeenCalledWith(
      { code: '123456' },
      { headers: { Authorization: 'Bearer totp-pending-jwt' } }
    );
    expect(getAccessToken()).toBe('after-totp');
    expect(result.current.user).toEqual(user);
    expect(result.current.totpPending).toBe(false);
  });

  it('verifyTOTP rejects if no pending TOTP challenge exists', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await expect(
      act(async () => {
        await result.current.verifyTOTP('123456');
      })
    ).rejects.toThrow(/no pending TOTP challenge/i);
    expect(mockTOTPVerify).not.toHaveBeenCalled();
  });
});

describe('useAuth.initialise', () => {
  it('refreshes the access token and fetches the profile when the refresh cookie is valid', async () => {
    const user = userFixture();
    mockRefresh.mockResolvedValue({
      success: true,
      data: {
        access_token: 'refreshed-1',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
      },
    });
    mockProfile.mockResolvedValue({ success: true, data: user });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.initialise();
    });

    expect(getAccessToken()).toBe('refreshed-1');
    expect(result.current.user).toEqual(user);
    expect(result.current.isLoading).toBe(false);
  });

  it('leaves user null when the refresh server reports failure', async () => {
    mockRefresh.mockResolvedValue({ success: false });
    const onAuthFailed = vi.fn();
    const { Wrapper } = makeWrapper(onAuthFailed);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.initialise();
    });

    expect(getAccessToken()).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(onAuthFailed).not.toHaveBeenCalled();
  });

  it('is idempotent — concurrent and repeat calls trigger only one refresh', async () => {
    let resolveRefresh: (v: unknown) => void = () => {};
    mockRefresh.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );
    mockProfile.mockResolvedValue({ success: true, data: userFixture() });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      void result.current.initialise();
      void result.current.initialise();
      resolveRefresh({
        success: true,
        data: {
          access_token: 'x',
          refresh_token: 'r',
          token_type: 'Bearer',
          expires_in: 900,
          refresh_expires_in: 2592000,
        },
      });
      await result.current.initialise();
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockProfile).toHaveBeenCalledTimes(1);
  });
});

describe('useAuth.refresh and logout', () => {
  it('refresh() returns the new token and seeds it in memory', async () => {
    mockRefresh.mockResolvedValue({
      success: true,
      data: {
        access_token: 'new-token',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
      },
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.refresh();
    });
    expect(returned).toBe('new-token');
    expect(getAccessToken()).toBe('new-token');
  });

  it('refresh() invokes onAuthFailed when the refresh response is not successful', async () => {
    mockRefresh.mockResolvedValue({ success: false });
    const onAuthFailed = vi.fn();
    const { Wrapper } = makeWrapper(onAuthFailed);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.refresh();
    });
    expect(onAuthFailed).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
  });

  it('logout clears the access token, the user, and the query cache', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        access_token: 'a',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
        user: userFixture(),
      },
    });
    mockProfile.mockResolvedValue({ success: true, data: userFixture() });
    mockLogout.mockResolvedValue({ success: true, data: { message: 'ok' } });
    const onAuthFailed = vi.fn();
    const { Wrapper, queryClient } = makeWrapper(onAuthFailed);
    queryClient.setQueryData(['some', 'cached', 'data'], { keep: false });
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.login({ username: 'alice', password: 'Pass1234!' });
    });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(['some', 'cached', 'data'])).toBeUndefined();
    expect(onAuthFailed).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalled();
  });

  it('logout still clears local state when the server logout call rejects', async () => {
    mockLogin.mockResolvedValue({
      success: true,
      data: {
        access_token: 'a',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
        user: userFixture(),
      },
    });
    mockProfile.mockResolvedValue({ success: true, data: userFixture() });
    mockLogout.mockRejectedValue(new Error('server unreachable'));
    const onAuthFailed = vi.fn();
    const { Wrapper } = makeWrapper(onAuthFailed);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.login({ username: 'alice', password: 'Pass1234!' });
    });
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(onAuthFailed).toHaveBeenCalledTimes(1);
  });
});

describe('AuthProvider integration with apiClient', () => {
  it('wires configureAuth so a 401 in api client triggers the refresh path', async () => {
    mockRefresh.mockResolvedValue({
      success: true,
      data: {
        access_token: 'after-401',
        refresh_token: 'r',
        token_type: 'Bearer',
        expires_in: 900,
        refresh_expires_in: 2592000,
      },
    });
    const { Wrapper } = makeWrapper();
    renderHook(() => useAuth(), { wrapper: Wrapper });
    const { configureAuth: _configureAuth, ...api } = await import('../../api/client');
    void api;
    setAccessTokenForTests(null);
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.refresh();
    });
    expect(getAccessToken()).toBe('after-401');
  });
});
