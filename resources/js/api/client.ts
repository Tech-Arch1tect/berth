export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiClientConfig = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken: () => string | null;
  onUnauthorized: (() => Promise<string | null>) | null;
  headers: () => Record<string, string>;
};

const defaultConfig: ApiClientConfig = {
  baseUrl: '',
  fetch: (input, init) => fetch(input, init),
  getAccessToken: () => null,
  onUnauthorized: null,
  headers: () => ({}),
};

let config: ApiClientConfig = { ...defaultConfig };

export function configureApiClient(
  partial: Partial<Omit<ApiClientConfig, 'headers'>> & {
    headers?: Record<string, string> | (() => Record<string, string>);
  }
): void {
  const { headers, ...rest } = partial;
  config = {
    ...config,
    ...rest,
    headers:
      headers === undefined
        ? config.headers
        : typeof headers === 'function'
          ? headers
          : () => headers,
  };
}

export function resetApiClient(): void {
  config = { ...defaultConfig };
}

export type AuthHooks = {
  getAccessToken: () => string | null;
  onUnauthorized: () => Promise<string | null>;
};

export function configureAuth(hooks: AuthHooks): void {
  configureApiClient({
    getAccessToken: hooks.getAccessToken,
    onUnauthorized: hooks.onUnauthorized,
  });
}

export function resetAuth(): void {
  configureApiClient({ getAccessToken: () => null, onUnauthorized: null });
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
  for (const [key, value] of Object.entries(config.headers())) {
    if (!headers.has(key)) headers.set(key, value);
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

function shouldAttemptRefresh(url: string, status: number): boolean {
  if (status !== 401) return false;
  if (!config.onUnauthorized) return false;
  return url !== REFRESH_URL && url !== LOGIN_URL;
}

export const apiClient = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const target = config.baseUrl ? `${config.baseUrl}${url}` : url;

  let res = await config.fetch(target, {
    ...init,
    headers: buildHeaders(init, config.getAccessToken()),
  });

  if (shouldAttemptRefresh(url, res.status)) {
    const newToken = await config.onUnauthorized!();
    if (newToken) {
      res = await config.fetch(target, {
        ...init,
        headers: buildHeaders(init, newToken),
      });
    }
  }

  const data = await parseBody(res);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
};
