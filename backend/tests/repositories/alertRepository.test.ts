import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AlertType } from '@prisma/client';
import { createFakeTable, createFailingTable } from '../helpers/fakePrismaEvents.ts';
import type { AlertPrismaClient } from '../../src/repositories/alertRepository.ts';
import {
  createAlertRepository,
  toAppAlertType,
  toDbAlertType,
} from '../../src/repositories/alertRepository.ts';

/**
 * Spec: arch-phases-3-5 — API-01 (o `id` do alerta é exposto e round-trips),
 * API-03 (paginação decrescente por paciente), API-06 (o endpoint de coleção
 * continua funcionando) e QUAL-01 (acesso a dados fora do handler de rota).
 */

const MINE = 'patient-1';
const OTHER = 'patient-2';

const T1 = Date.UTC(2026, 0, 1, 8, 0, 0); // oldest
const T2 = Date.UTC(2026, 0, 1, 9, 0, 0);
const T3 = Date.UTC(2026, 0, 1, 10, 0, 0); // newest

/** Seeded out of chronological order so an unsorted read is visible. */
function seeded() {
  return createFakeTable(
    [
      { id: 'a-2', patientId: MINE, alertType: AlertType.HYPER_RISK, triggeredAt: new Date(T2) },
      { id: 'a-3', patientId: MINE, alertType: AlertType.SENSOR_RECONNECTED, triggeredAt: new Date(T3) },
      { id: 'a-1', patientId: MINE, alertType: AlertType.HYPO_RISK, triggeredAt: new Date(T1) },
      { id: 'x-1', patientId: OTHER, alertType: AlertType.HYPO_RISK, triggeredAt: new Date(T3) },
    ],
    'triggeredAt',
  );
}

function repositoryOver(table: ReturnType<typeof createFakeTable>) {
  return createAlertRepository({ alertEvent: table.delegate } as unknown as AlertPrismaClient);
}

describe('alert type mapping', () => {
  it('round-trips every app type that has its own stored value', () => {
    for (const appType of ['glucoseLow', 'glucoseHigh', 'sensorReconnected', 'syncFailure']) {
      assert.equal(toAppAlertType(toDbAlertType(appType)), appType);
    }
  });

  it('stores the app names under the matching enum value', () => {
    assert.equal(toDbAlertType('glucoseLow'), AlertType.HYPO_RISK);
    assert.equal(toDbAlertType('glucoseHigh'), AlertType.HYPER_RISK);
    assert.equal(toDbAlertType('sensorReconnected'), AlertType.SENSOR_RECONNECTED);
    assert.equal(toDbAlertType('syncFailure'), AlertType.SYNC_FAILURE);
  });

  it('accepts the stored enum names as input too', () => {
    assert.equal(toDbAlertType('HYPO_RISK'), AlertType.HYPO_RISK);
    assert.equal(toDbAlertType('FAST_DROP'), AlertType.FAST_DROP);
    assert.equal(toDbAlertType('FAST_RISE'), AlertType.FAST_RISE);
  });

  it('falls back to SYNC_FAILURE for a type it does not know', () => {
    assert.equal(toDbAlertType('meteor strike'), AlertType.SYNC_FAILURE);
  });

  it('reads the three failure-ish enum values back as syncFailure', () => {
    assert.equal(toAppAlertType(AlertType.FAST_DROP), 'syncFailure');
    assert.equal(toAppAlertType(AlertType.FAST_RISE), 'syncFailure');
    assert.equal(toAppAlertType(AlertType.SYNC_FAILURE), 'syncFailure');
  });
});

describe('alertRepository.findPage', () => {
  it('returns the patient rows newest first, with the id exposed (API-01)', async () => {
    const table = seeded();
    const page = await repositoryOver(table).findPage({ patientId: MINE, limit: 100 });
    assert.deepEqual(
      page.map((entry) => entry.id),
      ['a-3', 'a-2', 'a-1'],
    );
    assert.deepEqual(page[0], {
      id: 'a-3',
      type: 'sensorReconnected',
      timestampMs: T3,
    });
  });

  it('never returns another patient row', async () => {
    const table = seeded();
    const page = await repositoryOver(table).findPage({ patientId: MINE, limit: 100 });
    assert.equal(
      page.some((entry) => entry.id === 'x-1'),
      false,
    );
    assert.equal(page.length, 3);
  });

  it('returns at most `limit` entries, taking the newest ones', async () => {
    const table = seeded();
    const page = await repositoryOver(table).findPage({ patientId: MINE, limit: 2 });
    assert.deepEqual(
      page.map((entry) => entry.id),
      ['a-3', 'a-2'],
    );
  });

  it('returns only entries strictly older than `before`', async () => {
    const table = seeded();
    const page = await repositoryOver(table).findPage({
      patientId: MINE,
      before: T3,
      limit: 100,
    });
    assert.deepEqual(
      page.map((entry) => entry.id),
      ['a-2', 'a-1'],
    );
  });

  it('walks the whole history page by page without repeating or skipping', async () => {
    const repository = repositoryOver(seeded());
    const first = await repository.findPage({ patientId: MINE, limit: 2 });
    const second = await repository.findPage({
      patientId: MINE,
      before: first[first.length - 1].timestampMs,
      limit: 2,
    });
    const third = await repository.findPage({
      patientId: MINE,
      before: second[second.length - 1].timestampMs,
      limit: 2,
    });
    assert.deepEqual(
      [...first, ...second].map((entry) => entry.id),
      ['a-3', 'a-2', 'a-1'],
    );
    assert.deepEqual(third, []);
  });

  it('propagates a database failure instead of swallowing it', async () => {
    const failure = new Error('database unreachable');
    const repository = createAlertRepository({
      alertEvent: createFailingTable(failure),
    } as unknown as AlertPrismaClient);
    await assert.rejects(
      () => repository.findPage({ patientId: MINE, limit: 100 }),
      /database unreachable/,
    );
  });
});

