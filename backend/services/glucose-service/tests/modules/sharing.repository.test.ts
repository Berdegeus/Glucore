import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  PrismaSharingRepository,
  ProfessionalProfileMissingError,
  type RedeemOutcome,
} from '../../src/modules/sharing/sharing.repository';
import { disconnect, prisma, signedInPatient, truncateAll } from '../helpers/db';

/**
 * Integration tests for the consent storage (CON-03, CON-04, CON-07, CON-09)
 * against a real Postgres: the partial unique indexes and the atomic redeem are
 * what these exist to pin.
 */

const repository = new PrismaSharingRepository(prisma);

const NOW = new Date('2026-10-05T12:00:00.000Z');
const IN_24H = new Date(NOW.getTime() + 24 * 3_600_000);
const msFrom = (base: Date, ms: number) => new Date(base.getTime() + ms);

beforeEach(truncateAll);

afterAll(async () => {
  await disconnect();
});

async function seedProfessional(specialty = 'Endocrinologia'): Promise<string> {
  const userId = randomUUID();
  await prisma.healthProfessional.create({ data: { userId, licenseNumber: 'CRM-SP 1', specialty } });
  return userId;
}

/** A pending invite for the patient, returning its hash. */
async function pendingInvite(patientId: string, hash: string = randomUUID(), expiresAt = IN_24H) {
  const { inviteId } = await repository.createInvite(patientId, hash, expiresAt, NOW);
  return { hash, inviteId };
}

async function seedGrant(
  patientId: string,
  healthProfessionalId: string,
  extra: { revokedAt?: Date; expiresAt?: Date } = {},
) {
  return prisma.dashboardAccessGrant.create({
    data: { patientId, healthProfessionalId, permissionLevel: 'READ', grantedAt: NOW, ...extra },
  });
}

/** Narrows a redeem outcome that the test expects to have succeeded. */
function redeemedOf(outcome: RedeemOutcome) {
  if (!outcome.redeemed) throw new Error('expected the redeem to succeed');
  return outcome;
}

const pendingCount = (patientId: string) =>
  prisma.patientInvite.count({ where: { patientId, usedAt: null, revokedAt: null } });

