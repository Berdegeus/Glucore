import { BadRequestError } from '@glucore/shared';

import { normalizeEmail } from '../accounts/accounts.schema';

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Login validates only that both fields are present.
 *
 * Deliberately not `assertStrongPassword`: accounts created before the strength
 * policy existed must still be able to sign in. The policy applies where a
 * password is *defined*, not where one is checked.
 */
export function parseLogin(body: { email?: string; password?: string }): LoginInput {
  const { email, password } = body;
  if (!email || !password) throw new BadRequestError('Invalid input');
  return { email: normalizeEmail(email), password };
}
