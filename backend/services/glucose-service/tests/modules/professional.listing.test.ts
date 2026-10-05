import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaCohortRepository } from '../../src/modules/professional/professional.repository';
import {
  DEFAULT_PATIENT_PAGE_LIMIT,
  MAX_PATIENT_PAGE_LIMIT,
} from '../../src/modules/professional/professional.listing';
import { disconnect, prisma, signedInPatient, signedInProfessional, truncateAll } from '../helpers/db';

/**
 * Which patients a professional lists: only active grants (PRO-11), 50 a page
 * by default and 200 at most (PRO-16), with the total across pages.
 */

const repository = new PrismaCohortRepository(prisma);
const NOW = new Date('2026-09-01T12:00:00.000Z');

afterAll(async () => {
  await disconnect();
});

beforeEach(async () => {
  await truncateAll();
});

interface GrantSeed {
  patientId: string;
  professionalId: string;
  grantedAt?: Date;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
}

async function seedGrants(grants: GrantSeed[]): Promise<void> {
  await prisma.dashboardAccessGrant.createMany({
    data: grants.map((grant) => ({
      patientId: grant.patientId,
      healthProfessionalId: grant.professionalId,
      grantedAt: grant.grantedAt ?? new Date('2026-08-01T00:00:00.000Z'),
      expiresAt: grant.expiresAt ?? null,
      revokedAt: grant.revokedAt ?? null,
      permissionLevel: 'READ',
    })),
  });
}

/** `count` bare patient rows, ids sorted so a test can name the expected order. */
async function seedPatients(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => randomUUID()).sort();
  await prisma.patient.createMany({ data: ids.map((userId) => ({ userId })) });
  return ids;
}

describe('listGrantedPatientIds', () => {
  it('lists only the patients with an active grant of that professional', async () => {
    const professional = (await signedInProfessional()).userId;
    const other = (await signedInProfessional()).userId;
    const [active, revoked, expired, openEnded, theirs] = await Promise.all(
      Array.from({ length: 5 }, async () => (await signedInPatient()).userId),
    );
    await seedGrants([
      { patientId: active, professionalId: professional, expiresAt: new Date('2026-09-01T12:00:00.001Z') },
      { patientId: revoked, professionalId: professional, revokedAt: new Date('2026-08-15T00:00:00.000Z') },
      { patientId: expired, professionalId: professional, expiresAt: new Date('2026-09-01T11:59:59.999Z') },
      { patientId: openEnded, professionalId: professional },
      { patientId: theirs, professionalId: other },
    ]);

    const { ids, total } = await repository.listGrantedPatientIds(professional, NOW);

    expect(ids.sort()).toEqual([active, openEnded].sort());
    expect(total).toBe(2);
  });

  it('treats a grant that expires exactly now as no longer active', async () => {
    const professional = (await signedInProfessional()).userId;
    const patient = (await signedInPatient()).userId;
    await seedGrants([{ patientId: patient, professionalId: professional, expiresAt: NOW }]);

    expect(await repository.listGrantedPatientIds(professional, NOW)).toEqual({ ids: [], total: 0 });
  });

  it('answers an empty page and a zero total for a professional with no grants', async () => {
    const professional = (await signedInProfessional()).userId;

    expect(await repository.listGrantedPatientIds(professional, NOW)).toEqual({ ids: [], total: 0 });
  });

  it('lists a patient once after a revoked grant was followed by a new one', async () => {
    const professional = (await signedInProfessional()).userId;
    const patient = (await signedInPatient()).userId;
    await seedGrants([
      { patientId: patient, professionalId: professional, revokedAt: new Date('2026-08-15T00:00:00.000Z') },
      { patientId: patient, professionalId: professional, grantedAt: new Date('2026-08-20T00:00:00.000Z') },
    ]);

    expect(await repository.listGrantedPatientIds(professional, NOW)).toEqual({ ids: [patient], total: 1 });
  });

  it('orders by grant date, oldest first, and pages through them with a stable total', async () => {
    const professional = (await signedInProfessional()).userId;
    const ids = await seedPatients(5);
    // Granted in reverse id order, one day apart: the order must follow the date, not the id.
    await seedGrants(
      ids.map((patientId, i) => ({
        patientId,
        professionalId: professional,
        grantedAt: new Date(Date.parse('2026-08-10T00:00:00.000Z') - i * 86_400_000),
      })),
    );
    const oldestFirst = [...ids].reverse();

    const first = await repository.listGrantedPatientIds(professional, NOW, { page: 1, limit: 2 });
    const second = await repository.listGrantedPatientIds(professional, NOW, { page: 2, limit: 2 });
    const third = await repository.listGrantedPatientIds(professional, NOW, { page: 3, limit: 2 });
    const beyond = await repository.listGrantedPatientIds(professional, NOW, { page: 4, limit: 2 });

    expect(first).toEqual({ ids: oldestFirst.slice(0, 2), total: 5 });
    expect(second).toEqual({ ids: oldestFirst.slice(2, 4), total: 5 });
    expect(third).toEqual({ ids: oldestFirst.slice(4), total: 5 });
    expect(beyond).toEqual({ ids: [], total: 5 });
  });

  it('defaults to 50 a page and never returns more than 200, whatever limit is asked for', async () => {
    expect(DEFAULT_PATIENT_PAGE_LIMIT).toBe(50);
    expect(MAX_PATIENT_PAGE_LIMIT).toBe(200);
    const professional = (await signedInProfessional()).userId;
    const ids = await seedPatients(MAX_PATIENT_PAGE_LIMIT + 5);
    await seedGrants(ids.map((patientId) => ({ patientId, professionalId: professional })));

    const byDefault = await repository.listGrantedPatientIds(professional, NOW);
    const atMax = await repository.listGrantedPatientIds(professional, NOW, { limit: 200 });
    const overMax = await repository.listGrantedPatientIds(professional, NOW, { limit: 201 });
    const lastPage = await repository.listGrantedPatientIds(professional, NOW, { page: 2, limit: 200 });

    expect(byDefault.ids).toHaveLength(50);
    expect(atMax.ids).toHaveLength(200);
    expect(overMax.ids).toHaveLength(200);
    expect(lastPage.ids).toHaveLength(5);
    expect([byDefault.total, atMax.total, overMax.total, lastPage.total]).toEqual([205, 205, 205, 205]);
  });
});
