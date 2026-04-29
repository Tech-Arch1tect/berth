let csrfToken: string | undefined;

export function setCsrfToken(token: string | undefined) {
  csrfToken = token;
}

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

export const apiClient = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);

  const res = await fetch(url, { ...init, headers });
  const data = await parseBody(res);

  if (!res.ok) throw new ApiError(res.status, data);

  return data as T;
};
