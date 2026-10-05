// What the patient logged and what the sensor read, and the port that fetches
// it (ARQ-05, PAC-11). The shapes follow `GET /readings`, `/carbs` and
// `/insulin`; every instant is epoch milliseconds, so the zone that cuts them
// into days is chosen where they are shown.

/** One sensor sample, in mg/dL. */
export interface Reading {
  value: number;
  timestampMs: number;
  trend: string;
  /** Rate of change of the trend, as the sensor reports it. */
  rate: number;
  alarmCode: number | null;
}

/** Carbohydrate the patient logged. */
export interface CarbEntry {
  id: string;
  grams: number;
  description: string;
  timeMs: number;
}

/** An insulin dose the patient logged. */
export interface InsulinEntry {
  id: string;
  units: number;
  type: string;
  timeMs: number;
  /** The weekday the API stored with the dose, e.g. `MONDAY`. */
  dayOfWeek: string;
}

/**
 * Reads the diary of the signed-in patient, newest first. It only reads: the
 * app is the one that records readings, carbohydrates and insulin (PAC-18).
 */
export interface DiaryRepository {
  listReadings(): Promise<Reading[]>;
  listCarbs(): Promise<CarbEntry[]>;
  listInsulin(): Promise<InsulinEntry[]>;
}
