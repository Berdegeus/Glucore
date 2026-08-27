import { BadRequestError } from '@glucore/shared';

/** A carbohydrate entry as the app sends it. */
export interface CarbInput {
  grams: number;
  description: string;
  timeMs: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Field order matters: the messages are asserted verbatim by the suite, so the
 * first failing field is the one reported.
 */
export function parseCarbBody(body: unknown): CarbInput {
  const b = (body ?? {}) as { grams?: unknown; description?: unknown; timeMs?: unknown };
  if (!isFiniteNumber(b.grams)) throw new BadRequestError('grams must be a number');
  if (typeof b.description !== 'string') throw new BadRequestError('description must be a string');
  if (!isFiniteNumber(b.timeMs)) throw new BadRequestError('timeMs must be a number (epoch ms)');
  return { grams: b.grams, description: b.description, timeMs: b.timeMs };
}
