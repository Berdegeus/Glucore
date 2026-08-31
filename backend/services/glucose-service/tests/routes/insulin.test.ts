import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { disconnect, prisma, registerUser, truncateAll, type RegisteredUser } from '../helpers/db';

/**
 * Characterization tests for /insulin. Same intent as readings.test.ts.
 *
 * The route mirrors /carbs but carries two extra fields — `type` and the free
 * -form `dayOfWeek`, which defaults to '' rather than null — so the mapping is
 * pinned separately instead of being assumed identical.
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

const UUID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

async function seedInsulin(patientId: string, overrides: Record<string, unknown> = {}) {
  return prisma.insulinEvent.create({
    data: {
      patientId,
      doseUnits: 6,
      insulinType: 'bolus',
      eventAt: new Date('2026-08-20T12:00:00Z'),
      dayOfWeek: 'MONDAY',
      ...overrides,
    },
  });
}

describe('GET /insulin', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/insulin')).status).toBe(401);
  });

  it('maps a stored row onto the app-facing shape', async () => {
    const row = await seedInsulin(user.userId);
    const res = await request(app).get('/insulin').set(auth());
    expect(res.body).toEqual([
      {
        id: row.id,
        units: 6,
        type: 'bolus',
        timeMs: new Date('2026-08-20T12:00:00Z').getTime(),
        dayOfWeek: 'MONDAY',
      },
    ]);
  });

  it('orders newest first', async () => {
    await seedInsulin(user.userId, { insulinType: 'a', eventAt: new Date('2026-08-20T09:00:00Z') });
    await seedInsulin(user.userId, { insulinType: 'c', eventAt: new Date('2026-08-20T15:00:00Z') });
    await seedInsulin(user.userId, { insulinType: 'b', eventAt: new Date('2026-08-20T12:00:00Z') });

    const res = await request(app).get('/insulin').set(auth());
    expect(res.body.map((i: { type: string }) => i.type)).toEqual(['c', 'b', 'a']);
  });

  it('caps the response at 100 rows', async () => {
    const base = Date.UTC(2026, 7, 1);
    await prisma.insulinEvent.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        patientId: user.userId,
        doseUnits: 1,
        insulinType: 'bolus',
        eventAt: new Date(base + i * 60_000),
        dayOfWeek: '',
      })),
    });

    expect((await request(app).get('/insulin').set(auth())).body).toHaveLength(100);
  });

  it('never returns another patient rows', async () => {
    const other = await registerUser(app);
    await seedInsulin(other.userId);
    expect((await request(app).get('/insulin').set(auth())).body).toEqual([]);
  });
});

describe('GET /insulin pagination', () => {
  it('walks the whole history page by page without repeating or skipping', async () => {
    const total = 250;
    const base = Date.UTC(2026, 7, 1);
    await prisma.insulinEvent.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        patientId: user.userId,
        doseUnits: 1,
        insulinType: 'bolus',
        eventAt: new Date(base + i * 60_000),
        dayOfWeek: '',
      })),
    });

    const collected: string[] = [];
    let before: number | undefined;
    for (let page = 0; page < 10 && collected.length < total; page++) {
      const query = before === undefined ? { limit: 40 } : { before, limit: 40 };
      const res = await request(app).get('/insulin').query(query).set(auth());
      expect(res.status).toBe(200);
      if (res.body.length === 0) break;
      for (const entry of res.body) collected.push(entry.id);
      before = res.body[res.body.length - 1].timeMs;
    }

    expect(collected).toHaveLength(total);
    expect(new Set(collected).size).toBe(total);
  });

  it('rejects a limit above the maximum with INVALID_PAGINATION', async () => {
    const res = await request(app).get('/insulin').query({ limit: 501 }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAGINATION');
  });

  it('rejects a non-numeric before with INVALID_PAGINATION', async () => {
    const res = await request(app).get('/insulin').query({ before: 'yesterday' }).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAGINATION');
  });
});

describe('POST /insulin/item', () => {
  const valid = { units: 6, type: 'bolus', timeMs: Date.UTC(2026, 7, 20, 12), dayOfWeek: 'MONDAY' };

  it('creates an entry and answers 201 with the id', async () => {
    const res = await request(app).post('/insulin/item').set(auth()).send(valid);
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('honours a client-supplied UUID', async () => {
    const res = await request(app)
      .post('/insulin/item')
      .set(auth())
      .send({ ...valid, id: UUID });
    expect(res.body).toEqual({ id: UUID });
  });

  it('defaults a missing dayOfWeek to the empty string', async () => {
    const { dayOfWeek: _omitted, ...withoutDay } = valid;
    const res = await request(app).post('/insulin/item').set(auth()).send(withoutDay);

    const row = await prisma.insulinEvent.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.dayOfWeek).toBe('');
  });

  it.each([
    ['units is not a number', { ...valid, units: 'x' }, 'units must be a number'],
    ['type is empty', { ...valid, type: '   ' }, 'type must be a non-empty string'],
    ['type is not a string', { ...valid, type: 3 }, 'type must be a non-empty string'],
    ['timeMs is not a number', { ...valid, timeMs: 'x' }, 'timeMs must be a number (epoch ms)'],
    ['dayOfWeek is not a string', { ...valid, dayOfWeek: 5 }, 'dayOfWeek must be a string'],
  ])('rejects when %s', async (_label, body, error) => {
    const res = await request(app).post('/insulin/item').set(auth()).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });

  it('records a CREATE audit entry', async () => {
    const res = await request(app).post('/insulin/item').set(auth()).send(valid);
    const entries = await prisma.auditLog.findMany({ where: { entity: 'InsulinEvent' } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: 'CREATE', entityId: res.body.id });
  });
});

describe('PUT /insulin/item/:id', () => {
  const patch = { units: 8, type: 'basal', timeMs: Date.UTC(2026, 7, 20, 20), dayOfWeek: 'TUESDAY' };

  it('updates the caller own entry', async () => {
    const row = await seedInsulin(user.userId);
    expect((await request(app).put(`/insulin/item/${row.id}`).set(auth()).send(patch)).status).toBe(
      204,
    );

    const after = await prisma.insulinEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(Number(after.doseUnits)).toBe(8);
    expect(after.insulinType).toBe('basal');
    expect(after.dayOfWeek).toBe('TUESDAY');
  });

  it('rejects a non-UUID id', async () => {
    const res = await request(app).put('/insulin/item/nope').set(auth()).send(patch);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'id must be a UUID' });
  });

  it('answers 404 for an id that does not exist', async () => {
    const res = await request(app).put(`/insulin/item/${UUID}`).set(auth()).send(patch);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('answers 404 for another patient entry, and leaves it untouched', async () => {
    const other = await registerUser(app);
    const row = await seedInsulin(other.userId);

    expect((await request(app).put(`/insulin/item/${row.id}`).set(auth()).send(patch)).status).toBe(
      404,
    );
    const after = await prisma.insulinEvent.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.insulinType).toBe('bolus');
  });
});

describe('DELETE /insulin/item/:id', () => {
  it('removes the caller own entry', async () => {
    const row = await seedInsulin(user.userId);
    expect((await request(app).delete(`/insulin/item/${row.id}`).set(auth())).status).toBe(204);
    expect(await prisma.insulinEvent.count({ where: { id: row.id } })).toBe(0);
  });

  it('rejects a non-UUID id', async () => {
    expect((await request(app).delete('/insulin/item/nope').set(auth())).status).toBe(400);
  });

  it('answers 404 for an unknown id', async () => {
    expect((await request(app).delete(`/insulin/item/${UUID}`).set(auth())).status).toBe(404);
  });

  it('answers 404 for another patient entry, and leaves it in place', async () => {
    const other = await registerUser(app);
    const row = await seedInsulin(other.userId);

    expect((await request(app).delete(`/insulin/item/${row.id}`).set(auth())).status).toBe(404);
    expect(await prisma.insulinEvent.count({ where: { id: row.id } })).toBe(1);
  });
});

describe('POST /insulin (deprecated replace-all)', () => {
  it('rejects a body whose insulin field is not an array', async () => {
    const res = await request(app).post('/insulin').set(auth()).send({ insulin: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'insulin must be array' });
  });

  it('replaces the whole collection', async () => {
    await seedInsulin(user.userId, { insulinType: 'antigo' });

    const res = await request(app)
      .post('/insulin')
      .set(auth())
      .send({ insulin: [{ units: 3, type: 'novo', timeMs: Date.UTC(2026, 7, 21) }] });

    expect(res.status).toBe(204);
    const rows = await prisma.insulinEvent.findMany({ where: { patientId: user.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].insulinType).toBe('novo');
    expect(rows[0].dayOfWeek).toBe('');
  });

  it('keeps only the first 100 entries', async () => {
    await request(app)
      .post('/insulin')
      .set(auth())
      .send({
        insulin: Array.from({ length: 130 }, (_, i) => ({
          units: 1,
          type: 'bolus',
          timeMs: Date.UTC(2026, 7, 1) + i * 60_000,
        })),
      });

    expect(await prisma.insulinEvent.count({ where: { patientId: user.userId } })).toBe(100);
  });

  it('does not touch another patient rows', async () => {
    const other = await registerUser(app);
    await seedInsulin(other.userId);

    await request(app).post('/insulin').set(auth()).send({ insulin: [] });

    expect(await prisma.insulinEvent.count({ where: { patientId: other.userId } })).toBe(1);
  });

  it('records a REPLACE audit entry', async () => {
    await request(app).post('/insulin').set(auth()).send({ insulin: [] });
    const entries = await prisma.auditLog.findMany({
      where: { entity: 'InsulinEvent', action: 'REPLACE' },
    });
    expect(entries).toHaveLength(1);
  });
});
