/**
 * Route-level tests for `/carbs`, over supertest and the in-memory Prisma
 * double — no PostgreSQL involved (spec.md "Testes de rota sem Postgres").
 *
 * Covers the acceptance criteria the T7 task maps to: API-03 (pagination),
 * API-04 (invalid `limit`/`before`), API-05 (default page without params),
 * API-06 (deprecated batch stays up), plus the two-device scenario from the
 * story's Independent Test and the layering boundary from QUAL-01.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { buildApp, tokenFor } from '../helpers/testApp';
import { createFakeTable, createFailingTable, type FakeRow } from '../helpers/fakePrismaEvents';
import type { CarbPrismaClient } from '../../src/repositories/carbRepository';
import { createCarbRepository } from '../../src/repositories/carbRepository';
import { createCarbService } from '../../src/services/carbService';
import { createCarbController } from '../../src/controllers/carbController';
import { createCarbsRouter } from '../../src/routes/carbs';

const PATIENT_A = 'patient-a';
const PATIENT_B = 'patient-b';

function rowAt(id: string, patientId: string, timeMs: number, grams = 40): FakeRow {
  return {
    id,
    patientId,
    carbsGrams: grams,
    description: `entry ${id}`,
    eventAt: new Date(timeMs),
  };
}

/** One request app wired the same way `createCarbsRouter()` wires production,
 *  minus the real Prisma client — `resolveRole` always authorizes as PATIENT
 *  so the suite never touches a database. */
function appOver(seed: FakeRow[]) {
  const table = createFakeTable(seed, 'eventAt');
  const client = { carbEvent: table.delegate } as unknown as CarbPrismaClient;
  const controller = createCarbController(
    createCarbService({
      repository: createCarbRepository(client),
      ensurePatient: async (userId) => userId,
      recordAudit: async () => {},
    }),
  );
  const router = createCarbsRouter({
    controller,
    requireRoleOptions: { resolveRole: async () => 'PATIENT' },
  });
  return { app: buildApp('/carbs', router), rows: table.rows };
}

function auth(userId: string) {
  return { Authorization: `Bearer ${tokenFor(userId)}` };
}

test('GET /carbs without query params returns the 100 most recent (API-05)', async () => {
  const seed = Array.from({ length: 120 }, (_, i) => rowAt(`id-${i}`, PATIENT_A, 1_000 + i));
  const { app } = appOver(seed);

  const res = await request(app).get('/carbs').set(auth(PATIENT_A));

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 100);
  assert.equal(res.body[0].timeMs, 1_000 + 119);
});

test('GET /carbs paginates to the end with before/limit and covers the whole history (API-03)', async () => {
  const total = 250;
  const seed = Array.from({ length: total }, (_, i) => rowAt(`id-${i}`, PATIENT_A, 1_000 + i));
  const { app } = appOver(seed);

  const collected: string[] = [];
  let before: number | undefined;
  for (let page = 0; page < 10 && collected.length < total; page++) {
    const query = before === undefined ? {} : { before };
    const res = await request(app).get('/carbs').query({ ...query, limit: 40 }).set(auth(PATIENT_A));
    assert.equal(res.status, 200);
    if (res.body.length === 0) break;
    for (const entry of res.body) collected.push(entry.id);
    before = res.body[res.body.length - 1].timeMs;
  }

  assert.equal(collected.length, total);
  assert.equal(new Set(collected).size, total, 'no id repeated across pages');
});

test('GET /carbs rejects an out-of-range limit with 400 and INVALID_PAGINATION (API-04)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 1_000)]);

  const res = await request(app).get('/carbs').query({ limit: 501 }).set(auth(PATIENT_A));

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_PAGINATION');
  assert.match(res.body.error, /limit/);
});

test('GET /carbs rejects a non-numeric before with 400 and INVALID_PAGINATION (API-04)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 1_000)]);

  const res = await request(app).get('/carbs').query({ before: 'not-a-number' }).set(auth(PATIENT_A));

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_PAGINATION');
});

test('POST /carbs/item creates an entry and returns 201 with its id (happy path)', async () => {
  const { app, rows } = appOver([]);

  const res = await request(app)
    .post('/carbs/item')
    .set(auth(PATIENT_A))
    .send({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', grams: 45, description: 'almoço', timeMs: 1_700_000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.id, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].patientId, PATIENT_A);
});

test('POST /carbs/item rejects an invalid body with 400', async () => {
  const { app } = appOver([]);

  const res = await request(app)
    .post('/carbs/item')
    .set(auth(PATIENT_A))
    .send({ description: 'sem grams', timeMs: 1_700_000 });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /grams/);
});

test('PUT /carbs/item/:id updates the entry of the authenticated patient (happy path)', async () => {
  const { app, rows } = appOver([rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 1_000, 10)]);

  const res = await request(app)
    .put('/carbs/item/11111111-1111-4111-8111-111111111111')
    .set(auth(PATIENT_A))
    .send({ grams: 99, description: 'jantar', timeMs: 2_000 });

  assert.equal(res.status, 204);
  assert.equal(rows[0].carbsGrams, 99);
});

