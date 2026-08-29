/**
 * Route-level tests for `/insulin`, over supertest and the in-memory Prisma
 * double — no PostgreSQL involved (spec.md "Testes de rota sem Postgres").
 *
 * Covers the acceptance criteria T9 maps to: API-03 (pagination), API-04
 * (invalid `limit`/`before`), API-05 (default page without params), API-06
 * (deprecated batch stays up), plus the layering boundary from QUAL-01.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { buildApp, tokenFor } from '../helpers/testApp';
import { createFakeTable, createFailingTable, type FakeRow } from '../helpers/fakePrismaEvents';
import type { InsulinPrismaClient } from '../../src/repositories/insulinRepository';
import { createInsulinRepository } from '../../src/repositories/insulinRepository';
import { createInsulinService } from '../../src/services/insulinService';
import { createInsulinController } from '../../src/controllers/insulinController';
import { createInsulinRouter } from '../../src/routes/insulin';

const PATIENT_A = 'patient-a';
const PATIENT_B = 'patient-b';

function rowAt(id: string, patientId: string, timeMs: number, units = 4): FakeRow {
  return {
    id,
    patientId,
    doseUnits: units,
    insulinType: 'bolus',
    eventAt: new Date(timeMs),
    dayOfWeek: 'MONDAY',
  };
}

/** One request app wired the same way `createInsulinRouter()` wires production,
 *  minus the real Prisma client — `resolveRole` always authorizes as PATIENT
 *  so the suite never touches a database. */
function appOver(seed: FakeRow[]) {
  const table = createFakeTable(seed, 'eventAt');
  const client = { insulinEvent: table.delegate } as unknown as InsulinPrismaClient;
  const controller = createInsulinController(
    createInsulinService({
      repository: createInsulinRepository(client),
      ensurePatient: async (userId) => userId,
      recordAudit: async () => {},
    }),
  );
  const router = createInsulinRouter({
    controller,
    requireRoleOptions: { resolveRole: async () => 'PATIENT' },
  });
  return { app: buildApp('/insulin', router), rows: table.rows };
}

function auth(userId: string) {
  return { Authorization: `Bearer ${tokenFor(userId)}` };
}

test('GET /insulin without query params returns the 100 most recent (API-05)', async () => {
  const seed = Array.from({ length: 120 }, (_, i) => rowAt(`id-${i}`, PATIENT_A, 1_000 + i));
  const { app } = appOver(seed);

  const res = await request(app).get('/insulin').set(auth(PATIENT_A));

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 100);
  assert.equal(res.body[0].timeMs, 1_000 + 119);
});

test('GET /insulin returns the full entry shape the app reads', async () => {
  const { app } = appOver([rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 5_000, 7)]);

  const res = await request(app).get('/insulin').set(auth(PATIENT_A));

  assert.equal(res.status, 200);
  assert.deepEqual(res.body[0], {
    id: '11111111-1111-4111-8111-111111111111',
    units: 7,
    type: 'bolus',
    timeMs: 5_000,
    dayOfWeek: 'MONDAY',
  });
});

test('GET /insulin paginates to the end with before/limit and covers the whole history (API-03)', async () => {
  const total = 250;
  const seed = Array.from({ length: total }, (_, i) => rowAt(`id-${i}`, PATIENT_A, 1_000 + i));
  const { app } = appOver(seed);

  const collected: string[] = [];
  let before: number | undefined;
  for (let page = 0; page < 10 && collected.length < total; page++) {
    const query = before === undefined ? {} : { before };
    const res = await request(app).get('/insulin').query({ ...query, limit: 40 }).set(auth(PATIENT_A));
    assert.equal(res.status, 200);
    if (res.body.length === 0) break;
    for (const entry of res.body) collected.push(entry.id);
    before = res.body[res.body.length - 1].timeMs;
  }

  assert.equal(collected.length, total);
  assert.equal(new Set(collected).size, total, 'no id repeated across pages');
});

test('GET /insulin with a before older than every entry answers 200 and an empty list (edge case)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 5_000)]);

  const res = await request(app).get('/insulin').query({ before: 1 }).set(auth(PATIENT_A));

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /insulin rejects an out-of-range limit with 400 and INVALID_PAGINATION (API-04)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 1_000)]);

  const res = await request(app).get('/insulin').query({ limit: 501 }).set(auth(PATIENT_A));

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_PAGINATION');
  assert.match(res.body.error, /limit/);
});

test('GET /insulin rejects a non-numeric before with 400 and INVALID_PAGINATION (API-04)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 1_000)]);

  const res = await request(app).get('/insulin').query({ before: 'not-a-number' }).set(auth(PATIENT_A));

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_PAGINATION');
});

test('POST /insulin/item creates an entry and returns 201 with its id (happy path)', async () => {
  const { app, rows } = appOver([]);

  const res = await request(app)
    .post('/insulin/item')
    .set(auth(PATIENT_A))
    .send({
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      units: 6,
      type: 'basal',
      timeMs: 1_700_000,
      dayOfWeek: 'TUESDAY',
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.id, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].patientId, PATIENT_A);
  assert.equal(rows[0].doseUnits, 6);
  assert.equal(rows[0].dayOfWeek, 'TUESDAY');
});

test('POST /insulin/item rejects an invalid body with 400', async () => {
  const { app } = appOver([]);

  const res = await request(app)
    .post('/insulin/item')
    .set(auth(PATIENT_A))
    .send({ type: 'bolus', timeMs: 1_700_000 });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /units/);
});

test('POST /insulin/item rejects an empty type with 400', async () => {
  const { app } = appOver([]);

  const res = await request(app)
    .post('/insulin/item')
    .set(auth(PATIENT_A))
    .send({ units: 3, type: '  ', timeMs: 1_700_000 });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /type/);
});

