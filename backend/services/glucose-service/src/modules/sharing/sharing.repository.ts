import { Prisma, type PrismaClient } from '@prisma/client';

/** Every grant the v1 writes is read-only; the column exists so a later level needs no migration. */
export const READ_PERMISSION = 'READ';

export interface GrantSource {
  id: string;
  patientId: string;
  healthProfessionalId: string;
  grantedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface ActiveGrantListItem {
  id: string;
  professionalId: string;
  specialty: string;
  grantedAt: Date;
}

export interface CreatedInvite {
  inviteId: string;
  /** The pending invite this one replaced, so the service can audit the invalidation (CON-10). */
  invalidatedInviteId: string | null;
}

export type RedeemOutcome =
  | { redeemed: false }
  | { redeemed: true; inviteId: string; patientId: string; grantId: string; grantCreated: boolean };

/**
 * Thrown when the redeemer has no `HealthProfessional` row: the grant's foreign
 * key could not be satisfied. Raised before the invite is consumed, so the code
 * stays redeemable once the profile exists.
 */
export class ProfessionalProfileMissingError extends Error {
  constructor() {
    super('Professional profile missing');
    this.name = 'ProfessionalProfileMissingError';
  }
}

/**
 * Invite and grant storage.
 *
 * Active grant = `revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt > now)`.
 * Every method that depends on the moment takes it as a parameter, so the
 * service owns the clock and the tests can pin it.
 */
export interface ISharingRepository {
  /**
   * Stores the hash as the patient's only pending invite, revoking the previous
   * pending one in the same transaction (CON-03).
   */
  createInvite(
    patientId: string,
    codeHash: string,
    expiresAt: Date,
    now?: Date,
  ): Promise<CreatedInvite>;
  /**
   * Consumes the invite and creates the grant, or reuses the professional's
   * active one for that patient (CON-04, CON-07). Atomic: of two concurrent
   * redeems of one code exactly one gets `redeemed: true`. An unknown, expired,
   * used or revoked code is `redeemed: false`, with no way to tell which.
   * Throws `ProfessionalProfileMissingError` without consuming the code.
   */
  redeemInvite(codeHash: string, professionalId: string, now: Date): Promise<RedeemOutcome>;
  findActiveGrant(
    professionalId: string,
    patientId: string,
    now: Date,
  ): Promise<GrantSource | null>;
  listActiveGrants(patientId: string, now: Date): Promise<ActiveGrantListItem[]>;
  /** Only the owning patient's grant changes. Returns the professional it cut off, or `null` when nothing changed. */
  revokeGrant(
    patientId: string,
    grantId: string,
    now: Date,
  ): Promise<{ professionalId: string } | null>;
  isGrantActive(professionalId: string, patientId: string, now: Date): Promise<boolean>;
}

/** The partial unique index on pending invites rejected a concurrent insert. */
const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const activeWhere = (now: Date): Prisma.DashboardAccessGrantWhereInput => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

export class PrismaSharingRepository implements ISharingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createInvite(
    patientId: string,
    codeHash: string,
    expiresAt: Date,
    now: Date = new Date(),
  ): Promise<CreatedInvite> {
    try {
      return await this.insertInvite(patientId, codeHash, expiresAt, now);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Two generates raced: both saw no pending invite, and the loser hit the
      // partial unique index. A second pass sees the winner and revokes it, so
      // the last writer holds the single pending code.
      return this.insertInvite(patientId, codeHash, expiresAt, now);
    }
  }