describe('createInvite', () => {
  it('stores only the hash, the expiry and a pending state', async () => {
    const patient = await signedInPatient();

    const created = await repository.createInvite(patient.userId, 'hash-1', IN_24H, NOW);

    expect(created.invalidatedInviteId).toBeNull();
    const row = await prisma.patientInvite.findUniqueOrThrow({ where: { id: created.inviteId } });
    expect(row).toMatchObject({
      patientId: patient.userId,
      codeHash: 'hash-1',
      expiresAt: IN_24H,
      usedAt: null,
      usedBy: null,
      revokedAt: null,
    });
  });

  it('leaves one pending invite after two in a row, and revokes the first (CON-03)', async () => {
    const patient = await signedInPatient();
    const first = await repository.createInvite(patient.userId, 'hash-1', IN_24H, NOW);
    const later = msFrom(NOW, 60_000);

    const second = await repository.createInvite(patient.userId, 'hash-2', IN_24H, later);

    expect(second.invalidatedInviteId).toBe(first.inviteId);
    expect(await pendingCount(patient.userId)).toBe(1);
    const firstRow = await prisma.patientInvite.findUniqueOrThrow({ where: { id: first.inviteId } });
    expect(firstRow.revokedAt).toEqual(later);
    const secondRow = await prisma.patientInvite.findUniqueOrThrow({ where: { id: second.inviteId } });
    expect(secondRow.revokedAt).toBeNull();
  });

  it('does not touch another patient pending invite', async () => {
    const [a, b] = [await signedInPatient(), await signedInPatient()];
    await repository.createInvite(a.userId, 'hash-a', IN_24H, NOW);

    const created = await repository.createInvite(b.userId, 'hash-b', IN_24H, NOW);

    expect(created.invalidatedInviteId).toBeNull();
    expect(await pendingCount(a.userId)).toBe(1);
    expect(await pendingCount(b.userId)).toBe(1);
  });

  it('does not report an already used invite as invalidated', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const used = await pendingInvite(patient.userId);
    await repository.redeemInvite(used.hash, professional, NOW);

    const created = await repository.createInvite(patient.userId, 'hash-next', IN_24H, NOW);

    expect(created.invalidatedInviteId).toBeNull();
    const usedRow = await prisma.patientInvite.findUniqueOrThrow({ where: { id: used.inviteId } });
    expect(usedRow.revokedAt).toBeNull();
    expect(usedRow.usedAt).toEqual(NOW);
  });

  it('survives two concurrent generates with exactly one pending invite left', async () => {
    const patient = await signedInPatient();

    const results = await Promise.all([
      repository.createInvite(patient.userId, 'hash-x', IN_24H, NOW),
      repository.createInvite(patient.userId, 'hash-y', IN_24H, NOW),
    ]);

    expect(results).toHaveLength(2);
    expect(await pendingCount(patient.userId)).toBe(1);
    expect(await prisma.patientInvite.count({ where: { patientId: patient.userId } })).toBe(2);
  });

  it('is backed by a partial unique index: a second pending row is rejected by the database', async () => {
    const patient = await signedInPatient();
    await repository.createInvite(patient.userId, 'hash-1', IN_24H, NOW);

    const direct = prisma.patientInvite.create({
      data: { patientId: patient.userId, codeHash: 'hash-2', expiresAt: IN_24H },
    });

    await expect(direct).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});

describe('redeemInvite', () => {
  it('creates a READ grant, marks the invite used and names the patient (CON-04)', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const invite = await pendingInvite(patient.userId);
    const redeemAt = msFrom(NOW, 5_000);

    const outcome = await repository.redeemInvite(invite.hash, professional, redeemAt);

    expect(outcome).toMatchObject({
      redeemed: true,
      inviteId: invite.inviteId,
      patientId: patient.userId,
      grantCreated: true,
    });
    const grants = await prisma.dashboardAccessGrant.findMany();
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      patientId: patient.userId,
      healthProfessionalId: professional,
      permissionLevel: 'READ',
      grantedAt: redeemAt,
      expiresAt: null,
      revokedAt: null,
    });
    expect(outcome).toMatchObject({ grantId: grants[0].id });
    const row = await prisma.patientInvite.findUniqueOrThrow({ where: { id: invite.inviteId } });
    expect(row).toMatchObject({ usedAt: redeemAt, usedBy: professional });
  });

  it('refuses a code that was already used, and creates no second grant', async () => {
    const patient = await signedInPatient();
    const [first, second] = [await seedProfessional(), await seedProfessional()];
    const invite = await pendingInvite(patient.userId);
    await repository.redeemInvite(invite.hash, first, NOW);

    const outcome = await repository.redeemInvite(invite.hash, second, NOW);

    expect(outcome).toEqual({ redeemed: false });
    expect(await prisma.dashboardAccessGrant.count()).toBe(1);
  });

  it('refuses an unknown code', async () => {
    const professional = await seedProfessional();

    expect(await repository.redeemInvite('no-such-hash', professional, NOW)).toEqual({ redeemed: false });
    expect(await prisma.dashboardAccessGrant.count()).toBe(0);
  });

  it('refuses an invalidated code (replaced by a newer one)', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const old = await pendingInvite(patient.userId, 'old-hash');
    await pendingInvite(patient.userId, 'new-hash');

    expect(await repository.redeemInvite(old.hash, professional, NOW)).toEqual({ redeemed: false });
    expect(await prisma.dashboardAccessGrant.count()).toBe(0);
  });

  it('accepts a code 1 ms before it expires and refuses it exactly at expiry', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const invite = await pendingInvite(patient.userId);

    const atExpiry = await repository.redeemInvite(invite.hash, professional, IN_24H);
    expect(atExpiry).toEqual({ redeemed: false });

    const justBefore = await repository.redeemInvite(invite.hash, professional, msFrom(IN_24H, -1));
    expect(redeemedOf(justBefore).patientId).toBe(patient.userId);
  });

  it('refuses a code well past its expiry', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const invite = await pendingInvite(patient.userId);

    expect(await repository.redeemInvite(invite.hash, professional, msFrom(IN_24H, 3_600_000))).toEqual({
      redeemed: false,
    });
  });

  it('lets exactly one of two simultaneous redeems of the same code win', async () => {
    const patient = await signedInPatient();
    const [first, second] = [await seedProfessional(), await seedProfessional()];
    const invite = await pendingInvite(patient.userId);

    const outcomes = await Promise.all([
      repository.redeemInvite(invite.hash, first, NOW),
      repository.redeemInvite(invite.hash, second, NOW),
    ]);

    expect(outcomes.filter((outcome) => outcome.redeemed)).toHaveLength(1);
    expect(await prisma.dashboardAccessGrant.count()).toBe(1);
    const row = await prisma.patientInvite.findUniqueOrThrow({ where: { id: invite.inviteId } });
    expect([first, second]).toContain(row.usedBy);
  });

  it('reuses the active grant when the professional redeems another code of the same patient (CON-07)', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const firstInvite = await pendingInvite(patient.userId);
    const first = await repository.redeemInvite(firstInvite.hash, professional, NOW);
    const secondInvite = await pendingInvite(patient.userId);

    const second = await repository.redeemInvite(secondInvite.hash, professional, msFrom(NOW, 1_000));

    expect(redeemedOf(first).grantCreated).toBe(true);
    expect(redeemedOf(second).grantCreated).toBe(false);
    expect(redeemedOf(second).grantId).toBe(redeemedOf(first).grantId);
    expect(await prisma.dashboardAccessGrant.count()).toBe(1);
    const row = await prisma.patientInvite.findUniqueOrThrow({ where: { id: secondInvite.inviteId } });
    expect(row.usedAt).not.toBeNull();
  });

  it('creates a new grant after the previous one was revoked, keeping the revoked one as history', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const revoked = await seedGrant(patient.userId, professional, { revokedAt: NOW });
    const invite = await pendingInvite(patient.userId);

    const outcome = await repository.redeemInvite(invite.hash, professional, msFrom(NOW, 1_000));

    expect(redeemedOf(outcome).grantCreated).toBe(true);
    expect(redeemedOf(outcome).grantId).not.toBe(revoked.id);
    expect(await prisma.dashboardAccessGrant.count()).toBe(2);
    expect(await prisma.dashboardAccessGrant.count({ where: { revokedAt: null } })).toBe(1);
  });

  it('replaces a grant whose expiresAt has passed instead of reusing an inactive one', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    const expired = await seedGrant(patient.userId, professional, { expiresAt: msFrom(NOW, -1) });
    const invite = await pendingInvite(patient.userId);

    const outcome = await repository.redeemInvite(invite.hash, professional, NOW);

    expect(redeemedOf(outcome).grantCreated).toBe(true);
    expect(redeemedOf(outcome).grantId).not.toBe(expired.id);
    expect(await repository.isGrantActive(professional, patient.userId, NOW)).toBe(true);
  });

  it('fails without consuming the code when the redeemer has no professional profile', async () => {
    const patient = await signedInPatient();
    const invite = await pendingInvite(patient.userId);

    await expect(repository.redeemInvite(invite.hash, randomUUID(), NOW)).rejects.toBeInstanceOf(
      ProfessionalProfileMissingError,
    );

    const row = await prisma.patientInvite.findUniqueOrThrow({ where: { id: invite.inviteId } });
    expect(row.usedAt).toBeNull();
    expect(await prisma.dashboardAccessGrant.count()).toBe(0);
  });
});

