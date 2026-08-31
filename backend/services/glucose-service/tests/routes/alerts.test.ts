import { AlertType } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll, type SignedInPatient } from '../helpers/db';

/**
 * Characterization tests for /alerts.
 *
 * The interesting part is the enum adapter between the app's alert names and the
 * database `AlertType`. It is deliberately asymmetric — three DB values collapse
 * onto `syncFailure` on the way out — so a round trip is lossy. That is current
 * behaviour, pinned here so the refactor cannot change it by accident.
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

  it('includes the row id', async () => {
    const row = await prisma.alertEvent.create({
      data: { patientId: user.userId, alertType: AlertType.HYPO_RISK },
    });
    const res = await request(app).get('/alerts').set(auth());
    expect(res.body).toEqual([
      { id: row.id, type: 'glucoseLow', timestampMs: row.triggeredAt.getTime() },
    ]);
  });

  it('never returns another patient rows', async () => {
    const other = await signedInPatient();
    await prisma.alertEvent.create({
      data: { patientId: other.userId, alertType: AlertType.HYPO_RISK },
    });
    expect((await request(app).get('/alerts').set(auth())).body).toEqual([]);
  });
});

describe('GET /alerts pagination', () => {
  it('walks the whole history page by page without repeating or skipping', async () => {
    const total = 250;
    const base = Date.UTC(2026, 7, 1);
    await prisma.alertEvent.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        patientId: user.userId,
        alertType: AlertType.HYPO_RISK,
        triggeredAt: new Date(base + i * 60_000),
      })),
    });

    const collected: string[] = [];
    let before: number | undefined;
    for (let page = 0; page < 10 && collected.length < total; page++) {
      const query = before === undefined ? { limit: 40 } : { before, limit: 40 };
      const res = await request(app).get('/alerts').query(query).set(auth());
      expect(res.status).toBe(200);
      if (res.body.length === 0) break;
      for (const entry of res.body) collected.push(entry.id);
      before = res.body[res.body.length - 1].timestampMs;
    }

    expect(collected).toHaveLength(total);
    expect(new Set(collected).size).toBe(total);
  });

  it('rejects a limit above the maximum with INVALID_PAGINATION', async () => {
    const res = await request(app).get('/alerts').query({ limit: 501 }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAGINATION');
  });

  it('rejects a non-numeric before with INVALID_PAGINATION', async () => {
    const res = await request(app).get('/alerts').query({ before: 'yesterday' }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAGINATION');
  });
});

describe('POST /alerts/item', () => {
  const valid = { type: 'glucoseLow', timestampMs: Date.UTC(2026, 7, 20, 12) };
  const UUID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';

  it('creates an entry and answers 201 with the id', async () => {
    const res = await request(app).post('/alerts/item').set(auth()).send(valid);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await prisma.alertEvent.count({ where: { patientId: user.userId } })).toBe(1);
  });

  it('honours a client-supplied UUID', async () => {
    const res = await request(app)
      .post('/alerts/item')
      .set(auth())
      .send({ ...valid, id: UUID });
    expect(res.body).toEqual({ id: UUID });
  });

  it.each([
    ['type is not a string', { ...valid, type: 9 }, 'type must be a non-empty string'],
    ['type is empty', { ...valid, type: '   ' }, 'type must be a non-empty string'],
    [
      'timestampMs is not a number',
      { ...valid, timestampMs: 'x' },
      'timestampMs must be a number (epoch ms)',
    ],
  ])('rejects when %s', async (_label, body, error) => {
    const res = await request(app).post('/alerts/item').set(auth()).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(app)
      .post('/alerts/item')
      .set(auth())
      .send({ ...valid, id: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'id must be a UUID' });
  });

  it('records a CREATE audit entry', async () => {
    const res = await request(app).post('/alerts/item').set(auth()).send(valid);
    const entries = await prisma.auditLog.findMany({ where: { entity: 'AlertEvent', action: 'CREATE' } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      userId: user.userId,
      action: 'CREATE',
      entityId: res.body.id,
    });
  });
});

describe('PUT /alerts/item/:id', () => {
  const patch = { type: 'glucoseHigh', timestampMs: Date.UTC(2026, 7, 20, 20) };
  const UUID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';

  async function seedAlert(patientId: string) {
    return prisma.alertEvent.create({
      data: { patientId, alertType: AlertType.HYPO_RISK, triggeredAt: new Date('2026-08-20T12:00:00Z') },
    });
  }

  it('updates the caller own entry', async () => {
    const row = await seedAlert(user.userId);
    const res = await request(app).put(`/alerts/item/${row.id}`).set(auth()).send(patch);

    expect(res.status).toBe(204);
    const after = await prisma.alertEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.alertType).toBe(AlertType.HYPER_RISK);
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(app).put('/alerts/item/nope').set(auth()).send(patch);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'id must be a UUID' });
  });

  it('validates the body before touching the database', async () => {
    const row = await seedAlert(user.userId);
    const res = await request(app)
      .put(`/alerts/item/${row.id}`)
      .set(auth())
      .send({ ...patch, timestampMs: 'x' });
    expect(res.status).toBe(400);
  });

  it('answers 404 for an id that does not exist', async () => {
    const res = await request(app).put(`/alerts/item/${UUID}`).set(auth()).send(patch);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('answers 404 for another patient entry, and leaves it untouched', async () => {
    const other = await signedInPatient();
    const row = await seedAlert(other.userId);

    const res = await request(app).put(`/alerts/item/${row.id}`).set(auth()).send(patch);
    expect(res.status).toBe(404);

    const after = await prisma.alertEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.alertType).toBe(AlertType.HYPO_RISK);
  });
});

describe('DELETE /alerts/item/:id', () => {
  const UUID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';

  async function seedAlert(patientId: string) {
    return prisma.alertEvent.create({ data: { patientId, alertType: AlertType.HYPO_RISK } });
  }

  it('removes the caller own entry', async () => {
    const row = await seedAlert(user.userId);
    const res = await request(app).delete(`/alerts/item/${row.id}`).set(auth());
    expect(res.status).toBe(204);
    expect(await prisma.alertEvent.count({ where: { id: row.id } })).toBe(0);
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(app).delete('/alerts/item/nope').set(auth());
    expect(res.status).toBe(400);
  });

  it('answers 404 for an unknown id', async () => {
    const res = await request(app).delete(`/alerts/item/${UUID}`).set(auth());
    expect(res.status).toBe(404);
  });

  it('answers 404 for another patient entry, and leaves it in place', async () => {
    const other = await signedInPatient();
    const row = await seedAlert(other.userId);

    expect((await request(app).delete(`/alerts/item/${row.id}`).set(auth())).status).toBe(404);
    expect(await prisma.alertEvent.count({ where: { id: row.id } })).toBe(1);
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
    const other = await signedInPatient();
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

  it('preserves client-supplied ids and drops invalid ones', async () => {
    const validId = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';
    await postAlerts([
      { id: validId, type: 'glucoseLow', timestampMs: Date.UTC(2026, 7, 21) },
      { id: 'bogus', type: 'glucoseHigh', timestampMs: Date.UTC(2026, 7, 22) },
    ]);

    const rows = await prisma.alertEvent.findMany({ where: { patientId: user.userId } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toContain(validId);
  });
});
