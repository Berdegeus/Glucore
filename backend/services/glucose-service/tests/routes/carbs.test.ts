import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, registerUser, truncateAll, type RegisteredUser } from '../helpers/db';

/**
 * Characterization tests for /carbs. See readings.test.ts for the intent: these
 * pin today's wire contract so the layering refactor can be checked against it.
 *
 * Covers both surfaces — the per-item CRUD and the deprecated replace-all POST —
 * because the refactor has to preserve behaviour before phase 9 removes the
 * latter.
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

const UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

async function seedCarb(patientId: string, overrides: Record<string, unknown> = {}) {
  return prisma.carbEvent.create({
    data: {
      patientId,
      carbsGrams: 45,
      description: 'almoço',
      eventAt: new Date('2026-08-20T12:00:00Z'),
      ...overrides,
    },
  });
}

describe('GET /carbs', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/carbs')).status).toBe(401);
  });

  it('returns an empty list when there is nothing stored', async () => {
    const res = await request(app).get('/carbs').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('maps a stored row onto the app-facing shape', async () => {
    const row = await seedCarb(user.userId);
    const res = await request(app).get('/carbs').set(auth());
    expect(res.body).toEqual([
      {
        id: row.id,
        grams: 45,
        description: 'almoço',
        timeMs: new Date('2026-08-20T12:00:00Z').getTime(),
      },
    ]);
  });

  it('orders newest first', async () => {
    await seedCarb(user.userId, { description: 'a', eventAt: new Date('2026-08-20T09:00:00Z') });
    await seedCarb(user.userId, { description: 'c', eventAt: new Date('2026-08-20T15:00:00Z') });
    await seedCarb(user.userId, { description: 'b', eventAt: new Date('2026-08-20T12:00:00Z') });

    const res = await request(app).get('/carbs').set(auth());
    expect(res.body.map((c: { description: string }) => c.description)).toEqual(['c', 'b', 'a']);
  });

  it('caps the response at 100 rows', async () => {
    const base = Date.UTC(2026, 7, 1);
    await prisma.carbEvent.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        patientId: user.userId,
        carbsGrams: 10,
        description: `m${i}`,
        eventAt: new Date(base + i * 60_000),
      })),
    });

    const res = await request(app).get('/carbs').set(auth());
    expect(res.body).toHaveLength(100);
  });

  it('never returns another patient rows', async () => {
    const other = await registerUser(app);
    await seedCarb(other.userId);
    const res = await request(app).get('/carbs').set(auth());
    expect(res.body).toEqual([]);
  });
});

describe('GET /carbs pagination', () => {
  it('walks the whole history page by page without repeating or skipping', async () => {
    const total = 250;
    const base = Date.UTC(2026, 7, 1);
    await prisma.carbEvent.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        patientId: user.userId,
        carbsGrams: 10,
        description: `m${i}`,
        eventAt: new Date(base + i * 60_000),
      })),
    });

    const collected: string[] = [];
    let before: number | undefined;
    for (let page = 0; page < 10 && collected.length < total; page++) {
      const query = before === undefined ? { limit: 40 } : { before, limit: 40 };
      const res = await request(app).get('/carbs').query(query).set(auth());
      expect(res.status).toBe(200);
      if (res.body.length === 0) break;
      for (const entry of res.body) collected.push(entry.id);
      before = res.body[res.body.length - 1].timeMs;
    }

    expect(collected).toHaveLength(total);
    expect(new Set(collected).size).toBe(total);
  });

  it('rejects a limit above the maximum with INVALID_PAGINATION', async () => {
    const res = await request(app).get('/carbs').query({ limit: 501 }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAGINATION');
  });

  it('rejects a non-numeric before with INVALID_PAGINATION', async () => {
    const res = await request(app).get('/carbs').query({ before: 'yesterday' }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAGINATION');
  });

  it('without params keeps returning the 100 most recent, newest first', async () => {
    const base = Date.UTC(2026, 7, 1);
    await prisma.carbEvent.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        patientId: user.userId,
        carbsGrams: 10,
        description: `m${i}`,
        eventAt: new Date(base + i * 60_000),
      })),
    });

    const res = await request(app).get('/carbs').set(auth());
    expect(res.body).toHaveLength(100);
    expect(res.body[0].description).toBe('m119');
  });
});

describe('POST /carbs/item', () => {
  const valid = { grams: 45, description: 'almoço', timeMs: Date.UTC(2026, 7, 20, 12) };

  it('creates an entry and answers 201 with the id', async () => {
    const res = await request(app).post('/carbs/item').set(auth()).send(valid);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await prisma.carbEvent.count({ where: { patientId: user.userId } })).toBe(1);
  });

  it('honours a client-supplied UUID', async () => {
    const res = await request(app)
      .post('/carbs/item')
      .set(auth())
      .send({ ...valid, id: UUID });
    expect(res.body).toEqual({ id: UUID });
  });

  it.each([
    ['grams is not a number', { ...valid, grams: 'x' }, 'grams must be a number'],
    ['grams is missing', { description: 'a', timeMs: 1 }, 'grams must be a number'],
    ['description is not a string', { ...valid, description: 9 }, 'description must be a string'],
    ['timeMs is not a number', { ...valid, timeMs: 'x' }, 'timeMs must be a number (epoch ms)'],
  ])('rejects when %s', async (_label, body, error) => {
    const res = await request(app).post('/carbs/item').set(auth()).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(app)
      .post('/carbs/item')
      .set(auth())
      .send({ ...valid, id: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'id must be a UUID' });
  });

  it('records a CREATE audit entry', async () => {
    const res = await request(app).post('/carbs/item').set(auth()).send(valid);
    const entries = await prisma.auditLog.findMany({ where: { entity: 'CarbEvent' } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      userId: user.userId,
      action: 'CREATE',
      entityId: res.body.id,
    });
  });
});

describe('PUT /carbs/item/:id', () => {
  const patch = { grams: 60, description: 'jantar', timeMs: Date.UTC(2026, 7, 20, 20) };

  it('updates the caller own entry', async () => {
    const row = await seedCarb(user.userId);
    const res = await request(app).put(`/carbs/item/${row.id}`).set(auth()).send(patch);

    expect(res.status).toBe(204);
    const after = await prisma.carbEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(Number(after.carbsGrams)).toBe(60);
    expect(after.description).toBe('jantar');
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(app).put('/carbs/item/nope').set(auth()).send(patch);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'id must be a UUID' });
  });

  it('validates the body before touching the database', async () => {
    const row = await seedCarb(user.userId);
    const res = await request(app)
      .put(`/carbs/item/${row.id}`)
      .set(auth())
      .send({ ...patch, grams: 'x' });
    expect(res.status).toBe(400);
  });

  it('answers 404 for an id that does not exist', async () => {
    const res = await request(app).put(`/carbs/item/${UUID}`).set(auth()).send(patch);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('answers 404 for another patient entry, and leaves it untouched', async () => {
    const other = await registerUser(app);
    const row = await seedCarb(other.userId);

    const res = await request(app).put(`/carbs/item/${row.id}`).set(auth()).send(patch);
    expect(res.status).toBe(404);

    const after = await prisma.carbEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.description).toBe('almoço');
  });
});

describe('DELETE /carbs/item/:id', () => {
  it('removes the caller own entry', async () => {
    const row = await seedCarb(user.userId);
    const res = await request(app).delete(`/carbs/item/${row.id}`).set(auth());
    expect(res.status).toBe(204);
    expect(await prisma.carbEvent.count({ where: { id: row.id } })).toBe(0);
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(app).delete('/carbs/item/nope').set(auth());
    expect(res.status).toBe(400);
  });

  it('answers 404 for an unknown id', async () => {
    const res = await request(app).delete(`/carbs/item/${UUID}`).set(auth());
    expect(res.status).toBe(404);
  });

  it('answers 404 for another patient entry, and leaves it in place', async () => {
    const other = await registerUser(app);
    const row = await seedCarb(other.userId);

    expect((await request(app).delete(`/carbs/item/${row.id}`).set(auth())).status).toBe(404);
    expect(await prisma.carbEvent.count({ where: { id: row.id } })).toBe(1);
  });
});

describe('POST /carbs (deprecated replace-all)', () => {
  it('rejects a body whose carbs field is not an array', async () => {
    const res = await request(app).post('/carbs').set(auth()).send({ carbs: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'carbs must be array' });
  });

  it('replaces the whole collection', async () => {
    await seedCarb(user.userId, { description: 'antigo' });

    const res = await request(app)
      .post('/carbs')
      .set(auth())
      .send({ carbs: [{ grams: 10, description: 'novo', timeMs: Date.UTC(2026, 7, 21) }] });

    expect(res.status).toBe(204);
    const rows = await prisma.carbEvent.findMany({ where: { patientId: user.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('novo');
  });

  it('preserves client-supplied ids and drops invalid ones', async () => {
    await request(app)
      .post('/carbs')
      .set(auth())
      .send({
        carbs: [
          { id: UUID, grams: 10, description: 'com id', timeMs: Date.UTC(2026, 7, 21) },
          { id: 'bogus', grams: 20, description: 'sem id', timeMs: Date.UTC(2026, 7, 22) },
        ],
      });

    const rows = await prisma.carbEvent.findMany({ where: { patientId: user.userId } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toContain(UUID);
  });

  it('keeps only the first 100 entries', async () => {
    await request(app)
      .post('/carbs')
      .set(auth())
      .send({
        carbs: Array.from({ length: 130 }, (_, i) => ({
          grams: 10,
          description: `m${i}`,
          timeMs: Date.UTC(2026, 7, 1) + i * 60_000,
        })),
      });

    expect(await prisma.carbEvent.count({ where: { patientId: user.userId } })).toBe(100);
  });

  it('does not touch another patient rows', async () => {
    const other = await registerUser(app);
    await seedCarb(other.userId);

    await request(app).post('/carbs').set(auth()).send({ carbs: [] });

    expect(await prisma.carbEvent.count({ where: { patientId: other.userId } })).toBe(1);
  });

  it('records a REPLACE audit entry', async () => {
    await request(app).post('/carbs').set(auth()).send({ carbs: [] });
    const entries = await prisma.auditLog.findMany({
      where: { entity: 'CarbEvent', action: 'REPLACE' },
    });
    expect(entries).toHaveLength(1);
  });
});
