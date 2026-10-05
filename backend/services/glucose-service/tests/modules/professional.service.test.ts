import { BadRequestError, ForbiddenError } from '@glucore/shared';
import { describe, expect, it, vi } from 'vitest';

import type { DashboardSummaryDto } from '../../src/modules/dashboard/dashboard.mapper';
import type { DashboardQuery } from '../../src/modules/dashboard/dashboard.schema';
import { GrantPolicy } from '../../src/modules/sharing/grantPolicy';
import { ProfessionalService } from '../../src/modules/professional/professional.service';
import type { PatientListQuery } from '../../src/modules/professional/professional.schema';
import {
  FakeCohortRepository,
  FakeDashboardRepository,
  FakeSharingRepository,
  FakeTimeZoneChecker,
  RecordedAudit,
  metricsRow,
} from '../helpers/fakes';

const PRO = '00000000-0000-4000-8000-0000000000a1';
const NOW = new Date('2026-09-01T12:00:00.000Z');
const CONTEXT = { ipAddress: '10.0.0.1', userAgent: 'vitest' };

const patientId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function build() {
  const cohort = new FakeCohortRepository();
  const dashboard = new FakeDashboardRepository();
  const sharing = new FakeSharingRepository();
  const audit = new RecordedAudit();
  const getSummary = vi.fn(async () => ({ marker: 'summary' }) as unknown as DashboardSummaryDto);
  const resolveBounds = vi.spyOn(dashboard, 'resolveBounds');
  const service = new ProfessionalService(
    cohort,
    dashboard,
    { getSummary },
    new GrantPolicy(sharing, () => NOW),
    new FakeTimeZoneChecker(['UTC', 'America/Sao_Paulo', 'Pacific/Kiritimati']),
    audit.record,
    () => NOW,
  );
  return { service, cohort, sharing, audit, getSummary, resolveBounds };
}

const listQuery = (overrides: Partial<PatientListQuery> = {}): PatientListQuery => ({
  days: 14,
  tz: 'UTC',
  page: 1,
  limit: 50,
  ...overrides,
});

describe('ProfessionalService.listPatients', () => {
  it('answers each patient metrics without a name, in grant order, with sensor use derived from the readings', async () => {
    const { service, cohort } = build();
    const [a, b] = [patientId(1), patientId(2)];
    cohort.granted = [a, b];
    // Staged out of order: the page must keep the grant order.
    cohort.metrics = [
      metricsRow(b, { readingsCount: 288 * 7, timeInRangePercent: 55 }),
      metricsRow(a, { readingsCount: 0, hypoEpisodes: 2, alertsCount: 3 }),
    ];

    const result = await service.listPatients(PRO, listQuery({ days: 14 }), CONTEXT);

    expect(result.items.map((item) => item.patientId)).toEqual([a, b]);
    expect(result.items[0]).toEqual({
      patientId: a,
      lastReadingAt: '2026-09-01T11:00:00.000Z',
      timeInRangePercent: 70,
      gmiPercent: 7,
      cvPercent: 30,
      sensorUsePercent: 0,
      zoneDistribution: { veryLow: 0, low: 0, target: 100, high: 0, veryHigh: 0 },
      hypoEpisodes: 2,
      alertsCount: 3,
    });
    expect(result.items[1].sensorUsePercent).toBe(50);
    expect(Object.keys(result.items[0])).not.toContain('fullName');
    expect(Object.keys(result.items[0])).not.toContain('readingsCount');
  });

  it('echoes the page, the limit and the total across pages, and asks the repository for that page only', async () => {
    const { service, cohort } = build();
    cohort.granted = [1, 2, 3, 4, 5].map(patientId);
    cohort.metrics = cohort.granted.map((id) => metricsRow(id));

    const result = await service.listPatients(PRO, listQuery({ page: 2, limit: 2 }), CONTEXT);

    expect(result).toMatchObject({ page: 2, limit: 2, total: 5 });
    expect(result.items.map((item) => item.patientId)).toEqual([patientId(3), patientId(4)]);
    expect(cohort.listCalls[0]).toMatchObject({ professionalId: PRO, request: { page: 2, limit: 2 } });
    expect(cohort.metricsCalls[0].ids).toEqual([patientId(3), patientId(4)]);
  });

  it('measures the last N calendar days ending today in the requested zone', async () => {
    const { service, resolveBounds } = build();

    // 12:00 UTC on 1 Sep is already 02:00 on 2 Sep in Kiritimati (UTC+14).
    await service.listPatients(PRO, listQuery({ days: 7, tz: 'Pacific/Kiritimati' }), CONTEXT);
    await service.listPatients(PRO, listQuery({ days: 7, tz: 'UTC' }), CONTEXT);

    expect(resolveBounds.mock.calls[0]).toEqual([
      new Date('2026-08-27T00:00:00.000Z'),
      new Date('2026-09-02T00:00:00.000Z'),
      'Pacific/Kiritimati',
    ]);
    expect(resolveBounds.mock.calls[1]).toEqual([
      new Date('2026-08-26T00:00:00.000Z'),
      new Date('2026-09-01T00:00:00.000Z'),
      'UTC',
    ]);
  });

  it('refuses a time zone Postgres does not know before touching any patient data', async () => {
    const { service, cohort, audit } = build();

    const failure = await service.listPatients(PRO, listQuery({ tz: 'Mars/Olympus' }), CONTEXT).catch((e) => e);

    expect(failure).toBeInstanceOf(BadRequestError);
    expect(failure).toMatchObject({ code: 'INVALID_TIMEZONE' });
    expect(cohort.listCalls).toEqual([]);
    expect(audit.entries).toEqual([]);
  });

  it('writes one list audit entry with the professional, the route and the patient count, and nothing else', async () => {
    const { service, cohort, audit } = build();
    cohort.granted = [patientId(1), patientId(2)];
    cohort.metrics = [
      metricsRow(patientId(1), { timeInRangePercent: 63.37, gmiPercent: 7.91 }),
      metricsRow(patientId(2), { timeInRangePercent: 41.58 }),
    ];

    await service.listPatients(PRO, listQuery(), CONTEXT);

    expect(audit.entries).toEqual([
      {
        userId: PRO,
        entity: 'PatientData',
        action: 'READ_LIST',
        entityId: null,
        metadata: { route: '/professional/patients', patientCount: 2 },
        ...CONTEXT,
      },
    ]);
    const trail = JSON.stringify(audit.entries);
    for (const value of ['63.37', '7.91', '41.58', 'zoneDistribution']) expect(trail).not.toContain(value);
  });
});