describe('active grants', () => {
  it('lists the active grants with the professional specialty, newest first', async () => {
    const patient = await signedInPatient();
    const [older, newer] = [await seedProfessional('Nutrologia'), await seedProfessional('Endocrinologia')];
    const olderGrant = await prisma.dashboardAccessGrant.create({
      data: {
        patientId: patient.userId,
        healthProfessionalId: older,
        permissionLevel: 'READ',
        grantedAt: msFrom(NOW, -60_000),
      },
    });
    const newerGrant = await seedGrant(patient.userId, newer);

    const grants = await repository.listActiveGrants(patient.userId, NOW);

    expect(grants).toEqual([
      { id: newerGrant.id, professionalId: newer, specialty: 'Endocrinologia', grantedAt: NOW },
      { id: olderGrant.id, professionalId: older, specialty: 'Nutrologia', grantedAt: msFrom(NOW, -60_000) },
    ]);
  });

  it('leaves out revoked and expired grants, and other patients grants (CON-09)', async () => {
    const [patient, other] = [await signedInPatient(), await signedInPatient()];
    const [active, revoked, expired, expiringNow, foreign] = [
      await seedProfessional(),
      await seedProfessional(),
      await seedProfessional(),
      await seedProfessional(),
      await seedProfessional(),
    ];
    await seedGrant(patient.userId, active);
    await seedGrant(patient.userId, revoked, { revokedAt: msFrom(NOW, -1) });
    await seedGrant(patient.userId, expired, { expiresAt: msFrom(NOW, -1) });
    await seedGrant(patient.userId, expiringNow, { expiresAt: NOW });
    await seedGrant(other.userId, foreign);

    const grants = await repository.listActiveGrants(patient.userId, NOW);

    expect(grants.map((grant) => grant.professionalId)).toEqual([active]);
  });

  it('keeps a grant that expires later in the list', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    await seedGrant(patient.userId, professional, { expiresAt: msFrom(NOW, 1) });

    expect(await repository.listActiveGrants(patient.userId, NOW)).toHaveLength(1);
  });

  it('revokes only the owning patient grant, once, and drops it from the list', async () => {
    const [patient, other] = [await signedInPatient(), await signedInPatient()];
    const professional = await seedProfessional();
    const grant = await seedGrant(patient.userId, professional);
    const revokeAt = msFrom(NOW, 1_000);

    expect(await repository.revokeGrant(other.userId, grant.id, revokeAt)).toBeNull();
    expect(await repository.isGrantActive(professional, patient.userId, NOW)).toBe(true);

    expect(await repository.revokeGrant(patient.userId, grant.id, revokeAt)).toEqual({
      professionalId: professional,
    });
    expect(await repository.revokeGrant(patient.userId, grant.id, revokeAt)).toBeNull();

    const row = await prisma.dashboardAccessGrant.findUniqueOrThrow({ where: { id: grant.id } });
    expect(row.revokedAt).toEqual(revokeAt);
    expect(await repository.listActiveGrants(patient.userId, revokeAt)).toEqual([]);
  });

  it('answers null when revoking a grant that does not exist', async () => {
    const patient = await signedInPatient();

    expect(await repository.revokeGrant(patient.userId, randomUUID(), NOW)).toBeNull();
  });

  it('isGrantActive: true for an open grant and for one expiring 1 ms after now', async () => {
    const patient = await signedInPatient();
    const [open, later] = [await seedProfessional(), await seedProfessional()];
    await seedGrant(patient.userId, open);
    await seedGrant(patient.userId, later, { expiresAt: msFrom(NOW, 1) });

    expect(await repository.isGrantActive(open, patient.userId, NOW)).toBe(true);
    expect(await repository.isGrantActive(later, patient.userId, NOW)).toBe(true);
  });

  it('isGrantActive: false when expiring exactly now, expired, revoked, absent or for another patient', async () => {
    const [patient, other] = [await signedInPatient(), await signedInPatient()];
    const [atNow, past, revoked, none, foreign] = [
      await seedProfessional(),
      await seedProfessional(),
      await seedProfessional(),
      await seedProfessional(),
      await seedProfessional(),
    ];
    await seedGrant(patient.userId, atNow, { expiresAt: NOW });
    await seedGrant(patient.userId, past, { expiresAt: msFrom(NOW, -1) });
    await seedGrant(patient.userId, revoked, { revokedAt: NOW });
    await seedGrant(other.userId, foreign);

    for (const professional of [atNow, past, revoked, none, foreign]) {
      expect(await repository.isGrantActive(professional, patient.userId, NOW)).toBe(false);
    }
  });

  it('findActiveGrant returns the open grant and null for a revoked or missing one', async () => {
    const patient = await signedInPatient();
    const [open, revoked] = [await seedProfessional(), await seedProfessional()];
    const grant = await seedGrant(patient.userId, open);
    await seedGrant(patient.userId, revoked, { revokedAt: NOW });

    expect(await repository.findActiveGrant(open, patient.userId, NOW)).toMatchObject({
      id: grant.id,
      patientId: patient.userId,
      healthProfessionalId: open,
      revokedAt: null,
    });
    expect(await repository.findActiveGrant(revoked, patient.userId, NOW)).toBeNull();
    expect(await repository.findActiveGrant(randomUUID(), patient.userId, NOW)).toBeNull();
  });

  it('is backed by a partial unique index: a second active grant for the pair is rejected by the database', async () => {
    const patient = await signedInPatient();
    const professional = await seedProfessional();
    await seedGrant(patient.userId, professional);

    await expect(seedGrant(patient.userId, professional)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
  });
});