test('POST /insulin/item rejects a non-UUID id with 400', async () => {
  const { app, rows } = appOver([]);

  const res = await request(app)
    .post('/insulin/item')
    .set(auth(PATIENT_A))
    .send({ id: 'not-a-uuid', units: 3, type: 'bolus', timeMs: 1_700_000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'id must be a UUID');
  assert.equal(rows.length, 0, 'nothing was persisted');
});

test('PUT /insulin/item/:id updates the entry of the authenticated patient (happy path)', async () => {
  const { app, rows } = appOver([rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 1_000, 2)]);

  const res = await request(app)
    .put('/insulin/item/11111111-1111-4111-8111-111111111111')
    .set(auth(PATIENT_A))
    .send({ units: 9, type: 'basal', timeMs: 2_000, dayOfWeek: 'FRIDAY' });

  assert.equal(res.status, 204);
  assert.equal(rows[0].doseUnits, 9);
  assert.equal(rows[0].insulinType, 'basal');
  assert.equal(rows[0].dayOfWeek, 'FRIDAY');
});

test("PUT /insulin/item/:id on another patient's entry answers 404 without changing it", async () => {
  const { app, rows } = appOver([rowAt('22222222-2222-4222-8222-222222222222', PATIENT_B, 1_000, 2)]);

  const res = await request(app)
    .put('/insulin/item/22222222-2222-4222-8222-222222222222')
    .set(auth(PATIENT_A))
    .send({ units: 9, type: 'basal', timeMs: 2_000 });

  assert.equal(res.status, 404);
  assert.equal(rows[0].doseUnits, 2, "the other patient's row is untouched");
});

test('DELETE /insulin/item/:id removes the entry of the authenticated patient (happy path)', async () => {
  const { app, rows } = appOver([rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 1_000)]);

  const res = await request(app)
    .delete('/insulin/item/11111111-1111-4111-8111-111111111111')
    .set(auth(PATIENT_A));

  assert.equal(res.status, 204);
  assert.equal(rows.length, 0);
});

test("DELETE /insulin/item/:id on another patient's entry answers 404 without deleting it", async () => {
  const { app, rows } = appOver([rowAt('22222222-2222-4222-8222-222222222222', PATIENT_B, 1_000)]);

  const res = await request(app)
    .delete('/insulin/item/22222222-2222-4222-8222-222222222222')
    .set(auth(PATIENT_A));

  assert.equal(res.status, 404);
  assert.equal(rows.length, 1, "the other patient's row survives");
});

test('two devices on the same account edit distinct entries independently', async () => {
  const { app, rows } = appOver([
    rowAt('33333333-3333-4333-8333-333333333333', PATIENT_A, 1_000, 2),
    rowAt('44444444-4444-4444-8444-444444444444', PATIENT_A, 2_000, 3),
  ]);

  const [resX, resY] = await Promise.all([
    request(app)
      .put('/insulin/item/33333333-3333-4333-8333-333333333333')
      .set(auth(PATIENT_A))
      .send({ units: 11, type: 'bolus', timeMs: 1_000 }),
    request(app)
      .put('/insulin/item/44444444-4444-4444-8444-444444444444')
      .set(auth(PATIENT_A))
      .send({ units: 22, type: 'basal', timeMs: 2_000 }),
  ]);

  assert.equal(resX.status, 204);
  assert.equal(resY.status, 204);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r.doseUnits]));
  assert.equal(byId['33333333-3333-4333-8333-333333333333'], 11);
  assert.equal(byId['44444444-4444-4444-8444-444444444444'], 22);
});

test('POST /insulin (deprecated batch) still replaces the collection (API-06)', async () => {
  const { app, rows } = appOver([rowAt('stale', PATIENT_A, 500)]);

  const res = await request(app)
    .post('/insulin')
    .set(auth(PATIENT_A))
    .send({ insulin: [{ units: 3, type: 'basal', timeMs: 3_000, dayOfWeek: 'SUNDAY' }] });

  assert.equal(res.status, 204);
  assert.equal(rows.length, 1, 'the stale row was deleted and exactly one new row created');
  assert.notEqual(rows[0].id, 'stale', 'the old row is gone, replaced by a fresh one');
  assert.equal(rows[0].insulinType, 'basal');
  assert.equal(rows[0].doseUnits, 3);
});

test('POST /insulin rejects a non-array payload with 400 (deprecated batch)', async () => {
  const { app } = appOver([]);

  const res = await request(app).post('/insulin').set(auth(PATIENT_A)).send({ insulin: 'nope' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'insulin must be array');
});

test('a repository failure surfaces as 500, not a silent 200 (error path, QUAL-01 boundary)', async () => {
  const client = {
    insulinEvent: createFailingTable(new Error('db down')),
  } as unknown as InsulinPrismaClient;
  const controller = createInsulinController(
    createInsulinService({
      repository: createInsulinRepository(client),
      ensurePatient: async (userId) => userId,
      recordAudit: async () => {},
    }),
  );
  const router = createInsulinRouter({
    controller,
    requireRoleOptions: { resolveRole: async () => 'PATIENT' },
  });
  const app = buildApp('/insulin', router);
  // Express only recognizes an error handler by its 4-argument arity — dropping
  // `next` here would fall through to Express's own default handler instead.
  app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Internal server error' });
  });

  const res = await request(app).get('/insulin').set(auth(PATIENT_A));

  assert.equal(res.status, 500);
});

test('an unauthenticated request is rejected before reaching the service (auth boundary)', async () => {
  const { app } = appOver([]);

  const res = await request(app).get('/insulin');

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});
