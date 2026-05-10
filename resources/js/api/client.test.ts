import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, configureAuth, isApiError, resetAuth, setCsrfToken } from './client';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  resetAuth();
  setCsrfToken(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiClient', () => {
  it('attaches the Bearer token from the configured getter', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    configureAuth({ getAccessToken: () => 'token-123', onUnauthorized: async () => null });

    await apiClient('/api/v1/anything');

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-123');
  });

  it('omits Authorization when the token getter returns null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await apiClient('/api/v1/public');

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
  });

  it('on 401 calls onUnauthorized once and retries with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const onUnauthorized = vi.fn().mockResolvedValue('refreshed-token');
    configureAuth({ getAccessToken: () => 'expired-token', onUnauthorized });

    const result = await apiClient<{ ok: boolean }>('/api/v1/anything');

    expect(result).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = fetchMock.mock.calls[1][1].headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer refreshed-token');
  });

  it('on 401 does not retry when onUnauthorized returns null', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { success: false, error: { message: 'gone' } })
    );
    const onUnauthorized = vi.fn().mockResolvedValue(null);
    configureAuth({ getAccessToken: () => 'expired', onUnauthorized });

    await expect(apiClient('/api/v1/anything')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not attempt refresh on 401 from the refresh endpoint itself', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { success: false }));
    const onUnauthorized = vi.fn().mockResolvedValue('would-loop-forever');
    configureAuth({ getAccessToken: () => null, onUnauthorized });

    await expect(apiClient('/api/v1/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(
      ApiError
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not attempt refresh on 401 from the login endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { success: false }));
    const onUnauthorized = vi.fn().mockResolvedValue('token');
    configureAuth({ getAccessToken: () => null, onUnauthorized });

    await expect(apiClient('/api/v1/auth/login', { method: 'POST' })).rejects.toBeInstanceOf(
      ApiError
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('throws ApiError carrying the response body on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { success: false, error: { details: { x: 'bad' } } })
    );

    try {
      await apiClient('/api/v1/anything');
      expect.fail('expected ApiError');
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      const err = e as ApiError<{ error: { details: Record<string, string> } }>;
      expect(err.status).toBe(422);
      expect(err.data.error.details).toEqual({ x: 'bad' });
    }
  });

  it('keeps the existing CSRF + X-Requested-With headers on every request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    setCsrfToken('csrf-abc');

    await apiClient('/api/v1/anything');

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(headers.get('X-CSRF-Token')).toBe('csrf-abc');
  });
});
