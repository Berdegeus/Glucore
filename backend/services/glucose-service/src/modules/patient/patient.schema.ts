import { BadRequestError } from '@glucore/shared';

import { parseOptionalDate, parseOptionalInt, parseOptionalNumber } from './patient.parsers';
import type { CreatePatientInput, UpdatePatientInput } from './patient.repository';

export interface PatientBody {
  birthDate?: string | null;
  diabetesType?: string | null;
  weightKg?: number | string | null;
  targetRangeMin?: number | string;
  targetRangeMax?: number | string;
  [ignored: string]: unknown;
}

/**
 * Shared by the internal "create" and "update" routes. A field present but
 * unparseable is a 400, mirroring the parsers' own `undefined` convention
 * (absent and invalid collapse to the same signal).
 */
function parseFields(body: PatientBody): {
  birthDate?: Date | null;
  diabetesType?: string | null;
  weightKg?: number | null;
  targetRangeMin?: number;
  targetRangeMax?: number;
} {
  const result: {
    birthDate?: Date | null;
    diabetesType?: string | null;
    weightKg?: number | null;
    targetRangeMin?: number;
    targetRangeMax?: number;
  } = {};

  if (body.birthDate !== undefined) {
    const birthDate = parseOptionalDate(body.birthDate);
    if (birthDate === undefined) throw new BadRequestError('Invalid input');
    result.birthDate = birthDate;
  }

  if (body.diabetesType !== undefined) {
    result.diabetesType = body.diabetesType === null ? null : String(body.diabetesType).trim() || null;
  }

  if (body.weightKg !== undefined) {
    const weightKg = parseOptionalNumber(body.weightKg);
    if (weightKg === undefined) throw new BadRequestError('Invalid input');
    if (weightKg !== null && weightKg <= 0) throw new BadRequestError('Invalid input');
    result.weightKg = weightKg;
  }

  if (body.targetRangeMin !== undefined) {
    const targetRangeMin = parseOptionalInt(body.targetRangeMin);
    if (targetRangeMin === undefined) throw new BadRequestError('Invalid input');
    result.targetRangeMin = targetRangeMin;
  }

  if (body.targetRangeMax !== undefined) {
    const targetRangeMax = parseOptionalInt(body.targetRangeMax);
    if (targetRangeMax === undefined) throw new BadRequestError('Invalid input');
    result.targetRangeMax = targetRangeMax;
  }

  if (
    result.targetRangeMin !== undefined &&
    result.targetRangeMax !== undefined &&
    result.targetRangeMin >= result.targetRangeMax
  ) {
    throw new BadRequestError('Invalid input');
  }

  return result;
}

export function parseCreatePatient(body: PatientBody): CreatePatientInput {
  return parseFields(body);
}

export function parseUpdatePatient(body: PatientBody): UpdatePatientInput {
  return parseFields(body);
}
