/**
 * Route-level tests for `/alerts`, over supertest and the in-memory Prisma
 * double — no PostgreSQL involved (spec.md "Testes de rota sem Postgres").
 *
 * Covers the acceptance criteria T11 maps to: API-01 (per-item create, update
 * and delete hitting exactly the authenticated patient's row, with the id
 * exposed), API-02 (someone else's id answers 404 and changes nothing),
 * API-03/04/05 (pagination and its validation), API-06 (deprecated batch stays
 * up) and the layering boundary from QUAL-01.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { AlertType } from '@prisma/client';
import { buildApp, tokenFor } from '../helpers/testApp';
import { createFakeTable, createFailingTable, type FakeRow } from '../helpers/fakePrismaEvents';
import type { AlertPrismaClient } from '../../src/repositories/alertRepository';
import { createAlertRepository } from '../../src/repositories/alertRepository';
import { createAlertService } from '../../src/services/alertService';
import { createAlertController } from '../../src/controllers/alertController';
import { createAlertsRouter } from '../../src/routes/alerts';

const PATIENT_A = 'patient-a';
const PATIENT_B = 'patient-b';

function rowAt(
  id: string,
  patientId: string,
  timeMs: number,
  alertType: AlertType = AlertType.HYPO_RISK,
): FakeRow {
  return { id, patientId, alertType, triggeredAt: new Date(timeMs) };
}

/** One request app wired the same way `createAlertsRouter()` wires production,
 *  minus the real Prisma client — `resolveRole` always authorizes as PATIENT
 *  so the suite never touches a database. */
function appOver(seed: FakeRow[]) {
  const table = createFakeTable(seed, 'triggeredAt');
  const client = { alertEvent: table.delegate } as unknown as AlertPrismaClient;
  const controller = createAlertController(
    createAlertService({
      repository: createAlertRepository(client),
      ensurePatient: async (userId) => userId,
      recordAudit: async () => {},
    }),
  );
  const router = createAlertsRouter({
    controller,
    requireRoleOptions: { resolveRole: async () => 'PATIENT' },
  });
  return { app: buildApp('/alerts', router), rows: table.rows };
}

function auth(userId: string) {
  return { Authorization: `Bearer ${tokenFor(userId)}` };
}

test('GET /alerts returns the id alongside type and timestamp (API-01)', async () => {
  const { app } = appOver([
    rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 5_000, AlertType.HYPER_RISK),
  ]);

  const res = await request(app).get('/alerts').set(auth(PATIENT_A));

  assert.equal(res.status, 200);
  assert.deepEqual(res.body[0], {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'glucoseHigh',
    timestampMs: 5_000,
  });
});

test('GET /alerts without query params returns the 100 most recent (API-05)', async () => {
  const seed = Array.from({ length: 120 }, (_, i) => rowAt(`id-${i}`, PATIENT_A, 1_000 + i));
  const { app } = appOver(seed);

  const res = await request(app).get('/alerts').set(auth(PATIENT_A));

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 100);
  assert.equal(res.body[0].timestampMs, 1_000 + 119);
});

test('GET /alerts paginates to the end with before/limit and covers the whole history (API-03)', async () => {
  const total = 250;
  const seed = Array.from({ length: total }, (_, i) => rowAt(`id-${i}`, PATIENT_A, 1_000 + i));
  const { app } = appOver(seed);

  const collected: string[] = [];
  let before: number | undefined;
  for (let page = 0; page < 10 && collected.length < total; page++) {
    const query = before === undefined ? {} : { before };
    const res = await request(app).get('/alerts').query({ ...query, limit: 40 }).set(auth(PATIENT_A));
    assert.equal(res.status, 200);
    if (res.body.length === 0) break;
    for (const entry of res.body) collected.push(entry.id);
    before = res.body[res.body.length - 1].timestampMs;
  }

  assert.equal(collected.length, total);
  assert.equal(new Set(collected).size, total, 'no id repeated across pages');
});

