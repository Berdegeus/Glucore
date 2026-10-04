import { BadRequestError } from '@glucore/shared';

/** A glucose sample as the app sends it. */
export interface ReadingInput {
  value: number;
  timestampMs: number;
  trend: string;
  rate: number;
  alarmCode?: number;
}

/**
 * Largest batch one POST accepts. It bounds the transaction, and it keeps the
 * body well under Express's 100 kb JSON default (a reading is ~90 bytes). A
 * longer batch is rejected, never truncated: a silent cut made the app mark the
 * dropped readings as synced, and they never reached the server. The app sends
 * a backlog in chunks of this size.
 */
export const MAX_READING_BATCH = 500;

/**
 * The sensor pushes a backlog after every reconnect, so a sync is a batch.
 * Beyond the array shape and its length nothing is validated here — that is
 * the behaviour the app depends on today, and tightening it belongs to a
 * contract change.
 */
export function parseReadingBatch(body: unknown): ReadingInput[] {
  const { readings } = (body ?? {}) as { readings?: unknown };
  if (!Array.isArray(readings)) {
    throw new BadRequestError('readings must be array');
  }
  if (readings.length > MAX_READING_BATCH) {
    throw new BadRequestError(`readings batch exceeds ${MAX_READING_BATCH} entries`);
  }
  return readings as ReadingInput[];
}
