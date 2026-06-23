import { isApiError } from '../../api/client';

export function fieldErrorsFromApiError(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  const data = error.data as { error?: { details?: Record<string, string> } } | null;
  return data?.error?.details ?? {};
}

export function messageFromApiError(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    const data = error.data as { error?: { message?: string } } | null;
    const message = data?.error?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
}