test('GET /alerts with a before older than every entry answers 200 and an empty list (edge case)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 5_000)]);

  const res = await request(app).get('/alerts').query({ before: 1 }).set(auth(PATIENT_A));

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('GET /alerts rejects an out-of-range limit with 400 and INVALID_PAGINATION (API-04)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 1_000)]);

  const res = await request(app).get('/alerts').query({ limit: 0 }).set(auth(PATIENT_A));

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_PAGINATION');
  assert.match(res.body.error, /limit/);
});

test('GET /alerts rejects a non-numeric before with 400 and INVALID_PAGINATION (API-04)', async () => {
  const { app } = appOver([rowAt('id-0', PATIENT_A, 1_000)]);

  const res = await request(app).get('/alerts').query({ before: 'not-a-number' }).set(auth(PATIENT_A));

  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_PAGINATION');
});

test('POST /alerts/item creates the alert and returns 201 with its id (API-01)', async () => {
  const { app, rows } = appOver([]);

  const res = await request(app)
    .post('/alerts/item')
    .set(auth(PATIENT_A))
    .send({
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      type: 'glucoseLow',
      timestampMs: 1_700_000,
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.id, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].patientId, PATIENT_A);
  assert.equal(rows[0].alertType, AlertType.HYPO_RISK);
  assert.equal((rows[0].triggeredAt as Date).getTime(), 1_700_000);
});

test('an alert created per item is readable back with the same id (API-01)', async () => {
  const { app } = appOver([]);

  await request(app)
    .post('/alerts/item')
    .set(auth(PATIENT_A))
    .send({
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      type: 'sensorReconnected',
      timestampMs: 1_700_000,
    });
  const res = await request(app).get('/alerts').set(auth(PATIENT_A));

  assert.deepEqual(res.body[0], {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    type: 'sensorReconnected',
    timestampMs: 1_700_000,
  });
});

test('POST /alerts/item rejects an invalid body with 400', async () => {
  const { app } = appOver([]);

  const res = await request(app)
    .post('/alerts/item')
    .set(auth(PATIENT_A))
    .send({ type: 'glucoseLow' });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /timestampMs/);
});

test('POST /alerts/item rejects an empty type with 400', async () => {
  const { app, rows } = appOver([]);

  const res = await request(app)
    .post('/alerts/item')
    .set(auth(PATIENT_A))
    .send({ type: '   ', timestampMs: 1_700_000 });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /type/);
  assert.equal(rows.length, 0, 'nothing was persisted');
});

test('POST /alerts/item rejects a non-UUID id with 400 and stores nothing', async () => {
  const { app, rows } = appOver([]);

  const res = await request(app)
    .post('/alerts/item')
    .set(auth(PATIENT_A))
    .send({ id: 'not-a-uuid', type: 'glucoseLow', timestampMs: 1_700_000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'id must be a UUID');
  assert.equal(rows.length, 0);
});

test('PUT /alerts/item/:id updates the alert of the authenticated patient (API-01)', async () => {
  const { app, rows } = appOver([
    rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 1_000, AlertType.HYPO_RISK),
  ]);

  const res = await request(app)
    .put('/alerts/item/11111111-1111-4111-8111-111111111111')
    .set(auth(PATIENT_A))
    .send({ type: 'glucoseHigh', timestampMs: 2_000 });

  assert.equal(res.status, 204);
  assert.equal(rows[0].alertType, AlertType.HYPER_RISK);
  assert.equal((rows[0].triggeredAt as Date).getTime(), 2_000);
});

test("PUT /alerts/item/:id on another patient's alert answers 404 without changing it (API-02)", async () => {
  const { app, rows } = appOver([
    rowAt('22222222-2222-4222-8222-222222222222', PATIENT_B, 1_000, AlertType.HYPO_RISK),
  ]);

  const res = await request(app)
    .put('/alerts/item/22222222-2222-4222-8222-222222222222')
    .set(auth(PATIENT_A))
    .send({ type: 'glucoseHigh', timestampMs: 2_000 });

  assert.equal(res.status, 404);
  assert.equal(rows[0].alertType, AlertType.HYPO_RISK, "the other patient's row is untouched");
  assert.equal((rows[0].triggeredAt as Date).getTime(), 1_000);
});

