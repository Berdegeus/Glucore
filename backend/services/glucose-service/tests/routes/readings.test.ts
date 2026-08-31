import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, signedInPatient, truncateAll, type SignedInPatient } from '../helpers/db';

/**
 * Characterization tests for GET/POST/DELETE /readings.
 *
 * These pin the wire contract as it exists today so the layering refactor can be
 * judged: after each module is split into controller/service/repository these
 * assertions must still pass *unchanged*. If one has to be edited, the refactor
 * changed behaviour rather than structure.
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

describe('GET /readings', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/readings');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/readings').set('Authorization', 'Bearer nonsense');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  });

  it('returns an empty list for a patient with no readings', async () => {
    const res = await request(app).get('/readings').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('maps a stored row onto the app-facing shape', async () => {
    const recordedAt = new Date('2026-08-20T10:00:00.000Z');
    await prisma.glucoseReading.create({
      data: {
        patientId: user.userId,
        recordedAt,
        valueMgDl: 142,
        trend: 'rising',
        trendRate: 1.5,
        alarmCode: 3,
      },
    });

    const res = await request(app).get('/readings').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        value: 142,
        timestampMs: recordedAt.getTime(),
        trend: 'rising',
        rate: 1.5,
        alarmCode: 3,
      },
    ]);
  });

  it('orders newest first', async () => {
    await prisma.glucoseReading.createMany({
      data: [
        { patientId: user.userId, recordedAt: new Date('2026-08-20T10:00:00Z'), valueMgDl: 100 },
        { patientId: user.userId, recordedAt: new Date('2026-08-20T12:00:00Z'), valueMgDl: 120 },
        { patientId: user.userId, recordedAt: new Date('2026-08-20T11:00:00Z'), valueMgDl: 110 },
      ],
    });

    const res = await request(app).get('/readings').set(auth());
    expect(res.body.map((r: { value: number }) => r.value)).toEqual([120, 110, 100]);
  });

  it('caps the response at 288 rows', async () => {
    const base = Date.UTC(2026, 7, 1);
    await prisma.glucoseReading.createMany({
      data: Array.from({ length: 300 }, (_, i) => ({
        patientId: user.userId,
        recordedAt: new Date(base + i * 60_000),
        valueMgDl: 100 + (i % 50),
      })),
    });

    const res = await request(app).get('/readings').set(auth());
    expect(res.body).toHaveLength(288);
  });

  it('never returns another patient rows', async () => {
    const other = await signedInPatient();
    await prisma.glucoseReading.create({
      data: {
        patientId: other.userId,
        recordedAt: new Date('2026-08-20T10:00:00Z'),
        valueMgDl: 199,
      },
    });

    const res = await request(app).get('/readings').set(auth());
    expect(res.body).toEqual([]);
  });
});

describe('POST /readings', () => {
  it('rejects a body whose readings field is not an array', async () => {
    const res = await request(app).post('/readings').set(auth()).send({ readings: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'readings must be array' });
  });

  it('rejects a body with no readings field', async () => {
    const res = await request(app).post('/readings').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('stores a batch and answers 204 with no body', async () => {
    const res = await request(app)
      .post('/readings')
      .set(auth())
      .send({
        readings: [
          { value: 101, timestampMs: Date.UTC(2026, 7, 20, 10), trend: 'stable', rate: 0 },
          { value: 102, timestampMs: Date.UTC(2026, 7, 20, 11), trend: 'rising', rate: 2 },
        ],
      });

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(await prisma.glucoseReading.count({ where: { patientId: user.userId } })).toBe(2);
  });

  it('rounds a fractional value to an integer', async () => {
    await request(app)
      .post('/readings')
      .set(auth())
      .send({
        readings: [{ value: 99.6, timestampMs: Date.UTC(2026, 7, 20, 10), trend: 'stable', rate: 0 }],
      });

    const row = await prisma.glucoseReading.findFirstOrThrow({ where: { patientId: user.userId } });
    expect(row.valueMgDl).toBe(100);
  });

  it('is idempotent on [patientId, recordedAt] — a resend updates in place', async () => {
    const timestampMs = Date.UTC(2026, 7, 20, 10);
    const send = (value: number) =>
      request(app)
        .post('/readings')
        .set(auth())
        .send({ readings: [{ value, timestampMs, trend: 'stable', rate: 0 }] });

    await send(100);
    await send(155);

    const rows = await prisma.glucoseReading.findMany({ where: { patientId: user.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].valueMgDl).toBe(155);
  });

  it('keeps only the first 288 entries of a larger batch', async () => {
    const base = Date.UTC(2026, 7, 1);
    await request(app)
      .post('/readings')
      .set(auth())
      .send({
        readings: Array.from({ length: 300 }, (_, i) => ({
          value: 100,
          timestampMs: base + i * 60_000,
          trend: 'stable',
          rate: 0,
        })),
      });

    expect(await prisma.glucoseReading.count({ where: { patientId: user.userId } })).toBe(288);
  });

  it('accepts an empty batch', async () => {
    const res = await request(app).post('/readings').set(auth()).send({ readings: [] });
    expect(res.status).toBe(204);
  });
});

describe('DELETE /readings', () => {
  it('removes only the caller readings', async () => {
    const other = await signedInPatient();
    await prisma.glucoseReading.createMany({
      data: [
        { patientId: user.userId, recordedAt: new Date('2026-08-20T10:00:00Z'), valueMgDl: 100 },
        { patientId: other.userId, recordedAt: new Date('2026-08-20T10:00:00Z'), valueMgDl: 200 },
      ],
    });

    const res = await request(app).delete('/readings').set(auth());
    expect(res.status).toBe(204);
    expect(await prisma.glucoseReading.count({ where: { patientId: user.userId } })).toBe(0);
    expect(await prisma.glucoseReading.count({ where: { patientId: other.userId } })).toBe(1);
  });

  it('writes an audit entry naming the patient', async () => {
    await request(app).delete('/readings').set(auth());

    const entries = await prisma.auditLog.findMany({ where: { entity: 'GlucoseReading' } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      userId: user.userId,
      entity: 'GlucoseReading',
      action: 'DELETE',
      entityId: user.userId,
    });
  });

  it('succeeds when there is nothing to delete', async () => {
    const res = await request(app).delete('/readings').set(auth());
    expect(res.status).toBe(204);
  });
});
