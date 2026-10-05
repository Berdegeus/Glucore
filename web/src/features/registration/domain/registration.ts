// What a professional submits to open an account, the rules the web checks
// before any request (REG-02, REG-05) and the port that sends it (ARQ-05).
// The backend enforces the same rules; checking here only spares the round trip.

import { validatePassword, WEAK_PASSWORD_CODE } from './passwordPolicy';

/** Longest registration number the API accepts (REG-05). */
export const LICENSE_NUMBER_MAX_LENGTH = 40;
/** Longest specialty the API accepts (REG-05). */
export const SPECIALTY_MAX_LENGTH = 80;
/** Shortest full name the API accepts. */
export const FULL_NAME_MIN_LENGTH = 3;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProfessionalRegistration {
  fullName: string;
  email: string;
  password: string;
  /** Left out of the request when the person typed none. */
  phone?: string;
  /** The professional council number (CRM). */
  licenseNumber: string;
  specialty: string;
}

/** What the API answers to a registration: the new account and its access token (REG-01). */
export interface RegistrationResult {
  userId: string;
  token: string;
}

export interface RegistrationRepository {
  /** Rejects with `conflict` (`EMAIL_TAKEN`), `validation` (`WEAK_PASSWORD`, bad fields) or `rate-limited`. */
  registerProfessional(registration: ProfessionalRegistration): Promise<RegistrationResult>;
}

/** The `code` of the `validation` error a refused field turns into; `WEAK_PASSWORD` is the password's. */
export type RegistrationProblem =
  | typeof WEAK_PASSWORD_CODE
  | 'INVALID_FULL_NAME'
  | 'INVALID_EMAIL'
  | 'INVALID_LICENSE_NUMBER'
  | 'INVALID_SPECIALTY';

/** Trims every field but the password; an empty phone is no phone. */
export function normalizeRegistration(input: ProfessionalRegistration): ProfessionalRegistration {
  const phone = input.phone?.trim();
  return {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    password: input.password,
    ...(phone ? { phone } : {}),
    licenseNumber: input.licenseNumber.trim(),
    specialty: input.specialty.trim(),
  };
}

function lengthWithin(text: string, min: number, max: number): boolean {
  return text.length >= min && text.length <= max;
}

/**
 * The first rule a normalized registration breaks, or `null` (REG-02, REG-05):
 * a strong password, a registration number of 1 to 40 characters and a
 * specialty of 1 to 80, after trimming.
 */
export function checkRegistration(registration: ProfessionalRegistration): RegistrationProblem | null {
  if (registration.fullName.length < FULL_NAME_MIN_LENGTH) return 'INVALID_FULL_NAME';
  if (!EMAIL_PATTERN.test(registration.email)) return 'INVALID_EMAIL';
  if (validatePassword(registration.password) !== null) return WEAK_PASSWORD_CODE;
  if (!lengthWithin(registration.licenseNumber, 1, LICENSE_NUMBER_MAX_LENGTH)) return 'INVALID_LICENSE_NUMBER';
  if (!lengthWithin(registration.specialty, 1, SPECIALTY_MAX_LENGTH)) return 'INVALID_SPECIALTY';
  return null;
}
