import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll, type SignedInPatient } from '../helpers/db';

/**
 * Characterization tests for /settings/alerts.
 *
 * Note the seam this pins: registration already creates an AlertThresholdConfig
 * from the patient's target range, so the documented 80/180 fallback is only
 * reachable when that row is missing. Both paths are asserted, because the
 * refactor moves threshold ownership into a patient module.
 */

let app: Express;
let user: SignedInPatient;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  user = await signedInPatient();
});

afterAll(async () => {
  await disconnect();
});

const auth = () => ({ Authorization: `Bearer ${user.token}` });

describe('GET /settings/alerts', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/settings/alerts')).status).toBe(401);
  });

  it('returns the thresholds registration created from the target range', async () => {
    const res = await request(app).get('/settings/alerts').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lowThreshold: 80, highThreshold: 180 });
  });

  it('reflects a custom target range chosen at registration', async () => {
    const custom = await signedInPatient({ targetRangeMin: 70, targetRangeMax: 200 });
    const res = await request(app)
      .get('/settings/alerts')
      .set('Authorization', `Bearer ${custom.token}`);
    expect(res.body).toEqual({ lowThreshold: 70, highThreshold: 200 });
  });

  it('falls back to 80/180 when no config row exists', async () => {
    await prisma.alertThresholdConfig.deleteMany({ where: { patientId: user.userId } });
    const res = await request(app).get('/settings/alerts').set(auth());
    expect(res.body).toEqual({ lowThreshold: 80, highThreshold: 180 });
  });

  it('never leaks another patient thresholds', async () => {
    await signedInPatient({ targetRangeMin: 60, targetRangeMax: 240 });
    const res = await request(app).get('/settings/alerts').set(auth());
    expect(res.body).toEqual({ lowThreshold: 80, highThreshold: 180 });
  });
});

describe('PUT /settings/alerts', () => {
  it('updates an existing config and answers 204', async () => {
    const res = await request(app)
      .put('/settings/alerts')
      .set(auth())
      .send({ lowThreshold: 75, highThreshold: 190 });

    expect(res.status).toBe(204);
    const after = await request(app).get('/settings/alerts').set(auth());
    expect(after.body).toEqual({ lowThreshold: 75, highThreshold: 190 });
  });

  it('creates the config when the row is missing', async () => {
    await prisma.alertThresholdConfig.deleteMany({ where: { patientId: user.userId } });

    const res = await request(app)
      .put('/settings/alerts')
      .set(auth())
      .send({ lowThreshold: 65, highThreshold: 210 });

    expect(res.status).toBe(204);
    const row = await prisma.alertThresholdConfig.findUniqueOrThrow({
      where: { patientId: user.userId },
    });
    expect(row.lowGlucoseMgDl).toBe(65);
    expect(row.highGlucoseMgDl).toBe(210);
  });

  it('records an UPDATE audit entry', async () => {
    await request(app)
      .put('/settings/alerts')
      .set(auth())
      .send({ lowThreshold: 75, highThreshold: 190 });

    const entries = await prisma.auditLog.findMany({
      where: { entity: 'AlertThresholdConfig', action: 'UPDATE' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ userId: user.userId, entityId: user.userId });
  });

  it('does not affect another patient config', async () => {
    const other = await signedInPatient();

    await request(app)
      .put('/settings/alerts')
      .set(auth())
      .send({ lowThreshold: 75, highThreshold: 190 });

    const otherRow = await prisma.alertThresholdConfig.findUniqueOrThrow({
      where: { patientId: other.userId },
    });
    expect(otherRow.lowGlucoseMgDl).toBe(80);
  });

  it('currently accepts an inverted range — no validation on this route today', async () => {
    const res = await request(app)
      .put('/settings/alerts')
      .set(auth())
      .send({ lowThreshold: 200, highThreshold: 100 });

    expect(res.status).toBe(204);
    const after = await request(app).get('/settings/alerts').set(auth());
    expect(after.body).toEqual({ lowThreshold: 200, highThreshold: 100 });
  });
});