  private insertInvite(
    patientId: string,
    codeHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<CreatedInvite> {
    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.patientInvite.findFirst({
        where: { patientId, usedAt: null, revokedAt: null },
        select: { id: true },
      });
      let invalidatedInviteId: string | null = null;
      if (pending) {
        const revoked = await tx.patientInvite.updateMany({
          where: { id: pending.id, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        if (revoked.count === 1) invalidatedInviteId = pending.id;
      }
      const created = await tx.patientInvite.create({
        data: { patientId, codeHash, expiresAt },
        select: { id: true },
      });
      return { inviteId: created.id, invalidatedInviteId };
    });
  }

  redeemInvite(codeHash: string, professionalId: string, now: Date): Promise<RedeemOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const professional = await tx.healthProfessional.findUnique({
        where: { userId: professionalId },
        select: { userId: true },
      });
      if (!professional) throw new ProfessionalProfileMissingError();

      const invite = await tx.patientInvite.findUnique({
        where: { codeHash },
        select: { id: true, patientId: true },
      });
      if (!invite) return { redeemed: false };

      // One conditional UPDATE decides the winner: a concurrent redeem blocks on
      // the row lock, then re-checks `usedAt IS NULL` and matches nothing.
      const claimed = await tx.patientInvite.updateMany({
        where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now, usedBy: professionalId },
      });
      if (claimed.count === 0) return { redeemed: false };

      const existing = await tx.dashboardAccessGrant.findFirst({
        where: { patientId: invite.patientId, healthProfessionalId: professionalId, revokedAt: null },
        select: { id: true, expiresAt: true },
      });
      if (existing && (existing.expiresAt === null || existing.expiresAt > now)) {
        return {
          redeemed: true,
          inviteId: invite.id,
          patientId: invite.patientId,
          grantId: existing.id,
          grantCreated: false,
        };
      }
      // An expired grant still occupies the one-active-per-pair index; close it
      // so the fresh one can take its place.
      if (existing) {
        await tx.dashboardAccessGrant.update({ where: { id: existing.id }, data: { revokedAt: now } });
      }

      const grant = await tx.dashboardAccessGrant.create({
        data: {
          patientId: invite.patientId,
          healthProfessionalId: professionalId,
          permissionLevel: READ_PERMISSION,
          grantedAt: now,
        },
        select: { id: true },
      });
      return {
        redeemed: true,
        inviteId: invite.id,
        patientId: invite.patientId,
        grantId: grant.id,
        grantCreated: true,
      };
    });
  }

  findActiveGrant(
    professionalId: string,
    patientId: string,
    now: Date,
  ): Promise<GrantSource | null> {
    return this.prisma.dashboardAccessGrant.findFirst({
      where: { patientId, healthProfessionalId: professionalId, ...activeWhere(now) },
      select: {
        id: true,
        patientId: true,
        healthProfessionalId: true,
        grantedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  async listActiveGrants(patientId: string, now: Date): Promise<ActiveGrantListItem[]> {
    const rows = await this.prisma.dashboardAccessGrant.findMany({
      where: { patientId, ...activeWhere(now) },
      orderBy: [{ grantedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        healthProfessionalId: true,
        grantedAt: true,
        healthProfessional: { select: { specialty: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      professionalId: row.healthProfessionalId,
      specialty: row.healthProfessional.specialty,
      grantedAt: row.grantedAt,
    }));
  }

  async revokeGrant(
    patientId: string,
    grantId: string,
    now: Date,
  ): Promise<{ professionalId: string } | null> {
    const grant = await this.prisma.dashboardAccessGrant.findFirst({
      where: { id: grantId, patientId, revokedAt: null },
      select: { healthProfessionalId: true },
    });
    if (!grant) return null;
    const revoked = await this.prisma.dashboardAccessGrant.updateMany({
      where: { id: grantId, patientId, revokedAt: null },
      data: { revokedAt: now },
    });
    return revoked.count === 1 ? { professionalId: grant.healthProfessionalId } : null;
  }

  async isGrantActive(professionalId: string, patientId: string, now: Date): Promise<boolean> {
    const count = await this.prisma.dashboardAccessGrant.count({
      where: { patientId, healthProfessionalId: professionalId, ...activeWhere(now) },
    });
    return count > 0;
  }
}
