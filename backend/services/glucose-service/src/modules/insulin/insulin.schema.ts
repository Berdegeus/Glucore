import { BadRequestError } from '@glucore/shared';

/** An insulin dose as the app sends it. */
export interface InsulinInput {
  units: number;
  type: string;
  timeMs: number;
  dayOfWeek?: string;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Field order matters: the messages are asserted verbatim by the suite. */
export function parseInsulinBody(body: unknown): InsulinInput {
  const b = (body ?? {}) as {
    units?: unknown;
    type?: unknown;
    timeMs?: unknown;
    dayOfWeek?: unknown;
  };
  if (!isFiniteNumber(b.units)) throw new BadRequestError('units must be a number');
  if (typeof b.type !== 'string' || b.type.trim().length === 0) {
    throw new BadRequestError('type must be a non-empty string');
  }
  if (!isFiniteNumber(b.timeMs)) throw new BadRequestError('timeMs must be a number (epoch ms)');
  if (b.dayOfWeek !== undefined && typeof b.dayOfWeek !== 'string') {
    throw new BadRequestError('dayOfWeek must be a string');
  }
  return { units: b.units, type: b.type, timeMs: b.timeMs, dayOfWeek: b.dayOfWeek };
}