describe('alertRepository.create', () => {
  it('persists the alert under the given patient and keeps the client id', async () => {
    const table = seeded();
    const id = await repositoryOver(table).create(MINE, {
      id: 'a-9',
      type: 'glucoseLow',
      timestampMs: T2,
    });
    assert.equal(id, 'a-9');
    const stored = table.rows.find((row) => row.id === 'a-9');
    assert.deepEqual(
      {
        patientId: stored?.patientId,
        alertType: stored?.alertType,
        triggeredAt: (stored?.triggeredAt as Date).getTime(),
      },
      { patientId: MINE, alertType: AlertType.HYPO_RISK, triggeredAt: T2 },
    );
  });

  it('makes a created alert readable back with the same id and type (API-01)', async () => {
    const table = seeded();
    const repository = repositoryOver(table);
    await repository.create(MINE, { id: 'a-9', type: 'glucoseHigh', timestampMs: T2 });
    const page = await repository.findPage({ patientId: MINE, limit: 100 });
    const found = page.find((entry) => entry.id === 'a-9');
    assert.deepEqual(found, { id: 'a-9', type: 'glucoseHigh', timestampMs: T2 });
  });

  it('lets the database generate the id when the client sent none', async () => {
    const table = seeded();
    const id = await repositoryOver(table).create(MINE, {
      type: 'syncFailure',
      timestampMs: T2,
    });
    assert.match(id, /^generated-/);
    assert.equal(table.rows.filter((row) => row.patientId === MINE).length, 4);
  });
});

describe('alertRepository.update', () => {
  it('writes the new values and reports true for a row of the patient', async () => {
    const table = seeded();
    const changed = await repositoryOver(table).update('a-1', MINE, {
      type: 'sensorReconnected',
      timestampMs: T3,
    });
    assert.equal(changed, true);
    const stored = table.rows.find((row) => row.id === 'a-1');
    assert.deepEqual(
      {
        alertType: stored?.alertType,
        triggeredAt: (stored?.triggeredAt as Date).getTime(),
      },
      { alertType: AlertType.SENSOR_RECONNECTED, triggeredAt: T3 },
    );
  });

  it('reports false and leaves the row untouched when it belongs to another patient', async () => {
    const table = seeded();
    const changed = await repositoryOver(table).update('x-1', MINE, {
      type: 'glucoseHigh',
      timestampMs: T1,
    });
    assert.equal(changed, false);
    const stored = table.rows.find((row) => row.id === 'x-1');
    assert.equal(stored?.alertType, AlertType.HYPO_RISK);
    assert.equal((stored?.triggeredAt as Date).getTime(), T3);
  });
});

describe('alertRepository.remove', () => {
  it('deletes the row of the patient and reports true', async () => {
    const table = seeded();
    const removed = await repositoryOver(table).remove('a-2', MINE);
    assert.equal(removed, true);
    assert.equal(
      table.rows.some((row) => row.id === 'a-2'),
      false,
    );
  });

  it('reports false and keeps the row when it belongs to another patient', async () => {
    const table = seeded();
    const removed = await repositoryOver(table).remove('x-1', MINE);
    assert.equal(removed, false);
    assert.equal(
      table.rows.some((row) => row.id === 'x-1'),
      true,
    );
  });
});

describe('alertRepository.replaceAll', () => {
  it('swaps only the rows of the given patient', async () => {
    const table = seeded();
    await repositoryOver(table).replaceAll(MINE, [
      { id: 'a-new', type: 'glucoseLow', timestampMs: T1 },
    ]);
    assert.deepEqual(
      table.rows.map((row) => row.id),
      ['x-1', 'a-new'],
    );
  });

  it('keeps the client-supplied id of every replaced row (API-01)', async () => {
    const table = seeded();
    await repositoryOver(table).replaceAll(MINE, [
      { id: 'a-keep-1', type: 'glucoseLow', timestampMs: T1 },
      { id: 'a-keep-2', type: 'glucoseHigh', timestampMs: T2 },
    ]);
    const page = await repositoryOver(table).findPage({ patientId: MINE, limit: 100 });
    assert.deepEqual(
      page.map((entry) => entry.id),
      ['a-keep-2', 'a-keep-1'],
    );
  });
});
