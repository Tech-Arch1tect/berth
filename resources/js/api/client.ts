let csrfToken: string | undefined;

export function setCsrfToken(token: string | undefined) {
  csrfToken = token;
}

let getAccessToken: () => string | null = () => null;
let onUnauthorized: (() => Promise<string | null>) | null = null;

export type AuthHooks = {
  getAccessToken: () => string | null;
  onUnauthorized: () => Promise<string | null>;
};

export function configureAuth(hooks: AuthHooks): void {
  getAccessToken = hooks.getAccessToken;
  onUnauthorized = hooks.onUnauthorized;
}

export function resetAuth(): void {
  getAccessToken = () => null;
  onUnauthorized = null;
}

const REFRESH_URL = '/api/v1/auth/refresh';
const LOGIN_URL = '/api/v1/auth/login';

export class ApiError<T = unknown> extends Error {
  constructor(
    readonly status: number,
    readonly data: T
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

export function isApiError<T = unknown>(error: unknown): error is ApiError<T> {
  return error instanceof ApiError;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204 || res.status === 205 || res.status === 304) return undefined;
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
  }
  return res.blob();
}

function buildHeaders(init: RequestInit | undefined, accessToken: string | null): Headers {
  const headers = new Headers(init?.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

function shouldAttemptRefresh(url: string, status: number): boolean {
  if (status !== 401) return false;
  if (!onUnauthorized) return false;
  return url !== REFRESH_URL && url !== LOGIN_URL;
}

export const apiClient = async <T>(url: string, init?: RequestInit): Promise<T> => {
  let res = await fetch(url, { ...init, headers: buildHeaders(init, getAccessToken()) });

  if (shouldAttemptRefresh(url, res.status)) {
    const newToken = await onUnauthorized!();
    if (newToken) {
      res = await fetch(url, { ...init, headers: buildHeaders(init, newToken) });
    }
  }

  const data = await parseBody(res);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
};
