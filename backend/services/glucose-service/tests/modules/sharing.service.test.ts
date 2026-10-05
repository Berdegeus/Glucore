import { BadRequestError, ForbiddenError, NotFoundError, type AuditContext } from '@glucore/shared';
import { describe, expect, it } from 'vitest';

import { hashInviteCode } from '../../src/modules/sharing/inviteCode';
import { ProfessionalProfileMissingError } from '../../src/modules/sharing/sharing.repository';
import { INVITE_TTL_MS, SharingService } from '../../src/modules/sharing/sharing.service';
import {
  FakePatientRepository,
  FakeSharingRepository,
  RecordedAudit,
  nextId,
} from '../helpers/fakes';

/**
 * Service-level rules of consent: CON-01 (24 h), CON-04 / CON-07 (201 vs 200),
 * CON-05 (one answer for every unusable code), CON-10 (audit without the code).
 */

const NOW = new Date('2026-10-05T12:00:00.000Z');
const CONTEXT: AuditContext = { ipAddress: '203.0.113.7', userAgent: 'vitest' };
const CODE = 'ABCD2345';

const PATIENT = nextId();
const PROFESSIONAL = nextId();

function build() {
  const sharing = new FakeSharingRepository();
  const patients = new FakePatientRepository();
  const audit = new RecordedAudit();
  const service = new SharingService(sharing, patients, audit.record, () => NOW, () => CODE);
  return { sharing, patients, audit, service };
}

/** Both the plain code and its hash must stay out of everything the audit stored. */
function expectNoCodeIn(entries: unknown): void {
  const text = JSON.stringify(entries);
  expect(text).not.toContain(CODE);
  expect(text).not.toContain(hashInviteCode(CODE));
}

describe('createInvite', () => {
  it('answers the generated code with an expiry exactly 24 hours ahead (CON-01)', async () => {
    const { service } = build();

    const invite = await service.createInvite(PATIENT, CONTEXT);

    expect(INVITE_TTL_MS).toBe(86_400_000);
    expect(invite).toEqual({ code: CODE, expiresAt: '2026-10-06T12:00:00.000Z' });
  });

  it('stores the hash of the code, never the code, and makes sure the patient row exists', async () => {
    const { service, sharing, patients } = build();

    await service.createInvite(PATIENT, CONTEXT);

    expect(patients.ensured).toEqual([PATIENT]);
    expect(sharing.createCalls).toEqual([
      {
        patientId: PATIENT,
        codeHash: hashInviteCode(CODE),
        expiresAt: new Date('2026-10-06T12:00:00.000Z'),
        now: NOW,
      },
    ]);
    expect(JSON.stringify(sharing.createCalls)).not.toContain(CODE);
  });

  it('audits the creation with the expiry and without the code (CON-10)', async () => {
    const { service, sharing, audit } = build();

    await service.createInvite(PATIENT, CONTEXT);

    expect(audit.entries).toEqual([
      {
        userId: PATIENT,
        entity: 'PatientInvite',
        action: 'CREATE',
        entityId: sharing.created.inviteId,
        metadata: { expiresAt: new Date('2026-10-06T12:00:00.000Z') },
        ...CONTEXT,
      },
    ]);
    expectNoCodeIn(audit.entries);
  });

  it('audits the invalidation of the previous pending invite before the creation (CON-03, CON-10)', async () => {
    const { service, sharing, audit } = build();
    sharing.created = { inviteId: nextId(), invalidatedInviteId: nextId() };

    await service.createInvite(PATIENT, CONTEXT);

    expect(audit.entries.map((entry) => [entry.entity, entry.action, entry.entityId])).toEqual([
      ['PatientInvite', 'INVALIDATE', sharing.created.invalidatedInviteId],
      ['PatientInvite', 'CREATE', sharing.created.inviteId],
    ]);
    expect(audit.entries.every((entry) => entry.userId === PATIENT)).toBe(true);
    expectNoCodeIn(audit.entries);
  });
});

