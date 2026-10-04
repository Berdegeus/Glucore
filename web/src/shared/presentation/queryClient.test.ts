import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ERROR_KINDS, AppError, type AppErrorKind } from '../domain/appError';
import { REFETCH_INTERVAL_MS, createQueryClient, retryDelay, shouldRetry } from './queryClient';

const NEVER_RETRIED: AppErrorKind[] = ['forbidden', 'unauthenticated', 'validation', 'not-found'];

describe('shouldRetry (ACC-05)', () => {
  it.each(NEVER_RETRIED)('does not retry %s', (kind) => {
    expect(shouldRetry(0, new AppError(kind))).toBe(false);
  });

  it('does not retry a FORBIDDEN_ROLE answer', () => {
    expect(shouldRetry(0, new AppError('forbidden', { code: 'FORBIDDEN_ROLE' }))).toBe(false);
  });

  it.each<[number, boolean]>([
    [0, true],
    [1, true],
    [2, false],
    [3, false],
  ])('retries unavailable up to twice: failure %s -> %s', (failureCount, expected) => {
    expect(shouldRetry(failureCount, new AppError('unavailable'))).toBe(expected);
  });

  it('retries a rate-limited call, also twice at most', () => {
    expect(shouldRetry(0, new AppError('rate-limited', { retryAfterSeconds: 3 }))).toBe(true);
    expect(shouldRetry(2, new AppError('rate-limited', { retryAfterSeconds: 3 }))).toBe(false);
  });

  it('does not retry kinds that repeating cannot fix, nor a plain Error', () => {
    const others = APP_ERROR_KINDS.filter((kind) => !['unavailable', 'rate-limited'].includes(kind));
    for (const kind of others) expect(shouldRetry(0, new AppError(kind)), kind).toBe(false);
    expect(shouldRetry(0, new Error('boom'))).toBe(false);
  });
});

describe('retryDelay', () => {
  it('waits the Retry-After of a rate-limited answer, in milliseconds', () => {
    expect(retryDelay(0, new AppError('rate-limited', { retryAfterSeconds: 7 }))).toBe(7000);
    expect(retryDelay(1, new AppError('rate-limited', { retryAfterSeconds: 120 }))).toBe(120_000);
  });

  it('backs off 1 s, 2 s for an unavailable service and caps at 30 s', () => {
    const error = new AppError('unavailable');
    expect(retryDelay(0, error)).toBe(1000);
    expect(retryDelay(1, error)).toBe(2000);
    expect(retryDelay(10, error)).toBe(30_000);
  });

  it('uses the backoff when a rate-limited answer carries no Retry-After', () => {
    expect(retryDelay(0, new AppError('rate-limited'))).toBe(1000);
  });
});

describe('createQueryClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reloads every 5 minutes and only while the tab is visible (PAC-16)', () => {
    const defaults = createQueryClient().getDefaultOptions().queries;
    expect(REFETCH_INTERVAL_MS).toBe(300_000);
    expect(defaults?.refetchInterval).toBe(300_000);
    expect(defaults?.refetchIntervalInBackground).toBe(false);
  });

  it('calls a forbidden query once and an unavailable one three times', async () => {
    const client = createQueryClient();
    const forbidden = vi.fn().mockRejectedValue(new AppError('forbidden', { code: 'FORBIDDEN_ROLE' }));
    const unavailable = vi.fn().mockRejectedValue(new AppError('unavailable'));

    const first = client.fetchQuery({ queryKey: ['forbidden'], queryFn: forbidden }).catch((e: unknown) => e);
    const second = client.fetchQuery({ queryKey: ['unavailable'], queryFn: unavailable }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3000);

    expect(await first).toMatchObject({ kind: 'forbidden' });
    expect(await second).toMatchObject({ kind: 'unavailable' });
    expect(forbidden).toHaveBeenCalledTimes(1);
    expect(unavailable).toHaveBeenCalledTimes(3);
  });

  it('waits for Retry-After before retrying a rate-limited query', async () => {
    const client = createQueryClient();
    const limited = new AppError('rate-limited', { retryAfterSeconds: 5 });
    const queryFn = vi.fn().mockRejectedValueOnce(limited).mockResolvedValue('ok');

    const result = client.fetchQuery({ queryKey: ['limited'], queryFn });
    await vi.advanceTimersByTimeAsync(4999);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe('ok');
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
