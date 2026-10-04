const ACCOUNT_FIELDS = ['fullName', 'phone', 'newEmail', 'newPassword', 'currentPassword'] as const;
const PATIENT_FIELDS = ['birthDate', 'diabetesType', 'weightKg', 'targetRangeMin', 'targetRangeMax'] as const;

export interface ProfileUpdateInput {
  account: Record<string, unknown>;
  patient: Record<string, unknown>;
}

/** Same whitelist-split approach as the registration saga, and for the same reason. */
export function splitProfileBody(body: Record<string, unknown>): ProfileUpdateInput {
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
