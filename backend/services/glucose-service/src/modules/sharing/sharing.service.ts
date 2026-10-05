import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  type AuditContext,
  type RecordAudit,
} from '@glucore/shared';

import type { IPatientRepository } from '../patient/patient.repository';
import { generateInviteCode, hashInviteCode } from './inviteCode';
import { toGrantDto, type GrantDto, type InviteDto, type RedeemDto } from './sharing.mapper';
import {
  READ_PERMISSION,
  ProfessionalProfileMissingError,
  type ISharingRepository,
  type RedeemOutcome,
} from './sharing.repository';

/** A code is valid for 24 hours from the moment it is generated (CON-01). */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * One text and one code for every way a code can be unusable (unknown, expired,
 * used, replaced): telling them apart would let a caller probe which codes exist
 * (CON-05).
 */
const INVALID_INVITE_MESSAGE = 'Código inválido ou expirado';

export type RedeemResult = RedeemDto & { status: 200 | 201 };

/**
 * Consent: a patient hands a professional read access through a one-time code.
 *
 * Audit entries carry the patient and the professional ids and nothing clinical;
 * the plain code, and its hash, never reach them (CON-10).
 */
export class SharingService {
  constructor(
    private readonly sharing: ISharingRepository,
    private readonly patients: IPatientRepository,
    private readonly recordAudit: RecordAudit,
    private readonly clock: () => Date = () => new Date(),
    private readonly newCode: () => string = generateInviteCode,
  ) {}

  /** The plain code leaves this method once, in the answer; only its hash is stored. */
  async createInvite(patientUserId: string, context: AuditContext): Promise<InviteDto> {
    const patientId = await this.patients.ensure(patientUserId);
    const now = this.clock();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
    const code = this.newCode();

    const created = await this.sharing.createInvite(patientId, hashInviteCode(code), expiresAt, now);

    if (created.invalidatedInviteId !== null) {
      await this.recordAudit({
        userId: patientUserId,
        entity: 'PatientInvite',
        action: 'INVALIDATE',
        entityId: created.invalidatedInviteId,
        metadata: { reason: 'REPLACED' },
        ...context,
      });
    }
    await this.recordAudit({
      userId: patientUserId,
      entity: 'PatientInvite',
      action: 'CREATE',
      entityId: created.inviteId,
      metadata: { expiresAt },
      ...context,
    });

    return { code, expiresAt: expiresAt.toISOString() };
  }

  async redeem(professionalId: string, rawCode: string, context: AuditContext): Promise<RedeemResult> {
    const outcome = await this.consumeInvite(professionalId, rawCode);
    if (!outcome.redeemed) throw new BadRequestError(INVALID_INVITE_MESSAGE, 'INVALID_INVITE');

    const ids = { patientId: outcome.patientId, professionalId };
    await this.recordAudit({
      userId: professionalId,
      entity: 'PatientInvite',
      action: 'REDEEM',
      entityId: outcome.inviteId,
      metadata: { ...ids, grantId: outcome.grantId },
      ...context,
    });
    if (outcome.grantCreated) {
      await this.recordAudit({
        userId: professionalId,
        entity: 'DashboardAccessGrant',
        action: 'CREATE',
        entityId: outcome.grantId,
        metadata: { ...ids, permissionLevel: READ_PERMISSION },
        ...context,
      });
    }

    return {
      status: outcome.grantCreated ? 201 : 200,
      patientId: outcome.patientId,
      grantId: outcome.grantId,
    };
  }

  async listGrants(patientUserId: string): Promise<GrantDto[]> {
    const rows = await this.sharing.listActiveGrants(patientUserId, this.clock());
    return rows.map(toGrantDto);
  }

  /** Only the patient revokes. A grant that is not theirs, or is already revoked, is a 404. */
  async revoke(patientUserId: string, grantId: string, context: AuditContext): Promise<void> {
    const revoked = await this.sharing.revokeGrant(patientUserId, grantId, this.clock());
    if (revoked === null) throw new NotFoundError('Grant not found');

    await this.recordAudit({
      userId: patientUserId,
      entity: 'DashboardAccessGrant',
      action: 'REVOKE',
      entityId: grantId,
      metadata: { patientId: patientUserId, professionalId: revoked.professionalId },
      ...context,
    });
  }

  private async consumeInvite(professionalId: string, rawCode: string): Promise<RedeemOutcome> {
    try {
      return await this.sharing.redeemInvite(hashInviteCode(rawCode), professionalId, this.clock());
    } catch (error) {
      if (error instanceof ProfessionalProfileMissingError) {
        throw new ForbiddenError('Professional profile missing', 'PROFESSIONAL_PROFILE_MISSING');
      }
      throw error;
    }
  }
}
