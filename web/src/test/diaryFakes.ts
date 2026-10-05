import type { CarbEntry, DiaryRepository, InsulinEntry, Reading } from '../features/patient-dashboard/domain/diary';

export const reading = (timestampMs: number, value = 120): Reading => ({ value, timestampMs, trend: 'FLAT', rate: 0, alarmCode: null });

export const carb = (timeMs: number, grams = 30, id = `carb-${timeMs}`): CarbEntry => ({ id, grams, description: 'Pão', timeMs });

export const insulin = (timeMs: number, units = 4, id = `ins-${timeMs}`): InsulinEntry => ({
  id,
  units,
  type: 'RAPID',
  timeMs,
  dayOfWeek: 'WEDNESDAY',
});

interface Diary {
  readings?: Reading[];
  carbs?: CarbEntry[];
  insulin?: InsulinEntry[];
}

/** A diary repository over fixed lists, counting how often each is read. */
export function fakeDiary({ readings = [], carbs = [], insulin: doses = [] }: Diary = {}) {
  const calls = { readings: 0, carbs: 0, insulin: 0 };
  const repository: DiaryRepository = {
    listReadings: () => {
      calls.readings += 1;
      return Promise.resolve(readings);
    },
    listCarbs: () => {
      calls.carbs += 1;
      return Promise.resolve(carbs);
    },
    listInsulin: () => {
      calls.insulin += 1;
      return Promise.resolve(doses);
    },
  };
  return { repository, calls };
}
