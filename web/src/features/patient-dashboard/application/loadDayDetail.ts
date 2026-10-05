import type { TimeZoneProvider } from '../../../shared/domain/ports';
import type { CarbEntry, DiaryRepository, InsulinEntry, Reading } from '../domain/diary';

export interface LoadDayDetailDeps {
  diary: DiaryRepository;
  /** The browser's zone: the day is cut in it, like the summary's days (RSP-09). */
  timeZone: TimeZoneProvider;
}

/** What happened on one local day. The readings run from the earliest to the latest. */
export interface DayDetail {
  /** `YYYY-MM-DD` in `timeZone`. */
  day: string;
  timeZone: string;
  readings: Reading[];
  carbs: CarbEntry[];
  insulin: InsulinEntry[];
}

/** The diary as loaded, ready to be read one day at a time without asking the API again. */
export interface DiaryDays {
  /** The local days that have readings, newest first (PAC-11). */
  days: readonly string[];
  /** One day of the diary; a day with nothing gives empty lists. */
  detailOf(day: string): DayDetail;
}

export type LoadDayDetail = () => Promise<DiaryDays>;

/** What the day detail widget needs; the app passes `container.useCases.patientDiary`. */
export interface DiaryUseCases {
  loadDayDetail: LoadDayDetail;
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** `YYYY-MM-DD` of an instant on the calendar of `timeZone`; the `en-CA` locale writes dates in that order. */
export function localDayOf(timestampMs: number, timeZone: string): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(timestampMs);
}

/** The entries whose instant falls on `day` of `timeZone`, in the order they were given. */
function onDay<T>(entries: readonly T[], instantOf: (entry: T) => number, day: string, timeZone: string): T[] {
  return entries.filter((entry) => localDayOf(instantOf(entry), timeZone) === day);
}

/**
 * Loads the diary and cuts it into the browser's local days (PAC-11). The
 * zone is read at each load. The offered days come from the readings alone: a
 * day with only carbohydrate or insulin has no line to draw the markers on.
 * The three lists are fetched once and every day is then read from memory, so
 * changing the day never goes back to the API.
 *
 * SPEC_DEVIATION: tasks.md names this `createLoadDayDetail(day, tz)`; it takes
 * its ports as one deps object like every other use case and returns the
 * loaded days, which `detailOf(day)` then cuts.
 * Reason: the widget changes day without a new request, so the day is not an
 * argument of the load.
 */
export function createLoadDayDetail({ diary, timeZone }: LoadDayDetailDeps): LoadDayDetail {
  return async () => {
    const zone = timeZone.timeZone();
    const [readings, carbs, insulin] = await Promise.all([diary.listReadings(), diary.listCarbs(), diary.listInsulin()]);
    const days = [...new Set(readings.map((entry) => localDayOf(entry.timestampMs, zone)))].sort().reverse();
    return {
      days,
      detailOf: (day) => ({
        day,
        timeZone: zone,
        readings: onDay(readings, (entry) => entry.timestampMs, day, zone).sort((a, b) => a.timestampMs - b.timestampMs),
        carbs: onDay(carbs, (entry) => entry.timeMs, day, zone),
        insulin: onDay(insulin, (entry) => entry.timeMs, day, zone),
      }),
    };
  };
}
