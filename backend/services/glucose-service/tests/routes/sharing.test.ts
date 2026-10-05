import { randomUUID } from 'node:crypto';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { createContainer } from '../../src/container';
import { hashInviteCode } from '../../src/modules/sharing/inviteCode';
import {
  administratorToken,
  disconnect,
  prisma,
  signedInPatient,
  signedInProfessional,
  truncateAll,
  type SignedInPatient,
  type SignedInProfessional,
} from '../helpers/db';

/**
 * /sharing end to end: CON-01 (generate), CON-04 / CON-07 (redeem), CON-05 (one
 * answer for an unusable code), CON-08 (list and revoke), CON-09 (a revoked
 * grant is no grant), CON-10 (audit) and ACC-06 (roles).
 */

let app: Express;
let patient: SignedInPatient;
let professional: SignedInProfessional;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  patient = await signedInPatient();
  professional = await signedInProfessional({ specialty: 'Endocrinologia' });
});

afterAll(async () => {
  await disconnect();
});

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const generate = (token = patient.token) => request(app).post('/sharing/invites').set(bearer(token));
const redeem = (code: unknown, token = professional.token) =>
  request(app).post('/sharing/redeem').set(bearer(token)).send({ code });
const listGrants = (token = patient.token) => request(app).get('/sharing/grants').set(bearer(token));
const revoke = (id: string, token = patient.token) =>
  request(app).delete(`/sharing/grants/${id}`).set(bearer(token));

async function newCode(token = patient.token): Promise<string> {
  const res = await generate(token);
  expect(res.status).toBe(201);
  return res.body.code as string;
}

const INVALID_INVITE = { error: 'Código inválido ou expirado', code: 'INVALID_INVITE' };

describe('POST /sharing/invites', () => {
  it('answers 201 with an 8-character code and an expiry 24 hours ahead (CON-01, CON-02)', async () => {
    const before = Date.now();

    const res = await generate();

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    const lifetime = Date.parse(res.body.expiresAt) - before;
    expect(lifetime).toBeGreaterThanOrEqual(24 * 3_600_000);
    expect(lifetime).toBeLessThan(24 * 3_600_000 + 10_000);
  });

  it('stores only the hash of the code', async () => {
    const code = await newCode();

    const rows = await prisma.patientInvite.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).toBe(hashInviteCode(code));
    expect(JSON.stringify(rows)).not.toContain(code);
  });

  it('creates the patient row for an account that has none yet', async () => {
    await prisma.patient.delete({ where: { userId: patient.userId } });

    expect((await generate()).status).toBe(201);
    expect(await prisma.patient.count({ where: { userId: patient.userId } })).toBe(1);
  });

  it('invalidates the previous code: redeeming it is INVALID_INVITE, the new one works (CON-03)', async () => {
    const first = await newCode();
    const second = await newCode();

    const stale = await redeem(first);
    expect(stale.status).toBe(400);
    expect(stale.body).toEqual(INVALID_INVITE);

    expect((await redeem(second)).status).toBe(201);
    expect(await prisma.patientInvite.count({ where: { usedAt: null, revokedAt: null } })).toBe(0);
  });
});

describe('POST /sharing/redeem', () => {
  it('links the professional with a READ grant and answers 201 with the patient (CON-04)', async () => {
    const code = await newCode();

    const res = await redeem(code);

    expect(res.status).toBe(201);
    const grant = await prisma.dashboardAccessGrant.findFirstOrThrow();
    expect(res.body).toEqual({ patientId: patient.userId, grantId: grant.id });
    expect(grant).toMatchObject({
      patientId: patient.userId,
      healthProfessionalId: professional.userId,
      permissionLevel: 'READ',
      revokedAt: null,
    });
  });

  it('accepts the code as typed: lowercase, with a space or hyphen', async () => {
    const code = await newCode();
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();

    expect((await redeem(`  ${typed} `)).status).toBe(201);
  });

  it('answers 200 with the existing grant when the professional redeems a second code (CON-07)', async () => {
    const first = await redeem(await newCode());
    const second = await redeem(await newCode());

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(await prisma.dashboardAccessGrant.count()).toBe(1);
  });

  it('refuses a used code with the same 400 as an unknown one (CON-05)', async () => {
    const code = await newCode();
    await redeem(code);
    const other = await signedInProfessional();

    const used = await redeem(code, other.token);
    const unknown = await redeem('ZZZZ2222');

    expect(used.status).toBe(400);
    expect(used.body).toEqual(INVALID_INVITE);
    expect(unknown.status).toBe(400);
    expect(unknown.body).toEqual(used.body);
    expect(await prisma.dashboardAccessGrant.count()).toBe(1);
  });

  it('refuses an expired code with the same 400 body', async () => {
    const code = await newCode();
    await prisma.patientInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });

    const res = await redeem(code);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(INVALID_INVITE);
    expect(await prisma.dashboardAccessGrant.count()).toBe(0);
  });

  it('refuses a body with no string code as a plain bad request', async () => {
    const missing = await request(app).post('/sharing/redeem').set(bearer(professional.token)).send({});
    const numeric = await redeem(12345678);

    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: 'Invalid input' });
    expect(numeric.status).toBe(400);
    expect(numeric.body).toEqual({ error: 'Invalid input' });
  });

  it('answers 403 PROFESSIONAL_PROFILE_MISSING and keeps the code usable when the saga never created the profile', async () => {
    const code = await newCode();
    const orphan = await signedInProfessional({ withProfile: false });

    const res = await redeem(code, orphan.token);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Professional profile missing', code: 'PROFESSIONAL_PROFILE_MISSING' });
    expect((await redeem(code)).status).toBe(201);
  });
});