describe('ProfessionalService.patientSummary', () => {
  const query: DashboardQuery = {
    from: new Date('2026-08-01T00:00:00.000Z'),
    to: new Date('2026-08-14T00:00:00.000Z'),
    bucket: 'day',
    tz: 'UTC',
  };
  const PATIENT = patientId(7);

  function grantTo(sharing: FakeSharingRepository, overrides: Partial<{ expiresAt: Date | null; revokedAt: Date | null }> = {}) {
    sharing.grants.push({
      id: patientId(900),
      patientId: PATIENT,
      healthProfessionalId: PRO,
      grantedAt: new Date('2026-08-01T00:00:00.000Z'),
      expiresAt: null,
      revokedAt: null,
      ...overrides,
    });
  }

  it('returns the patient own summary, for that patient and that query, and audits the read with the patient id', async () => {
    const { service, sharing, getSummary, audit } = build();
    grantTo(sharing);

    const summary = await service.patientSummary(PRO, PATIENT, query, CONTEXT);

    expect(summary).toEqual({ marker: 'summary' });
    expect(getSummary).toHaveBeenCalledWith(PATIENT, query);
    expect(audit.entries).toEqual([
      {
        userId: PRO,
        entity: 'PatientData',
        action: 'READ',
        entityId: PATIENT,
        metadata: { route: '/professional/patients/:id/summary' },
        ...CONTEXT,
      },
    ]);
  });

  it.each([
    ['never granted', undefined],
    ['revoked', { revokedAt: new Date('2026-08-20T00:00:00.000Z') }],
    ['expired', { expiresAt: new Date('2026-08-31T00:00:00.000Z') }],
  ])('throws NO_ACTIVE_GRANT for a grant that was %s, with no summary read and no audit', async (_label, grant) => {
    const { service, sharing, getSummary, audit } = build();
    if (grant) grantTo(sharing, grant);

    const failure = await service.patientSummary(PRO, PATIENT, query, CONTEXT).catch((e) => e);

    expect(failure).toBeInstanceOf(ForbiddenError);
    expect(failure).toMatchObject({ code: 'NO_ACTIVE_GRANT' });
    expect(getSummary).not.toHaveBeenCalled();
    expect(audit.entries).toEqual([]);
  });
});