test('PUT /carbs/item/:id on another patient\'s entry answers 404 without changing it', async () => {
  const { app, rows } = appOver([rowAt('22222222-2222-4222-8222-222222222222', PATIENT_B, 1_000, 10)]);

  const res = await request(app)
    .put('/carbs/item/22222222-2222-4222-8222-222222222222')
    .set(auth(PATIENT_A))
    .send({ grams: 99, description: 'jantar', timeMs: 2_000 });

  assert.equal(res.status, 404);
  assert.equal(rows[0].carbsGrams, 10, 'the other patient\'s row is untouched');
});

test('DELETE /carbs/item/:id removes the entry of the authenticated patient (happy path)', async () => {
  const { app, rows } = appOver([rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 1_000)]);

  const res = await request(app).delete('/carbs/item/11111111-1111-4111-8111-111111111111').set(auth(PATIENT_A));

  assert.equal(res.status, 204);
  assert.equal(rows.length, 0);
});

test('DELETE /carbs/item/:id on another patient\'s entry answers 404 without deleting it', async () => {
  const { app, rows } = appOver([rowAt('22222222-2222-4222-8222-222222222222', PATIENT_B, 1_000)]);

  const res = await request(app).delete('/carbs/item/22222222-2222-4222-8222-222222222222').set(auth(PATIENT_A));

  assert.equal(res.status, 404);
  assert.equal(rows.length, 1, 'the other patient\'s row survives');
});

test('two devices on the same account edit distinct entries independently', async () => {
  // T7's own "Done when": device 1 edits entry X while device 2 edits entry Y
  // for the same patient; neither operation should affect the other's row.
  const { app, rows } = appOver([
    rowAt('33333333-3333-4333-8333-333333333333', PATIENT_A, 1_000, 10),
    rowAt('44444444-4444-4444-8444-444444444444', PATIENT_A, 2_000, 20),
  ]);

  const [resX, resY] = await Promise.all([
    request(app).put('/carbs/item/33333333-3333-4333-8333-333333333333').set(auth(PATIENT_A)).send({ grams: 55, description: 'x', timeMs: 1_000 }),
    request(app).put('/carbs/item/44444444-4444-4444-8444-444444444444').set(auth(PATIENT_A)).send({ grams: 77, description: 'y', timeMs: 2_000 }),
  ]);

  assert.equal(resX.status, 204);
  assert.equal(resY.status, 204);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.carbsGrams]));
  assert.equal(byId['33333333-3333-4333-8333-333333333333'], 55);
  assert.equal(byId['44444444-4444-4444-8444-444444444444'], 77);
});

test('POST /carbs (deprecated batch) still replaces the collection (API-06)', async () => {
  const { app, rows } = appOver([rowAt('stale', PATIENT_A, 500)]);

  const res = await request(app)
    .post('/carbs')
    .set(auth(PATIENT_A))
    .send({ carbs: [{ grams: 30, description: 'novo', timeMs: 3_000 }] });

  assert.equal(res.status, 204);
  assert.equal(rows.length, 1, 'the stale row was deleted and exactly one new row created');
  assert.notEqual(rows[0].id, 'stale', 'the old row is gone, replaced by a fresh one');
  assert.equal(rows[0].description, 'novo');
  assert.equal(rows[0].carbsGrams, 30);
});

test('POST /carbs rejects a non-array payload with 400 (deprecated batch)', async () => {
  const { app, rows } = appOver([rowAt('id-0', PATIENT_A, 500)]);

  const res = await request(app).post('/carbs').set(auth(PATIENT_A)).send({ carbs: 'nope' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'carbs must be array');
  assert.equal(rows.length, 1, 'the collection was not wiped by an invalid payload');
});

test('a repository failure surfaces as 500, not a silent 200 (error path, QUAL-01 boundary)', async () => {
  const client = { carbEvent: createFailingTable(new Error('db down')) } as unknown as CarbPrismaClient;
  const controller = createCarbController(
    createCarbService({
      repository: createCarbRepository(client),
      ensurePatient: async (userId) => userId,
      recordAudit: async () => {},
    }),
  );
  const router = createCarbsRouter({
    controller,
    requireRoleOptions: { resolveRole: async () => 'PATIENT' },
  });
  const app = buildApp('/carbs', router);
  // Express only recognizes an error handler by its 4-argument arity — dropping
  // `next` here would fall through to Express's own default handler instead.
  app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Internal server error' });
  });

  const res = await request(app).get('/carbs').set(auth(PATIENT_A));

  assert.equal(res.status, 500);
});

test('an unauthenticated request is rejected before reaching the service (auth boundary)', async () => {
  const { app } = appOver([]);

  const res = await request(app).get('/carbs');

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});
