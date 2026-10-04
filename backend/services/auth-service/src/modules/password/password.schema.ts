import { BadRequestError } from '@glucore/shared';

import { isValidEmail, normalizeEmail } from '../accounts/accounts.schema';

export function parseForgotPassword(body: { email?: string }): string {
  const { email } = body;
  if (!email || !isValidEmail(email)) throw new BadRequestError('Invalid email');
  return normalizeEmail(email);
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export function parseResetPassword(body: { token?: string; password?: string }): ResetPasswordInput {
  const { token, password } = body;
  if (!token || !password) throw new BadRequestError('Invalid input');
  return { token, password };
}