describe('ProfessionalService.cohortSummary', () => {
  const cohortQuery = { days: 14, tz: 'America/Sao_Paulo' };

  async function summarize(rows: ReturnType<typeof metricsRow>[], hypoHours: Array<{ hour: number; count: number }> = []) {
    const harness = build();
    harness.cohort.granted = rows.map((row) => row.patientId);
    harness.cohort.metrics = rows;
    harness.cohort.hypoHours = hypoHours;
    const summary = await harness.service.cohortSummary(PRO, cohortQuery, CONTEXT);
    return { ...harness, summary };
  }

  it('buckets time in range as < 50, 50 to < 70 and >= 70, with the edges going to the higher bucket', async () => {
    const { summary } = await summarize(
      [49.99, 50, 69.99, 70, 100, 0].map((tir, i) => metricsRow(patientId(i + 1), { timeInRangePercent: tir })),
    );

    expect(summary.tirHistogram).toEqual([
      { bucket: 'lt50', count: 2 },
      { bucket: '50to70', count: 2 },
      { bucket: 'gte70', count: 2 },
    ]);
  });

  it('leaves patients without a time in range out of the histogram and out of the averages', async () => {
    const { summary } = await summarize([
      metricsRow(patientId(1), { timeInRangePercent: 60, gmiPercent: 7.1 }),
      metricsRow(patientId(2), { timeInRangePercent: 71, gmiPercent: 6.5 }),
      metricsRow(patientId(3), { timeInRangePercent: null, gmiPercent: null, cvPercent: null }),
    ]);

    expect(summary.patientCount).toBe(3);
    expect(summary.tirHistogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2);
    expect(summary.avgTimeInRangePercent).toBe(65.5);
    expect(summary.avgGmiPercent).toBe(6.8);
  });

  it('has null averages when no patient has metrics', async () => {
    const { summary } = await summarize([
      metricsRow(patientId(1), { timeInRangePercent: null, gmiPercent: null }),
    ]);

    expect(summary.avgTimeInRangePercent).toBeNull();
    expect(summary.avgGmiPercent).toBeNull();
  });

  it('counts patients with no reading in the last 24 hours, and none ever, as stale', async () => {
    const { summary } = await summarize([
      metricsRow(patientId(1), { lastReadingAt: '2026-08-31T12:00:00.000Z' }), // exactly 24 h: recent
      metricsRow(patientId(2), { lastReadingAt: '2026-08-31T11:59:59.999Z' }), // 24 h + 1 ms: stale
      metricsRow(patientId(3), { lastReadingAt: null }),
      metricsRow(patientId(4), { lastReadingAt: '2026-09-01T11:59:00.000Z' }),
    ]);

    expect(summary.patientsStale).toBe(2);
  });

  it('counts patients with at least one hypo episode, and lists each patient zones and variability', async () => {
    const { summary } = await summarize([
      metricsRow(patientId(1), { hypoEpisodes: 3, cvPercent: 41.2 }),
      metricsRow(patientId(2), { hypoEpisodes: 1 }),
      metricsRow(patientId(3), { hypoEpisodes: 0 }),
    ]);

    expect(summary.patientsWithHypo).toBe(2);
    expect(summary.perPatient).toEqual([
      {
        patientId: patientId(1),
        timeInRangePercent: 70,
        cvPercent: 41.2,
        zoneDistribution: { veryLow: 0, low: 0, target: 100, high: 0, veryHigh: 0 },
      },
      expect.objectContaining({ patientId: patientId(2) }),
      expect.objectContaining({ patientId: patientId(3) }),
    ]);
  });

  it('fills the 24 hours of the hypo chart, putting the repository counts at their hours', async () => {
    const { summary, cohort } = await summarize(
      [metricsRow(patientId(1))],
      [
        { hour: 3, count: 2 },
        { hour: 23, count: 1 },
      ],
    );

    expect(summary.hypoByHour).toHaveLength(24);
    expect(summary.hypoByHour.map((entry) => entry.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(summary.hypoByHour.filter((entry) => entry.count > 0)).toEqual([
      { hour: 3, count: 2 },
      { hour: 23, count: 1 },
    ]);
    expect(cohort.hypoCalls[0].tz).toBe('America/Sao_Paulo');
  });

  it('asks for the oldest 200 active patients at most, and for the same patients in both queries', async () => {
    const { cohort } = await summarize([metricsRow(patientId(1))]);

    expect(cohort.listCalls[0].request).toEqual({ page: 1, limit: 200 });
    expect(cohort.metricsCalls[0].ids).toEqual(cohort.hypoCalls[0].ids);
    expect(cohort.metricsCalls[0].range).toEqual(cohort.hypoCalls[0].range);
  });

  it('answers zeros and full-shape empty charts for a professional with no active grants', async () => {
    const { summary, audit } = await summarize([]);

    expect(summary).toMatchObject({
      patientCount: 0,
      avgTimeInRangePercent: null,
      avgGmiPercent: null,
      patientsWithHypo: 0,
      patientsStale: 0,
      perPatient: [],
      tirHistogram: [
        { bucket: 'lt50', count: 0 },
        { bucket: '50to70', count: 0 },
        { bucket: 'gte70', count: 0 },
      ],
    });
    expect(summary.hypoByHour).toHaveLength(24);
    expect(summary.hypoByHour.every((entry) => entry.count === 0)).toBe(true);
    expect(audit.entries).toHaveLength(1);
  });

  it('writes one cohort audit entry with the route and the patient count, and no value', async () => {
    const { audit } = await summarize([
      metricsRow(patientId(1), { timeInRangePercent: 63.37, gmiPercent: 7.91 }),
      metricsRow(patientId(2)),
    ]);

    expect(audit.entries).toEqual([
      {
        userId: PRO,
        entity: 'PatientData',
        action: 'READ_COHORT',
        entityId: null,
        metadata: { route: '/professional/cohort/summary', patientCount: 2 },
        ...CONTEXT,
      },
    ]);
    const trail = JSON.stringify(audit.entries);
    for (const value of ['63.37', '7.91']) expect(trail).not.toContain(value);
  });

  it('refuses an unknown time zone with INVALID_TIMEZONE before reading anything', async () => {
    const { service, cohort } = build();

    const failure = await service.cohortSummary(PRO, { days: 7, tz: 'Mars/Olympus' }, CONTEXT).catch((e) => e);

    expect(failure).toMatchObject({ code: 'INVALID_TIMEZONE' });
    expect(cohort.listCalls).toEqual([]);
  });
});
