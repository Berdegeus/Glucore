import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFakeTable, createFailingTable } from '../helpers/fakePrismaEvents.ts';
import type { InsulinPrismaClient } from '../../src/repositories/insulinRepository.ts';
import { createInsulinRepository } from '../../src/repositories/insulinRepository.ts';

/**
 * Spec: arch-phases-3-5 — API-03 (paginação decrescente por paciente),
 * API-06 (o endpoint de coleção continua funcionando) e QUAL-01 (acesso a
 * dados fora do handler de rota, com client injetado).
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
      { id: 'i-2', patientId: MINE, doseUnits: 4, insulinType: 'bolus', eventAt: new Date(T2), dayOfWeek: 'TUESDAY' },
      { id: 'i-3', patientId: MINE, doseUnits: 6, insulinType: 'basal', eventAt: new Date(T3), dayOfWeek: 'WEDNESDAY' },
      { id: 'i-1', patientId: MINE, doseUnits: 2, insulinType: 'bolus', eventAt: new Date(T1), dayOfWeek: 'MONDAY' },
      { id: 'x-1', patientId: OTHER, doseUnits: 99, insulinType: 'alheio', eventAt: new Date(T3), dayOfWeek: 'FRIDAY' },
    ],
    'eventAt',
  );
}

function repositoryOver(table: ReturnType<typeof createFakeTable>) {
  return createInsulinRepository({
    insulinEvent: table.delegate,
  } as unknown as InsulinPrismaClient);
}

describe('insulinRepository.findPage', () => {
  it('returns the patient rows newest first, mapped to the API shape', async () => {
    const table = seeded();
    const page = await repositoryOver(table).findPage({ patientId: MINE, limit: 100 });
    assert.deepEqual(
      page.map((entry) => entry.id),
      ['i-3', 'i-2', 'i-1'],
    );
    assert.deepEqual(page[0], {
      id: 'i-3',
      units: 6,
      type: 'basal',
      timeMs: T3,
      dayOfWeek: 'WEDNESDAY',
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
      ['i-3', 'i-2'],
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
      ['i-2', 'i-1'],
    );
  });

  it('walks the whole history page by page without repeating or skipping', async () => {
    const repository = repositoryOver(seeded());
    const first = await repository.findPage({ patientId: MINE, limit: 2 });
    const second = await repository.findPage({
      patientId: MINE,
      before: first[first.length - 1].timeMs,
      limit: 2,
    });
    const third = await repository.findPage({
      patientId: MINE,
      before: second[second.length - 1].timeMs,
      limit: 2,
    });
    assert.deepEqual(
      [...first, ...second].map((entry) => entry.id),
      ['i-3', 'i-2', 'i-1'],
    );
    assert.deepEqual(third, []);
  });

  it('propagates a database failure instead of swallowing it', async () => {
    const failure = new Error('database unreachable');
    const repository = createInsulinRepository({
      insulinEvent: createFailingTable(failure),
    } as unknown as InsulinPrismaClient);
    await assert.rejects(
      () => repository.findPage({ patientId: MINE, limit: 100 }),
      /database unreachable/,
    );
  });
});

describe('insulinRepository.create', () => {
  it('persists the entry under the given patient and keeps the client id', async () => {
    const table = seeded();
    const id = await repositoryOver(table).create(MINE, {
      id: 'i-9',
      units: 8,
      type: 'bolus',
      timeMs: T2,
      dayOfWeek: 'THURSDAY',
    });
    assert.equal(id, 'i-9');
    const stored = table.rows.find((row) => row.id === 'i-9');
    assert.deepEqual(
      {
        patientId: stored?.patientId,
        doseUnits: stored?.doseUnits,
        insulinType: stored?.insulinType,
        eventAt: (stored?.eventAt as Date).getTime(),
        dayOfWeek: stored?.dayOfWeek,
      },
      { patientId: MINE, doseUnits: 8, insulinType: 'bolus', eventAt: T2, dayOfWeek: 'THURSDAY' },
    );
  });

  it('stores an empty dayOfWeek when the caller omitted it', async () => {
    const table = seeded();
    await repositoryOver(table).create(MINE, {
      id: 'i-10',
      units: 3,
      type: 'basal',
      timeMs: T1,
    });
    assert.equal(table.rows.find((row) => row.id === 'i-10')?.dayOfWeek, '');
  });

  it('lets the database generate the id when the client sent none', async () => {
    const table = seeded();
    const id = await repositoryOver(table).create(MINE, {
      units: 5,
      type: 'bolus',
      timeMs: T2,
    });
    assert.match(id, /^generated-/);
    assert.equal(table.rows.filter((row) => row.patientId === MINE).length, 4);
  });
});

describe('insulinRepository.update', () => {
  it('writes the new values and reports true for a row of the patient', async () => {
    const table = seeded();
    const changed = await repositoryOver(table).update('i-1', MINE, {
      units: 12,
      type: 'basal',
      timeMs: T3,
      dayOfWeek: 'SUNDAY',
    });
    assert.equal(changed, true);
    const stored = table.rows.find((row) => row.id === 'i-1');
    assert.deepEqual(
      {
        doseUnits: stored?.doseUnits,
        insulinType: stored?.insulinType,
        eventAt: (stored?.eventAt as Date).getTime(),
        dayOfWeek: stored?.dayOfWeek,
      },
      { doseUnits: 12, insulinType: 'basal', eventAt: T3, dayOfWeek: 'SUNDAY' },
    );
  });

  it('reports false and leaves the row untouched when it belongs to another patient', async () => {
    const table = seeded();
    const changed = await repositoryOver(table).update('x-1', MINE, {
      units: 1,
      type: 'invadido',
      timeMs: T1,
    });
    assert.equal(changed, false);
    const stored = table.rows.find((row) => row.id === 'x-1');
    assert.equal(stored?.doseUnits, 99);
    assert.equal(stored?.insulinType, 'alheio');
  });
});

describe('insulinRepository.remove', () => {
  it('deletes the row of the patient and reports true', async () => {
    const table = seeded();
    const removed = await repositoryOver(table).remove('i-2', MINE);
    assert.equal(removed, true);
    assert.equal(
      table.rows.some((row) => row.id === 'i-2'),
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

describe('insulinRepository.replaceAll', () => {
  it('swaps only the rows of the given patient', async () => {
    const table = seeded();
    await repositoryOver(table).replaceAll(MINE, [
      { id: 'i-new', units: 5, type: 'bolus', timeMs: T1 },
    ]);
    assert.deepEqual(
      table.rows.map((row) => row.id),
      ['x-1', 'i-new'],
    );
  });
});
