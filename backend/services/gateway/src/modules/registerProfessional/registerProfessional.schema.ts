import type { RegisterProfessionalSagaInput } from './registerProfessional.saga';

const ACCOUNT_FIELDS = ['email', 'password', 'fullName', 'phone'] as const;
const PROFILE_FIELDS = ['licenseNumber', 'specialty'] as const;

/**
 * Splits the merged professional registration body by which service owns each
 * field. A whitelist, so anything else (above all `role`) is dropped here and
 * never reaches a downstream: the role of the account is fixed by the route on
 * the auth side, not by what the caller sends. Deliberately no validation, for
 * the reason given in `register.schema.ts` — a missing licenseNumber reaches
 * glucose-service as a missing field and comes back as its 400.
 */
export function parseRegisterProfessionalInput(body: Record<string, unknown>): RegisterProfessionalSagaInput {
  const account: Record<string, unknown> = {};
  for (const key of ACCOUNT_FIELDS) {
    if (body[key] !== undefined) account[key] = body[key];
  }

  const profile: Record<string, unknown> = {};
  for (const key of PROFILE_FIELDS) {
    if (body[key] !== undefined) profile[key] = body[key];
  }

  return { account, profile };
}
