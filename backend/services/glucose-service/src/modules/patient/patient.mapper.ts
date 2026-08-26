/**
 * The glucose range the app assumes before a patient has saved one. Also what
 * registration writes, so the profile screen and the stored row agree.
 */
export const DEFAULT_TARGET_MIN = 80;
export const DEFAULT_TARGET_MAX = 180;

/** Account and profile as one payload, the shape the profile screen reads. */
export interface ProfileDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  role: string;
  createdAt: string;
  patient: {
    birthDate: string | null;
    diabetesType: string | null;
    weightKg: number | null;
    targetRangeMin: number;
    targetRangeMax: number;
  };
}

export interface ProfileSource {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  role: string;
  createdAt: Date;
  patient: {
    birthDate: Date | null;
    diabetesType: string | null;
    weightKg: unknown;
    targetRangeMin: number;
    targetRangeMax: number;
  } | null;
}

/**
 * `patient` is always present in the response even when no row exists yet: the
 * row is created lazily, and the profile screen would otherwise have to render
 * a missing object rather than the defaults.
 *
 * `birthDate` is truncated to its calendar date. It is stored at UTC midnight,
 * and sending the instant would let a client re-interpret it in local time and
 * show the previous day.
 */
export function toProfileDto(user: ProfileSource): ProfileDto {
  const patient = user.patient;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    status: user.status,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    patient: {
      birthDate: patient?.birthDate?.toISOString().slice(0, 10) ?? null,
      diabetesType: patient?.diabetesType ?? null,
      // Decimal column; see the carbs mapper for why Number().
      weightKg: patient?.weightKg == null ? null : Number(patient.weightKg),
      targetRangeMin: patient?.targetRangeMin ?? DEFAULT_TARGET_MIN,
      targetRangeMax: patient?.targetRangeMax ?? DEFAULT_TARGET_MAX,
    },
  };
}
