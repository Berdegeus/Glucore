import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { carb, fakeDiary, insulin, reading } from '../../../test/diaryFakes';
import type { DiaryRepository } from '../domain/diary';
import { createLoadDayDetail, localDayOf } from './loadDayDetail';

const SAO_PAULO = 'America/Sao_Paulo';
/** 2026-08-05 00:00 in Sao Paulo (UTC-3) is 03:00 UTC. */
const AUG_5_BRT = Date.UTC(2026, 7, 5, 3, 0, 0);
const AUG_6_BRT = Date.UTC(2026, 7, 6, 3, 0, 0);
/** 23:30 on 2026-08-05 in Sao Paulo, which is already 2026-08-06 in UTC. */
const AUG_5_2330_BRT = Date.UTC(2026, 7, 6, 2, 30);
const MINUTE = 60_000;

function setup(repository: DiaryRepository, zone = SAO_PAULO) {
  return createLoadDayDetail({ diary: repository, timeZone: { timeZone: () => zone } });
}

/** The readings of `day`, by value, for a diary of `readings` alone. */
async function readingValuesOn(day: string, readings: ReturnType<typeof reading>[]): Promise<number[]> {
  const { repository } = fakeDiary({ readings });
  return (await setup(repository)()).detailOf(day).readings.map((r) => r.value);
}

describe('localDayOf (PAC-11)', () => {
  it.each([
    ['one millisecond before local midnight', AUG_6_BRT - 1, SAO_PAULO, '2026-08-05'],
    ['exactly local midnight', AUG_6_BRT, SAO_PAULO, '2026-08-06'],
    ['23:30 local, already the next day in UTC', AUG_5_2330_BRT, SAO_PAULO, '2026-08-05'],
    ['the same instant read in UTC', AUG_5_2330_BRT, 'UTC', '2026-08-06'],
    ['a zone ahead of UTC', Date.UTC(2026, 7, 5, 20, 0), 'Asia/Tokyo', '2026-08-06'],
  ])('puts %s on the right calendar day', (_label, ms, zone, day) => {
    expect(localDayOf(ms, zone)).toBe(day);
  });
});

describe('createLoadDayDetail, available days (PAC-11)', () => {
  it('offers the days that have readings, newest first, each once', async () => {
    const { repository } = fakeDiary({
      readings: [reading(AUG_6_BRT + 5 * MINUTE), reading(AUG_6_BRT - MINUTE), reading(AUG_6_BRT - 2 * MINUTE), reading(AUG_5_BRT)],
    });

    expect((await setup(repository)()).days).toEqual(['2026-08-06', '2026-08-05']);
  });

  it('does not offer a day that has only carbohydrate or insulin', async () => {
    const { repository } = fakeDiary({
      readings: [reading(AUG_5_BRT + MINUTE)],
      carbs: [carb(AUG_6_BRT + MINUTE)],
      insulin: [insulin(AUG_6_BRT + MINUTE)],
    });

    expect((await setup(repository)()).days).toEqual(['2026-08-05']);
  });

  it('has no day for an empty diary', async () => {
    const { repository } = fakeDiary();

    expect((await setup(repository)()).days).toEqual([]);
  });

  it('cuts the days in the browser zone, read at each load', async () => {
    const { repository } = fakeDiary({ readings: [reading(AUG_5_2330_BRT)] });
    let zone = SAO_PAULO;
    const load = createLoadDayDetail({ diary: repository, timeZone: { timeZone: () => zone } });

    expect((await load()).days).toEqual(['2026-08-05']);
    zone = 'UTC';
    expect((await load()).days).toEqual(['2026-08-06']);
  });
});

describe('createLoadDayDetail, one day (PAC-11)', () => {
  it('keeps a 23:30 reading on the day it happened in Sao Paulo, not on the UTC day', async () => {
    const readings = [reading(AUG_5_2330_BRT, 101), reading(AUG_6_BRT + 10 * MINUTE, 202)];

    expect(await readingValuesOn('2026-08-05', readings)).toEqual([101]);
    expect(await readingValuesOn('2026-08-06', readings)).toEqual([202]);
  });

  it('includes the first instant of the day and leaves out the first instant of the next', async () => {
    expect(await readingValuesOn('2026-08-05', [reading(AUG_6_BRT, 3), reading(AUG_6_BRT - 1, 2), reading(AUG_5_BRT, 1)])).toEqual([1, 2]);
  });

  it('orders the readings of the day from the earliest to the latest, though the API sends newest first', async () => {
    const newestFirst = [reading(AUG_5_BRT + 3 * MINUTE, 3), reading(AUG_5_BRT + 2 * MINUTE, 2), reading(AUG_5_BRT + MINUTE, 1)];

    expect(await readingValuesOn('2026-08-05', newestFirst)).toEqual([1, 2, 3]);
  });

  it('takes the carbohydrate and insulin of that local day only', async () => {
    const { repository } = fakeDiary({
      readings: [reading(AUG_5_BRT + MINUTE)],
      carbs: [carb(AUG_6_BRT, 50, 'next'), carb(AUG_6_BRT - 1, 20, 'last'), carb(AUG_5_BRT - 1, 10, 'before')],
      insulin: [insulin(AUG_6_BRT + 1, 6, 'next'), insulin(AUG_5_BRT, 3, 'first')],
    });

    const detail = (await setup(repository)()).detailOf('2026-08-05');

    expect(detail.carbs.map((c) => c.id)).toEqual(['last']);
    expect(detail.insulin.map((i) => i.id)).toEqual(['first']);
  });

  it('answers empty lists, in the zone, for a day with nothing', async () => {
    const { repository } = fakeDiary({ readings: [reading(AUG_5_BRT)] });

    const detail = (await setup(repository)()).detailOf('2026-01-01');

    expect(detail).toEqual({ day: '2026-01-01', timeZone: SAO_PAULO, readings: [], carbs: [], insulin: [] });
  });
});

describe('createLoadDayDetail, loading', () => {
  it('reads each part of the diary once per load', async () => {
    const { repository, calls } = fakeDiary({ readings: [reading(AUG_5_BRT)] });

    await setup(repository)();

    expect(calls).toEqual({ readings: 1, carbs: 1, insulin: 1 });
  });

  it('lets a failure of any read through, as the repository raised it', async () => {
    const failure = new AppError('unavailable');
    const { repository } = fakeDiary();
    const broken: DiaryRepository = { ...repository, listCarbs: () => Promise.reject(failure) };

    await expect(setup(broken)()).rejects.toBe(failure);
  });
});
