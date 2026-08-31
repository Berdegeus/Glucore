import { BadRequestError } from '@glucore/shared';

/**
 * Parsing and validation for the account slice of the request body.
 *
 * The profile payload used to be one object spanning account and patient
 * fields, validated in one place. Now the account half is validated here and
 * the patient half in glucose-service; the gateway will split the body by owner
 * and call both. Fields this service does not own are ignored rather than
 * rejected, so an unsplit body from an older client still works on the half
 * this service is responsible for.
 */

// Deliberately the same expression the monolith used. It is permissive, and
// tightening it is a product decision with a migration attached: addresses that
// registered under the old rule must keep working.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_FULL_NAME_LENGTH = 3;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone: string | null | undefined;
}

export interface RegisterBody {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  [ignored: string]: unknown;
}

/**
 * A single 400 `{ error: 'Invalid input' }` for every shape problem, matching
 * what the monolith answered. Naming the offending field would be friendlier
 * and is a contract change: the app branches on the message today.
 */
export function parseRegister(body: RegisterBody): RegisterInput {
  const email = body.email == null ? undefined : normalizeEmail(body.email);
  const fullName = body.fullName?.trim();

  if (
    !email ||
    !isValidEmail(email) ||
    !body.password ||
    !fullName ||
    fullName.length < MIN_FULL_NAME_LENGTH
  ) {
    throw new BadRequestError('Invalid input');
  }

  return { email, password: body.password, fullName, phone: optionalPhone(body.phone) };
}

/**
 * `undefined` leaves the stored value alone; `null` clears it. An empty or
 * whitespace-only string means "clear", because that is what an emptied text
 * field sends.
 */
function optionalPhone(phone: string | null | undefined): string | null | undefined {
  if (phone === undefined) return undefined;
  if (phone === null) return null;
  const trimmed = phone.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export interface UpdateAccountInput {
  fullName?: string;
  phone?: string | null;
  newEmail?: string;
  newPassword?: string;
  currentPassword?: string;
  /** True when the request touches something that requires re-authentication. */
  requiresCurrentPassword: boolean;
}

export interface UpdateAccountBody {
  currentPassword?: string;
  newEmail?: string;
  newPassword?: string;
  fullName?: string;
  phone?: string | null;
  [ignored: string]: unknown;
}

export function parseUpdateAccount(body: UpdateAccountBody): UpdateAccountInput {
  const updatesEmail = body.newEmail !== undefined && body.newEmail.trim().length > 0;
  const updatesPassword = body.newPassword !== undefined && body.newPassword.length > 0;

  const input: UpdateAccountInput = {
    requiresCurrentPassword: updatesEmail || updatesPassword,
    currentPassword: body.currentPassword,
  };

  if (body.fullName !== undefined) {
    const fullName = body.fullName.trim();
    if (fullName.length < MIN_FULL_NAME_LENGTH) throw new BadRequestError('Invalid input');
    input.fullName = fullName;
  }

  const phone = optionalPhone(body.phone);
  if (phone !== undefined) input.phone = phone;

  if (updatesEmail) {
    const newEmail = normalizeEmail(body.newEmail as string);
    if (!isValidEmail(newEmail)) throw new BadRequestError('Invalid email');
    input.newEmail = newEmail;
  }

  if (updatesPassword) input.newPassword = body.newPassword;

  return input;
}
