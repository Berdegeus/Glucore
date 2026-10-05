import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { cohortDto, cohortSummaryOf, patientPageDto, patientPageOf, patientRowDto, patientRowOf } from '../../../test/professionalFakes';
import { server } from '../../../test/server';
import type { ProfessionalRepository } from '../domain/cohort';
import { HttpProfessionalRepository } from './httpProfessionalRepository';

const PATIENTS = `${API_BASE}/professional/patients`;
const COHORT = `${API_BASE}/professional/cohort/summary`;
const LIST_QUERY = { days: 14, page: 1, limit: 50, timeZone: 'America/Sao_Paulo' };
const COHORT_QUERY = { days: 30, timeZone: 'America/Sao_Paulo' };

type Call = (repository: ProfessionalRepository) => Promise<unknown>;
const list: Call = (repository) => repository.listPatients(LIST_QUERY);
const cohort: Call = (repository) => repository.cohort(COHORT_QUERY);

function setup(token: string | null = 'tok-1'): ProfessionalRepository {
  return new HttpProfessionalRepository(createTestHttpClient(token).client);
}

const CALLS: [string, string, Call][] = [
  ['listPatients', PATIENTS, list],
  ['cohort', COHORT, cohort],
];

afterEach(() => window.sessionStorage.clear());

describe('HttpProfessionalRepository.listPatients (PRO-03, PRO-15)', () => {
  it('turns the page into rows with a display name', async () => {
    server.use(http.get(PATIENTS, () => HttpResponse.json(patientPageDto([patientRowDto()]))));

    expect(await setup().listPatients(LIST_QUERY)).toEqual(patientPageOf([patientRowOf()]));
  });

  it('uses the initials as the name of a patient the gateway could not name, and keeps the nulls', async () => {
    const unnamed = patientRowDto({
      patientId: 'p2',
      fullName: null,
      initials: 'PB2',
      lastReadingAt: null,
      timeInRangePercent: null,
      gmiPercent: null,
      cvPercent: null,
    });
    server.use(http.get(PATIENTS, () => HttpResponse.json(patientPageDto([unnamed]), { headers: { 'X-Degraded': 'patient-names' } })));

    const [row] = (await setup().listPatients(LIST_QUERY)).items;

    expect(row).toMatchObject({
      patientId: 'p2',
      fullName: null,
      displayName: 'PB2',
      lastReadingAt: null,
      timeInRangePercent: null,
      gmiPercent: null,
      cvPercent: null,
    });
  });

  it('sends days, page, limit and the zone with the bearer token, and reads the paging', async () => {
    let seen: { params: Record<string, string>; authorization: string | null } | undefined;
    server.use(
      http.get(PATIENTS, ({ request }) => {
        seen = { params: Object.fromEntries(new URL(request.url).searchParams), authorization: request.headers.get('Authorization') };
        return HttpResponse.json({ ...patientPageDto([]), page: 3, limit: 10, total: 21 });
      }),
    );

    const page = await setup().listPatients({ days: 7, page: 3, limit: 10, timeZone: 'UTC' });

    expect(seen).toEqual({ params: { days: '7', page: '3', limit: '10', tz: 'UTC' }, authorization: 'Bearer tok-1' });
    expect(page).toEqual({ items: [], page: 3, limit: 10, total: 21 });
  });
});

describe('HttpProfessionalRepository.cohort (PRO-09, PRO-10)', () => {
  it('turns the answer into a CohortSummary with a display name per patient', async () => {
    let params: Record<string, string> = {};
    server.use(
      http.get(COHORT, ({ request }) => {
        params = Object.fromEntries(new URL(request.url).searchParams);
        return HttpResponse.json(cohortDto());
      }),
    );

    expect(await setup().cohort(COHORT_QUERY)).toEqual(cohortSummaryOf());
    expect(params).toEqual({ days: '30', tz: 'America/Sao_Paulo' });
  });

  it('keeps an empty portfolio with its null averages', async () => {
    const empty = cohortDto({ patientCount: 0, avgTimeInRangePercent: null, avgGmiPercent: null, perPatient: [], hypoByHour: [] });
    server.use(http.get(COHORT, () => HttpResponse.json(empty)));

    expect(await setup().cohort(COHORT_QUERY)).toMatchObject({
      patientCount: 0,
      avgTimeInRangePercent: null,
      avgGmiPercent: null,
      perPatient: [],
      hypoByHour: [],
    });
  });
});

describe('HttpProfessionalRepository errors (PRO-13, ARQ-06)', () => {
  it.each(CALLS)('%s: 403 NO_ACTIVE_GRANT becomes forbidden with the code', async (_name, url, call) => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'No active grant', code: 'NO_ACTIVE_GRANT' }, { status: 403 })));

    expect(await rejectionOf(call(setup()))).toMatchObject({ kind: 'forbidden', code: 'NO_ACTIVE_GRANT' });
  });

  it.each(CALLS)('%s: 403 FORBIDDEN_ROLE becomes forbidden with its own code', async (_name, url, call) => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'Wrong role', code: 'FORBIDDEN_ROLE' }, { status: 403 })));

    expect(await rejectionOf(call(setup()))).toMatchObject({ kind: 'forbidden', code: 'FORBIDDEN_ROLE' });
  });

  it.each(CALLS)('%s: an unreachable gateway becomes unavailable', async (_name, url, call) => {
    server.use(http.get(url, () => HttpResponse.error()));

    expect(await rejectionOf(call(setup()))).toMatchObject({ kind: 'unavailable' });
  });

  const MALFORMED: [string, string, object, Call][] = [
    ['listPatients, a row without initials', PATIENTS, patientPageDto([patientRowDto({ initials: undefined })]), list],
    ['listPatients, items that is not a list', PATIENTS, { items: 'nope' }, list],
    ['cohort, a missing patientsStale', COHORT, cohortDto({ patientsStale: undefined }), cohort],
    ['cohort, an unknown TIR bucket', COHORT, cohortDto({ tirHistogram: [{ bucket: 'ten', count: 1 }] }), cohort],
  ];

  it.each(MALFORMED)('%s: rejects it as an unexpected response, naming the endpoint but not the data', async (_name, url, body, call) => {
    server.use(http.get(url, () => HttpResponse.json(body)));

    const error = await rejectionOf(call(setup()));

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain(`GET ${new URL(url).pathname.replace('/api/v1', '')}`);
    expect((error as Error).message).not.toContain('Ana');
  });
});
