import { AlertType } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, registerUser, truncateAll, type RegisteredUser } from '../helpers/db';

/**
 * Characterization tests for /alerts.
 *
 * The interesting part is the enum adapter between the app's alert names and the
 * database `AlertType`. It is deliberately asymmetric — three DB values collapse
 * onto `syncFailure` on the way out — so a round trip is lossy. That is current
 * behaviour, pinned here so the refactor cannot change it by accident.
 */

let app: Express;
let user: RegisteredUser;

beforeAll(() => {
  app = buildApp();
});

beforeEach(async () => {
  await truncateAll();
  user = await registerUser(app);
});

afterAll(async () => {
  await disconnect();
});

const auth = () => ({ Authorization: `Bearer ${user.token}` });

const postAlerts = (alerts: unknown) => request(app).post('/alerts').set(auth()).send({ alerts });

describe('GET /alerts', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/alerts')).status).toBe(401);
  });

  it('returns an empty list when there is nothing stored', async () => {
    const res = await request(app).get('/alerts').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('orders newest first and caps at 100', async () => {
    const base = Date.UTC(2026, 7, 1);
    await prisma.alertEvent.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        patientId: user.userId,
        alertType: AlertType.HYPO_RISK,
        triggeredAt: new Date(base + i * 60_000),
      })),
    });

    const res = await request(app).get('/alerts').set(auth());
    expect(res.body).toHaveLength(100);
    expect(res.body[0].timestampMs).toBeGreaterThan(res.body[99].timestampMs);
  });

  it('never returns another patient rows', async () => {
    const other = await registerUser(app);
    await prisma.alertEvent.create({
      data: { patientId: other.userId, alertType: AlertType.HYPO_RISK },
    });
    expect((await request(app).get('/alerts').set(auth())).body).toEqual([]);
  });
});

describe('alert type adapter', () => {
  it.each([
    ['glucoseLow', AlertType.HYPO_RISK],
    ['glucoseHigh', AlertType.HYPER_RISK],
    ['sensorReconnected', AlertType.SENSOR_RECONNECTED],
    ['syncFailure', AlertType.SYNC_FAILURE],
    ['HYPO_RISK', AlertType.HYPO_RISK],
    ['HYPER_RISK', AlertType.HYPER_RISK],
    ['SENSOR_RECONNECTED', AlertType.SENSOR_RECONNECTED],
    ['SYNC_FAILURE', AlertType.SYNC_FAILURE],
    ['FAST_DROP', AlertType.FAST_DROP],
    ['FAST_RISE', AlertType.FAST_RISE],
  ])('stores %s as %s', async (appType, dbType) => {
    await postAlerts([{ type: appType, timestampMs: Date.UTC(2026, 7, 20) }]);
    const rows = await prisma.alertEvent.findMany({ where: { patientId: user.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].alertType).toBe(dbType);
  });

  it('falls back to SYNC_FAILURE for an unrecognised name', async () => {
    await postAlerts([{ type: 'something-else', timestampMs: Date.UTC(2026, 7, 20) }]);
    const rows = await prisma.alertEvent.findMany({ where: { patientId: user.userId } });
    expect(rows[0].alertType).toBe(AlertType.SYNC_FAILURE);
  });

  it.each([
    [AlertType.HYPO_RISK, 'glucoseLow'],
    [AlertType.HYPER_RISK, 'glucoseHigh'],
    [AlertType.SENSOR_RECONNECTED, 'sensorReconnected'],
    [AlertType.SYNC_FAILURE, 'syncFailure'],
    // Lossy on the way out: neither has an app-side name of its own.
    [AlertType.FAST_DROP, 'syncFailure'],
    [AlertType.FAST_RISE, 'syncFailure'],
  ])('reads %s back as %s', async (dbType, appType) => {
    await prisma.alertEvent.create({ data: { patientId: user.userId, alertType: dbType } });
    const res = await request(app).get('/alerts').set(auth());
    expect(res.body[0].type).toBe(appType);
  });

  it('does not round-trip FAST_DROP — it comes back as SYNC_FAILURE', async () => {
    await postAlerts([{ type: 'FAST_DROP', timestampMs: Date.UTC(2026, 7, 20) }]);
    const res = await request(app).get('/alerts').set(auth());
    expect(res.body[0].type).toBe('syncFailure');

    await postAlerts(res.body);
    const rows = await prisma.alertEvent.findMany({ where: { patientId: user.userId } });
    expect(rows[0].alertType).toBe(AlertType.SYNC_FAILURE);
  });
});

describe('POST /alerts (replace-all)', () => {
  it('rejects a body whose alerts field is not an array', async () => {
    const res = await postAlerts('nope');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'alerts must be array' });
  });

  it('replaces the whole collection', async () => {
    await prisma.alertEvent.create({
      data: { patientId: user.userId, alertType: AlertType.HYPER_RISK },
    });

    const res = await postAlerts([{ type: 'glucoseLow', timestampMs: Date.UTC(2026, 7, 21) }]);
    expect(res.status).toBe(204);

    const rows = await prisma.alertEvent.findMany({ where: { patientId: user.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].alertType).toBe(AlertType.HYPO_RISK);
  });

  it('keeps only the first 100 entries', async () => {
    await postAlerts(
      Array.from({ length: 130 }, (_, i) => ({
        type: 'glucoseLow',
        timestampMs: Date.UTC(2026, 7, 1) + i * 60_000,
      })),
    );
    expect(await prisma.alertEvent.count({ where: { patientId: user.userId } })).toBe(100);
  });

  it('does not touch another patient rows', async () => {
    const other = await registerUser(app);
    await prisma.alertEvent.create({
      data: { patientId: other.userId, alertType: AlertType.HYPO_RISK },
    });

    await postAlerts([]);

    expect(await prisma.alertEvent.count({ where: { patientId: other.userId } })).toBe(1);
  });

  it('records a REPLACE audit entry', async () => {
    await postAlerts([]);
    const entries = await prisma.auditLog.findMany({
      where: { entity: 'AlertEvent', action: 'REPLACE' },
    });
    expect(entries).toHaveLength(1);
  });
});
