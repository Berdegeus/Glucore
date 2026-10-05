import { BadRequestError } from '@glucore/shared';

export const MAX_LICENSE_NUMBER_LENGTH = 40;
export const MAX_SPECIALTY_LENGTH = 80;

export interface ProfessionalInput {
  licenseNumber: string;
  specialty: string;
}

export interface ProfessionalBody {
  licenseNumber?: unknown;
  specialty?: unknown;
  [ignored: string]: unknown;
}

/** Trimmed, 1..max characters; anything that is not a string is as invalid as blank. */
function requiredText(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new BadRequestError('Invalid input');
  const text = value.trim();
  if (text.length === 0 || text.length > max) throw new BadRequestError('Invalid input');
  return text;
}

/**
 * The professional's own registration data (REG-05). Identity is not here: the
 * user id comes from the internal token, and any other field in the body
 * (a `userId`, a `role`) is ignored rather than rejected.
 */
export function parseProfessional(body: ProfessionalBody): ProfessionalInput {
  return {
    licenseNumber: requiredText(body.licenseNumber, MAX_LICENSE_NUMBER_LENGTH),
    specialty: requiredText(body.specialty, MAX_SPECIALTY_LENGTH),
  };
}