describe('redeem', () => {
  const redeemed = (grantCreated: boolean) => ({
    redeemed: true as const,
    inviteId: nextId(),
    patientId: PATIENT,
    grantId: nextId(),
    grantCreated,
  });

  it('answers 201 with the patient and the new grant (CON-04)', async () => {
    const { service, sharing } = build();
    const outcome = redeemed(true);
    sharing.redeemOutcome = outcome;

    const result = await service.redeem(PROFESSIONAL, CODE, CONTEXT);

    expect(result).toEqual({ status: 201, patientId: PATIENT, grantId: outcome.grantId });
  });

  it('answers 200 with the existing grant when the professional already follows the patient (CON-07)', async () => {
    const { service, sharing } = build();
    const outcome = redeemed(false);
    sharing.redeemOutcome = outcome;

    const result = await service.redeem(PROFESSIONAL, CODE, CONTEXT);

    expect(result).toEqual({ status: 200, patientId: PATIENT, grantId: outcome.grantId });
  });

  it('looks the code up by the hash of its normalized form, whatever the person typed', async () => {
    const { service, sharing } = build();
    sharing.redeemOutcome = redeemed(true);

    await service.redeem(PROFESSIONAL, ' abcd-2345 ', CONTEXT);

    expect(sharing.redeemCalls).toEqual([
      { codeHash: hashInviteCode(CODE), professionalId: PROFESSIONAL, now: NOW },
    ]);
  });

  // The repository reports unknown, expired, used and invalidated codes as the
  // same `{ redeemed: false }` (asserted per cause against Postgres), so the
  // service has one failure to answer, and it carries no hint of which it was.
  it('refuses an unusable code with INVALID_INVITE and the single message, auditing nothing (CON-05)', async () => {
    const { service, sharing, audit } = build();
    sharing.redeemOutcome = { redeemed: false };

    const failure = await service.redeem(PROFESSIONAL, CODE, CONTEXT).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BadRequestError);
    expect(failure).toMatchObject({
      status: 400,
      code: 'INVALID_INVITE',
      message: 'Código inválido ou expirado',
    });
    expect(audit.entries).toEqual([]);
  });

  it('audits the redeem and the grant creation with both ids and no code (CON-10)', async () => {
    const { service, sharing, audit } = build();
    const outcome = redeemed(true);
    sharing.redeemOutcome = outcome;

    await service.redeem(PROFESSIONAL, CODE, CONTEXT);

    expect(audit.entries).toEqual([
      {
        userId: PROFESSIONAL,
        entity: 'PatientInvite',
        action: 'REDEEM',
        entityId: outcome.inviteId,
        metadata: { patientId: PATIENT, professionalId: PROFESSIONAL, grantId: outcome.grantId },
        ...CONTEXT,
      },
      {
        userId: PROFESSIONAL,
        entity: 'DashboardAccessGrant',
        action: 'CREATE',
        entityId: outcome.grantId,
        metadata: { patientId: PATIENT, professionalId: PROFESSIONAL, permissionLevel: 'READ' },
        ...CONTEXT,
      },
    ]);
    expectNoCodeIn(audit.entries);
  });

  it('audits only the redeem, not a grant creation, when the existing grant is reused', async () => {
    const { service, sharing, audit } = build();
    sharing.redeemOutcome = redeemed(false);

    await service.redeem(PROFESSIONAL, CODE, CONTEXT);

    expect(audit.entries.map((entry) => `${entry.entity}/${entry.action}`)).toEqual(['PatientInvite/REDEEM']);
  });

  it('turns a missing professional profile into 403 PROFESSIONAL_PROFILE_MISSING', async () => {
    const { service, sharing, audit } = build();
    sharing.redeemError = new ProfessionalProfileMissingError();

    const failure = await service.redeem(PROFESSIONAL, CODE, CONTEXT).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ForbiddenError);
    expect(failure).toMatchObject({ status: 403, code: 'PROFESSIONAL_PROFILE_MISSING' });
    expect(audit.entries).toEqual([]);
  });

  it('lets an unexpected storage failure through untouched', async () => {
    const { service, sharing } = build();
    sharing.redeemError = new Error('connection lost');

    await expect(service.redeem(PROFESSIONAL, CODE, CONTEXT)).rejects.toThrow('connection lost');
  });
});

describe('listGrants', () => {
  it('maps the patient active grants for the response, as of the clock', async () => {
    const { service, sharing } = build();
    const id = nextId();
    sharing.listed = [{ id, professionalId: PROFESSIONAL, specialty: 'Endocrinologia', grantedAt: NOW }];

    const grants = await service.listGrants(PATIENT);

    expect(grants).toEqual([
      { id, professionalId: PROFESSIONAL, specialty: 'Endocrinologia', grantedAt: '2026-10-05T12:00:00.000Z' },
    ]);
    expect(sharing.listCalls).toEqual([{ patientId: PATIENT, now: NOW }]);
  });

  it('answers an empty list when nobody is linked', async () => {
    const { service } = build();

    expect(await service.listGrants(PATIENT)).toEqual([]);
  });
});

describe('revoke', () => {
  it('revokes the patient grant as of the clock and audits it with both ids (CON-10)', async () => {
    const { service, sharing, audit } = build();
    const grantId = nextId();
    sharing.revoked = { professionalId: PROFESSIONAL };

    await service.revoke(PATIENT, grantId, CONTEXT);

    expect(sharing.revokeCalls).toEqual([{ patientId: PATIENT, grantId, now: NOW }]);
    expect(audit.entries).toEqual([
      {
        userId: PATIENT,
        entity: 'DashboardAccessGrant',
        action: 'REVOKE',
        entityId: grantId,
        metadata: { patientId: PATIENT, professionalId: PROFESSIONAL },
        ...CONTEXT,
      },
    ]);
  });

  it('answers 404 and audits nothing when the grant is not the patient or is already revoked', async () => {
    const { service, sharing, audit } = build();
    sharing.revoked = null;

    const failure = await service.revoke(PATIENT, nextId(), CONTEXT).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(NotFoundError);
    expect(failure).toMatchObject({ status: 404 });
    expect(audit.entries).toEqual([]);
  });
});
