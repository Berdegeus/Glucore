import { BadRequestError } from '@glucore/shared';

/** An alert as the app sends it. */
export interface AlertInput {
  type: string;
  timestampMs: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Field order matters: the messages are asserted verbatim by the suite, so the
 * first failing field is the one reported.
 */
export function parseAlertBody(body: unknown): AlertInput {
  const b = (body ?? {}) as { type?: unknown; timestampMs?: unknown };
  if (typeof b.type !== 'string' || b.type.trim().length === 0) {
    throw new BadRequestError('type must be a non-empty string');
  }
  if (!isFiniteNumber(b.timestampMs)) {
    throw new BadRequestError('timestampMs must be a number (epoch ms)');
  }
  return { type: b.type, timestampMs: b.timestampMs };
}
