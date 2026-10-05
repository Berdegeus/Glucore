import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { signInternalToken } from '@glucore/shared';

import { buildApp } from '../../src/app';
import {
  disconnect,
  prisma,
  signedInPatient,
  signedInProfessional,
  truncateAll,
  type SignedInPatient,
  type SignedInProfessional,
} from '../helpers/db';
import { TEST_INTERNAL_JWT_SECRET } from '../helpers/testEnv';

/**
 * CON-11: deleting an account takes the consent data that hangs off it along.
 * Driven through the gateway's own door, `DELETE /internal/{patients,professionals}/:id`,
 * against the real schema, so it proves the cascades and not just the intent.
 *
 * Fixture: patients A and B, professionals P1 and P2.
 *   A–P1, A–P2 and B–P1 are linked through the public routes (an invite
 *   redeemed each time), and A is left holding one more, still pending, invite.
 */

let app: Express;
let a: SignedInPatient;
let b: SignedInPatient;
let p1: SignedInProfessional;
let p2: SignedInProfessional;

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const gatewayToken = () => signInternalToken({ sub: 'gateway', role: 'ADMINISTRATOR' }, TEST_INTERNAL_JWT_SECRET);

/** Generates an invite as the patient and redeems it as the professional. */
async function link(patient: SignedInPatient, professional: SignedInProfessional): Promise<void> {
  const invite = await request(app).post('/sharing/invites').set(bearer(patient.token));
  expect(invite.status).toBe(201);
  const redeemed = await request(app)
    .post('/sharing/redeem')
    .set(bearer(professional.token))
    .send({ code: invite.body.code });
  expect(redeemed.status).toBe(201);
}

const grantsOf = async (userId: string, side: 'patientId' | 'healthProfessionalId') =>
  prisma.dashboardAccessGrant.count({ where: { [side]: userId } });
const invitesOf = (patientId: string) => prisma.patientInvite.count({ where: { patientId } });
const patientExists = async (userId: string) => (await prisma.patient.count({ where: { userId } })) === 1;
const professionalExists = async (userId: string) =>
  (await prisma.healthProfessional.count({ where: { userId } })) === 1;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  [a, b] = [await signedInPatient(), await signedInPatient()];
  [p1, p2] = [await signedInProfessional(), await signedInProfessional()];

  await link(a, p1);
  await link(a, p2);
  await link(b, p1);
  expect((await request(app).post('/sharing/invites').set(bearer(a.token))).status).toBe(201);
});

afterAll(async () => {
  await disconnect();
});

describe('DELETE /internal/patients/:id', () => {
  it('removes the patient\'s invites and grants, and nothing of the others (CON-11)', async () => {
    expect(await invitesOf(a.userId)).toBe(3);
    expect(await grantsOf(a.userId, 'patientId')).toBe(2);

    const res = await request(app).delete(`/internal/patients/${a.userId}`).set('x-internal-token', gatewayToken());

    expect(res.status).toBe(204);
    expect(await invitesOf(a.userId)).toBe(0);
    expect(await grantsOf(a.userId, 'patientId')).toBe(0);
    // Everyone else is untouched: B and its link, both professionals.
    expect(await patientExists(b.userId)).toBe(true);
    expect(await invitesOf(b.userId)).toBe(1);
    expect(await grantsOf(b.userId, 'patientId')).toBe(1);
    expect(await professionalExists(p1.userId)).toBe(true);
    expect(await professionalExists(p2.userId)).toBe(true);
    expect(await grantsOf(p1.userId, 'healthProfessionalId')).toBe(1);
    expect(await grantsOf(p2.userId, 'healthProfessionalId')).toBe(0);
  });
});

describe('DELETE /internal/professionals/:id', () => {
  it('removes only that professional\'s grants; patients, invites and other grants survive (CON-11)', async () => {
    expect(await grantsOf(p1.userId, 'healthProfessionalId')).toBe(2);

    const res = await request(app)
      .delete(`/internal/professionals/${p1.userId}`)
      .set('x-internal-token', gatewayToken());

    expect(res.status).toBe(204);
    expect(await professionalExists(p1.userId)).toBe(false);
    expect(await grantsOf(p1.userId, 'healthProfessionalId')).toBe(0);
    // A keeps the link with P2; B lost its only link; neither patient is gone.
    expect(await grantsOf(a.userId, 'patientId')).toBe(1);
    expect(await grantsOf(p2.userId, 'healthProfessionalId')).toBe(1);
    expect(await grantsOf(b.userId, 'patientId')).toBe(0);
    expect(await patientExists(a.userId)).toBe(true);
    expect(await patientExists(b.userId)).toBe(true);
    expect(await professionalExists(p2.userId)).toBe(true);
    expect(await invitesOf(a.userId)).toBe(3);
    expect(await invitesOf(b.userId)).toBe(1);
  });

  it('leaves the patient\'s grants list answering without the deleted professional', async () => {
    await request(app).delete(`/internal/professionals/${p1.userId}`).set('x-internal-token', gatewayToken());

    const res = await request(app).get('/sharing/grants').set(bearer(a.token));

    expect(res.status).toBe(200);
    expect(res.body.grants.map((g: { professionalId: string }) => g.professionalId)).toEqual([p2.userId]);
  });
});