describe('GET /sharing/grants and DELETE /sharing/grants/:id', () => {
  it('runs the whole flow: generate, redeem, list, revoke, and the grant stops counting (CON-08, CON-09)', async () => {
    const policy = createContainer().grantPolicy;
    const redeemed = await redeem(await newCode());

    const listed = await listGrants();
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({
      grants: [
        {
          id: redeemed.body.grantId,
          professionalId: professional.userId,
          specialty: 'Endocrinologia',
          grantedAt: expect.any(String),
        },
      ],
    });
    await expect(policy.assertActive(professional.userId, patient.userId)).resolves.toBeUndefined();

    const revoked = await revoke(redeemed.body.grantId);
    expect(revoked.status).toBe(204);
    expect(revoked.text).toBe('');

    expect((await listGrants()).body).toEqual({ grants: [] });
    await expect(policy.assertActive(professional.userId, patient.userId)).rejects.toMatchObject({
      status: 403,
      code: 'NO_ACTIVE_GRANT',
    });
  });

  it('lists nothing for a patient with no professional', async () => {
    const res = await listGrants();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ grants: [] });
  });

  it('lists only the grants of the calling patient', async () => {
    const other = await signedInPatient();
    await redeem(await newCode(other.token));

    expect((await listGrants()).body).toEqual({ grants: [] });
  });

  it('answers 404 when revoking another patient grant, and leaves it active', async () => {
    const other = await signedInPatient();
    const redeemed = await redeem(await newCode(other.token));

    const res = await revoke(redeemed.body.grantId);

    expect(res.status).toBe(404);
    expect(await createContainer().grantPolicy.assertActive(professional.userId, other.userId)).toBeUndefined();
  });

  it('answers 404 for an unknown grant and for one already revoked', async () => {
    const redeemed = await redeem(await newCode());
    await revoke(redeemed.body.grantId);

    expect((await revoke(redeemed.body.grantId)).status).toBe(404);
    expect((await revoke(randomUUID())).status).toBe(404);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const res = await revoke('not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'id must be a UUID' });
  });

  it('lets the professional redeem again after the patient revoked, with a new grant', async () => {
    const first = await redeem(await newCode());
    await revoke(first.body.grantId);

    const again = await redeem(await newCode());

    expect(again.status).toBe(201);
    expect(again.body.grantId).not.toBe(first.body.grantId);
  });
});

describe('roles and tokens', () => {
  const routes: Array<{ name: string; patientOnly: boolean; call: (token?: string) => request.Test }> = [
    { name: 'POST /sharing/invites', patientOnly: true, call: (t) => generate(t) },
    { name: 'GET /sharing/grants', patientOnly: true, call: (t) => listGrants(t) },
    { name: 'DELETE /sharing/grants/:id', patientOnly: true, call: (t) => revoke(randomUUID(), t) },
    { name: 'POST /sharing/redeem', patientOnly: false, call: (t) => redeem('ABCD2345', t) },
  ];

  it.each(routes.map((route) => [route.name, route] as const))(
    '%s answers 403 FORBIDDEN_ROLE to a token of another role (ACC-06)',
    async (_name, route) => {
      const wrong = route.patientOnly
        ? [professional.token, administratorToken()]
        : [patient.token, administratorToken()];

      for (const token of wrong) {
        const res = await route.call(token);
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
      }
    },
  );

  it.each(routes.map((route) => [route.name, route] as const))(
    '%s answers 401 TOKEN_INVALID without a token',
    async (_name, route) => {
      const res = await route.call('').unset('Authorization');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    },
  );

  it('answers 401 TOKEN_INVALID to a token that does not verify', async () => {
    const res = await generate('not.a.token');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });
});

describe('audit trail (CON-10)', () => {
  it('records generate, invalidate, redeem, grant and revoke with both ids and never the code', async () => {
    const first = await newCode();
    const second = await newCode();
    const redeemed = await redeem(second);
    await revoke(redeemed.body.grantId);

    // Entries of one request can share a millisecond, so compare as a set.
    const rows = await prisma.auditLog.findMany();
    const seen = rows.map((row) => `${row.entity}/${row.action}`).sort();
    expect(seen).toEqual(
      [
        'PatientInvite/CREATE',
        'PatientInvite/CREATE',
        'PatientInvite/INVALIDATE',
        'PatientInvite/REDEEM',
        'DashboardAccessGrant/CREATE',
        'DashboardAccessGrant/REVOKE',
      ].sort(),
    );

    const redeemEntry = rows.find((row) => row.action === 'REDEEM');
    expect(redeemEntry).toMatchObject({
      userId: professional.userId,
      metadata: { patientId: patient.userId, professionalId: professional.userId },
    });
    const revokeEntry = rows.find((row) => row.action === 'REVOKE');
    expect(revokeEntry).toMatchObject({
      userId: patient.userId,
      entityId: redeemed.body.grantId,
      metadata: { patientId: patient.userId, professionalId: professional.userId },
    });

    const text = JSON.stringify(rows);
    for (const code of [first, second]) {
      expect(text).not.toContain(code);
      expect(text).not.toContain(hashInviteCode(code));
    }
  });
});
