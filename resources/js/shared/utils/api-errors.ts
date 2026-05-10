import { isApiError } from '../../api/client';

export function fieldErrorsFromApiError(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  const data = error.data as { error?: { details?: Record<string, string> } } | null;
  return data?.error?.details ?? {};
}
