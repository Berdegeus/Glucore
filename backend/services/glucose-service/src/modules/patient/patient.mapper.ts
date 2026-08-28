/**
 * The glucose range the app assumes before a patient has saved one. Also what
 * the lazily-created patient row gets, so the profile screen and the stored row
 * agree.
 */
export const DEFAULT_TARGET_MIN = 80;
export const DEFAULT_TARGET_MAX = 180;

/**
 * The patient half of what used to be one profile payload.
 *
 * `toProfileDto` used to render account and patient blocks together, reading a
 * `User` row with its `patient` relation included. Those two halves are in
 * different databases now: auth-service renders the account block from its own
 * mapper, this one renders the patient block, and the gateway composes them
 * back into the shape the app knows.
 *
 * The composition is not built yet, so nothing calls this today — it is the
 * half that survives the split, kept as the contract the gateway will fill.
 */
export interface PatientDto {
  birthDate: string | null;
  diabetesType: string | null;
  weightKg: number | null;
  targetRangeMin: number;
  targetRangeMax: number;
}

export interface PatientSource {
  birthDate: Date | null;
  diabetesType: string | null;
  weightKg: unknown;
  targetRangeMin: number;
  targetRangeMax: number;
}

/**
 * A missing patient renders as the defaults rather than as null.
 *
 * The row is created lazily — a user can hold a token before any clinical data
 * exists — and the profile screen would otherwise have to render a missing
 * object. That matters more after the split, not less: registration no longer
 * creates the row at all.
 *
 * `birthDate` is truncated to its calendar date. It is stored at UTC midnight,
 * and sending the instant would let a client re-interpret it in local time and
 * show the previous day.
 */
export function toPatientDto(patient: PatientSource | null): PatientDto {
  return {
    birthDate: patient?.birthDate?.toISOString().slice(0, 10) ?? null,
    diabetesType: patient?.diabetesType ?? null,
    // Decimal column; see the carbs mapper for why Number().
    weightKg: patient?.weightKg == null ? null : Number(patient.weightKg),
    targetRangeMin: patient?.targetRangeMin ?? DEFAULT_TARGET_MIN,
    targetRangeMax: patient?.targetRangeMax ?? DEFAULT_TARGET_MAX,
  };
}
