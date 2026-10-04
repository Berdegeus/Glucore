const ACCOUNT_FIELDS = ['email', 'password', 'fullName', 'phone'] as const;
const PATIENT_FIELDS = ['birthDate', 'diabetesType', 'weightKg', 'targetRangeMin', 'targetRangeMax'] as const;

export interface RegisterSagaInput {
  account: Record<string, unknown>;
  patient: Record<string, unknown>;
}

/**
 * Splits the merged registration body by which service owns each field.
 * Deliberately no validation here: `/internal/accounts` and
 * `/internal/patients` already validate their own slice, and duplicating that
 * would just be two places that can disagree about what "invalid" means.
 */
export function parseRegisterSagaInput(body: Record<string, unknown>): RegisterSagaInput {
  const account: Record<string, unknown> = {};
  for (const key of ACCOUNT_FIELDS) {
    if (body[key] !== undefined) account[key] = body[key];
  }

  const patient: Record<string, unknown> = {};
  for (const key of PATIENT_FIELDS) {
    if (body[key] !== undefined) patient[key] = body[key];
  }

  return { account, patient };
}
