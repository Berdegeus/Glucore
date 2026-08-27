import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFakeTable, createFailingTable } from '../helpers/fakePrismaEvents.ts';
import type { CarbPrismaClient } from '../../src/repositories/carbRepository.ts';
import { createCarbRepository } from '../../src/repositories/carbRepository.ts';

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
      { id: 'c-2', patientId: MINE, carbsGrams: 20, description: 'lanche', eventAt: new Date(T2) },
      { id: 'c-3', patientId: MINE, carbsGrams: 30, description: 'jantar', eventAt: new Date(T3) },
      { id: 'c-1', patientId: MINE, carbsGrams: 10, description: 'café', eventAt: new Date(T1) },
      { id: 'x-1', patientId: OTHER, carbsGrams: 99, description: 'alheio', eventAt: new Date(T3) },
    ],
    'eventAt',
  );
}

function repositoryOver(table: ReturnType<typeof createFakeTable>) {
  return createCarbRepository({ carbEvent: table.delegate } as unknown as CarbPrismaClient);
}

describe('carbRepository.findPage', () => {
  it('returns the patient rows newest first, mapped to the API shape', async () => {
    const table = seeded();
    const page = await repositoryOver(table).findPage({ patientId: MINE, limit: 100 });
    assert.deepEqual(
      page.map((entry) => entry.id),
      ['c-3', 'c-2', 'c-1'],
    );
    assert.deepEqual(page[0], {
      id: 'c-3',
      grams: 30,
      description: 'jantar',
      timeMs: T3,
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
      ['c-3', 'c-2'],
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
      ['c-2', 'c-1'],
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
      ['c-3', 'c-2', 'c-1'],
    );
    assert.deepEqual(third, []);
  });

  it('propagates a database failure instead of swallowing it', async () => {
    const failure = new Error('database unreachable');
    const repository = createCarbRepository({
      carbEvent: createFailingTable(failure),
    } as unknown as CarbPrismaClient);
    await assert.rejects(
      () => repository.findPage({ patientId: MINE, limit: 100 }),
      /database unreachable/,
    );
  });
});

describe('carbRepository.create', () => {
  it('persists the entry under the given patient and keeps the client id', async () => {
    const table = seeded();
    const id = await repositoryOver(table).create(MINE, {
      id: 'c-9',
      grams: 45,
      description: 'almoço',
      timeMs: T2,
    });
    assert.equal(id, 'c-9');
    const stored = table.rows.find((row) => row.id === 'c-9');
    assert.deepEqual(
      {
        patientId: stored?.patientId,
        carbsGrams: stored?.carbsGrams,
        description: stored?.description,
        eventAt: (stored?.eventAt as Date).getTime(),
      },
      { patientId: MINE, carbsGrams: 45, description: 'almoço', eventAt: T2 },
    );
  });

  it('lets the database generate the id when the client sent none', async () => {
    const table = seeded();
    const id = await repositoryOver(table).create(MINE, {
      grams: 45,
      description: 'almoço',
      timeMs: T2,
    });
    assert.match(id, /^generated-/);
    assert.equal(table.rows.filter((row) => row.patientId === MINE).length, 4);
  });
});

describe('carbRepository.update', () => {
  it('writes the new values and reports true for a row of the patient', async () => {
    const table = seeded();
    const changed = await repositoryOver(table).update('c-1', MINE, {
      grams: 12,
      description: 'café reforçado',
      timeMs: T3,
    });
    assert.equal(changed, true);
    const stored = table.rows.find((row) => row.id === 'c-1');
    assert.deepEqual(
      {
        carbsGrams: stored?.carbsGrams,
        description: stored?.description,
        eventAt: (stored?.eventAt as Date).getTime(),
      },
      { carbsGrams: 12, description: 'café reforçado', eventAt: T3 },
    );
  });

  it('reports false and leaves the row untouched when it belongs to another patient', async () => {
    const table = seeded();
    const changed = await repositoryOver(table).update('x-1', MINE, {
      grams: 1,
      description: 'invadido',
      timeMs: T1,
    });
    assert.equal(changed, false);
    const stored = table.rows.find((row) => row.id === 'x-1');
    assert.equal(stored?.carbsGrams, 99);
    assert.equal(stored?.description, 'alheio');
  });
});

describe('carbRepository.remove', () => {
  it('deletes the row of the patient and reports true', async () => {
    const table = seeded();
    const removed = await repositoryOver(table).remove('c-2', MINE);
    assert.equal(removed, true);
    assert.equal(
      table.rows.some((row) => row.id === 'c-2'),
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

describe('carbRepository.replaceAll', () => {
  it('swaps only the rows of the given patient', async () => {
    const table = seeded();
    await repositoryOver(table).replaceAll(MINE, [
      { id: 'c-new', grams: 5, description: 'novo', timeMs: T1 },
    ]);
    assert.deepEqual(
      table.rows.map((row) => row.id),
      ['x-1', 'c-new'],
    );
  });
});
