import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { summaryFixture } from '../../../test/summaryFakes';
import type { GlucoseSummary, SummaryQuery, SummaryRepository } from '../domain/summary';
import { createLoadPatientSummary } from './loadPatientSummary';

const RANGE = { from: '2026-08-05', to: '2026-08-06' };

/** A repository that records the queries it receives and answers `answer`, or fails with `failure`. */
function fakeRepository(answer: GlucoseSummary = summaryFixture(), failure?: Error) {
  const queries: SummaryQuery[] = [];
  const repository: SummaryRepository = {
    load(query) {
      queries.push(query);
      return failure ? Promise.reject(failure) : Promise.resolve(answer);
    },
  };
  return { repository, queries };
}

function setup(repository: SummaryRepository, zone = 'America/Sao_Paulo') {
  return createLoadPatientSummary({ summaries: repository, timeZone: { timeZone: () => zone } });
}

describe('createLoadPatientSummary (PAC-01, PAC-02, PAC-03)', () => {
  it('asks the repository for the period in the browser zone and returns its summary', async () => {
    const answer = summaryFixture({ gmiPercent: 7.1 });
    const { repository, queries } = fakeRepository(answer);

    const summary = await setup(repository)({ range: RANGE });

    expect(summary).toBe(answer);
    expect(queries).toEqual([{ range: RANGE, timeZone: 'America/Sao_Paulo' }]);
  });

  it('reads the zone at each call, so a change of zone is picked up', async () => {
    const { repository, queries } = fakeRepository();
    let zone = 'America/Sao_Paulo';
    const load = createLoadPatientSummary({ summaries: repository, timeZone: { timeZone: () => zone } });

    await load({ range: RANGE });
    zone = 'Europe/Lisbon';
    await load({ range: RANGE });

    expect(queries.map((q) => q.timeZone)).toEqual(['America/Sao_Paulo', 'Europe/Lisbon']);
  });

  it('accepts a period of exactly 90 days', async () => {
    const { repository, queries } = fakeRepository();
    const ninety = { from: '2026-01-01', to: '2026-03-31' };

    await setup(repository)({ range: ninety });

    expect(queries).toHaveLength(1);
    expect(queries[0]?.range).toEqual(ninety);
  });

  it('passes the failure of the repository on as it is', async () => {
    const failure = new AppError('unavailable');
    const { repository } = fakeRepository(undefined, failure);

    await expect(setup(repository)({ range: RANGE })).rejects.toBe(failure);
  });
});

describe('createLoadPatientSummary, a refused period (PAC-04)', () => {
  it.each([
    ['91 days', { from: '2026-01-01', to: '2026-04-01' }],
    ['a start after the end', { from: '2026-03-02', to: '2026-03-01' }],
    ['an empty end', { from: '2026-03-01', to: '' }],
  ])('fails with a validation error for %s and never calls the repository', async (_label, range) => {
    const { repository, queries } = fakeRepository();

    await expect(setup(repository)({ range })).rejects.toMatchObject({ kind: 'validation', code: 'INVALID_PERIOD' });

    expect(queries).toEqual([]);
  });
});

describe('createLoadPatientSummary, scope', () => {
  it('leaves the patient id out for the signed-in patient', async () => {
    const { repository, queries } = fakeRepository();

    await setup(repository)({ range: RANGE });

    expect(queries[0]).not.toHaveProperty('patientId');
  });

  it('asks for the linked patient when a patient id is given', async () => {
    const { repository, queries } = fakeRepository();

    await setup(repository)({ range: RANGE, patientId: 'p-7' });

    expect(queries).toEqual([{ range: RANGE, timeZone: 'America/Sao_Paulo', patientId: 'p-7' }]);
  });
});
