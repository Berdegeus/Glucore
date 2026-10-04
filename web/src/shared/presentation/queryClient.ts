import { QueryClient } from '@tanstack/react-query';
import { isAppError, type AppErrorKind } from '../domain/appError';

/** Retries after the first failure, for the kinds worth repeating (ACC-05). */
const MAX_RETRIES = 2;
const RETRYABLE: readonly AppErrorKind[] = ['unavailable', 'rate-limited'];

const BASE_DELAY_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/** Dashboard data reloads this often while the tab is visible (PAC-16). */
export const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Retry only what can change on its own: a `503` or a `429`. A `403`, `401`,
 * `400` or `404` would answer the same again, and a failure that is not an
 * `AppError` is a bug that repeating will not fix. `failureCount` is 0 on the
 * first failure.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return isAppError(error) && RETRYABLE.includes(error.kind);
}

/**
 * How long to wait before the next try: the `Retry-After` of a `429`, else an
 * exponential backoff of 1 s, 2 s, ... capped at 30 s.
 */
export function retryDelay(failureCount: number, error: unknown): number {
  if (isAppError(error) && error.retryAfterSeconds !== undefined) return error.retryAfterSeconds * 1000;
  return Math.min(BASE_DELAY_MS * 2 ** failureCount, MAX_BACKOFF_MS);
}

/** The one query client of the app, with the retry policy and the 5 minute reload. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay,
        refetchInterval: REFETCH_INTERVAL_MS,
        refetchIntervalInBackground: false,
      },
    },
  });
}
