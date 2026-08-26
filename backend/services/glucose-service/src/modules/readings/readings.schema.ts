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
 * The sensor pushes a backlog after every reconnect, so a sync is a batch.
 * Nothing beyond the array shape is validated here — that is the behaviour the
 * app depends on today, and tightening it belongs to a contract change, not to
 * this refactor.
 */
export function parseReadingBatch(body: unknown): ReadingInput[] {
  const { readings } = (body ?? {}) as { readings?: unknown };
  if (!Array.isArray(readings)) {
    throw new BadRequestError('readings must be array');
  }
  return readings as ReadingInput[];
}