test('PUT /alerts/item/:id rejects a non-UUID id with 400', async () => {
  const { app } = appOver([]);

  const res = await request(app)
    .put('/alerts/item/not-a-uuid')
    .set(auth(PATIENT_A))
    .send({ type: 'glucoseHigh', timestampMs: 2_000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'id must be a UUID');
});

test('DELETE /alerts/item/:id removes the alert of the authenticated patient (API-01)', async () => {
  const { app, rows } = appOver([rowAt('11111111-1111-4111-8111-111111111111', PATIENT_A, 1_000)]);

  const res = await request(app)
    .delete('/alerts/item/11111111-1111-4111-8111-111111111111')
    .set(auth(PATIENT_A));

  assert.equal(res.status, 204);
  assert.equal(rows.length, 0);
});

test("DELETE /alerts/item/:id on another patient's alert answers 404 without deleting it (API-02)", async () => {
  const { app, rows } = appOver([rowAt('22222222-2222-4222-8222-222222222222', PATIENT_B, 1_000)]);

  const res = await request(app)
    .delete('/alerts/item/22222222-2222-4222-8222-222222222222')
    .set(auth(PATIENT_A));

  assert.equal(res.status, 404);
  assert.equal(rows.length, 1, "the other patient's row survives");
});

test('POST /alerts (deprecated batch) still replaces the collection (API-06)', async () => {
  const { app, rows } = appOver([rowAt('stale', PATIENT_A, 500)]);

  const res = await request(app)
    .post('/alerts')
    .set(auth(PATIENT_A))
    .send({ alerts: [{ type: 'glucoseHigh', timestampMs: 3_000 }] });

  assert.equal(res.status, 204);
  assert.equal(rows.length, 1, 'the stale row was deleted and exactly one new row created');
  assert.notEqual(rows[0].id, 'stale', 'the old row is gone, replaced by a fresh one');
  assert.equal(rows[0].alertType, AlertType.HYPER_RISK);
  assert.equal((rows[0].triggeredAt as Date).getTime(), 3_000);
});

test('POST /alerts keeps the client-supplied id of each alert (API-01)', async () => {
  const { app } = appOver([]);

  await request(app)
    .post('/alerts')
    .set(auth(PATIENT_A))
    .send({
      alerts: [
        { id: '11111111-1111-4111-8111-111111111111', type: 'glucoseLow', timestampMs: 1_000 },
        { id: '22222222-2222-4222-8222-222222222222', type: 'glucoseHigh', timestampMs: 2_000 },
      ],
    });
  const res = await request(app).get('/alerts').set(auth(PATIENT_A));

  assert.deepEqual(
    res.body.map((entry: { id: string }) => entry.id),
    ['22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111'],
  );
});

test('POST /alerts rejects a non-array payload with 400 (deprecated batch)', async () => {
  const { app } = appOver([]);

  const res = await request(app).post('/alerts').set(auth(PATIENT_A)).send({ alerts: 'nope' });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'alerts must be array');
});

test('a repository failure surfaces as 500, not a silent 200 (error path, QUAL-01 boundary)', async () => {
  const client = {
    alertEvent: createFailingTable(new Error('db down')),
  } as unknown as AlertPrismaClient;
  const controller = createAlertController(
    createAlertService({
      repository: createAlertRepository(client),
      ensurePatient: async (userId) => userId,
      recordAudit: async () => {},
    }),
  );
  const router = createAlertsRouter({
    controller,
    requireRoleOptions: { resolveRole: async () => 'PATIENT' },
  });
  const app = buildApp('/alerts', router);
  // Express only recognizes an error handler by its 4-argument arity — dropping
  // `next` here would fall through to Express's own default handler instead.
  app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Internal server error' });
  });

  const res = await request(app).get('/alerts').set(auth(PATIENT_A));

  assert.equal(res.status, 500);
});

test('an unauthenticated request is rejected before reaching the service (auth boundary)', async () => {
  const { app } = appOver([]);

  const res = await request(app).get('/alerts');

  assert.equal(res.status, 401);
  assert.equal(res.body.code, 'TOKEN_INVALID');
});
