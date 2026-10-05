import { describe, expect, it } from 'vitest';
import { filterPatients, sortPatients, SORT_COLUMNS, type ListedPatient, type SortColumn } from './patientList';

function patient(id: string, overrides: Partial<ListedPatient> = {}): ListedPatient & { id: string } {
  return {
    id,
    fullName: id,
    initials: id.slice(0, 2).toUpperCase(),
    lastReadingAt: '2026-08-05T12:00:00.000Z',
    timeInRangePercent: 80,
    gmiPercent: 6.8,
    cvPercent: 30,
    sensorUsePercent: 95,
    zoneDistribution: { veryLow: 0, low: 0, target: 80, high: 20, veryHigh: 0 },
    hypoEpisodes: 0,
    alertsCount: 0,
    ...overrides,
  };
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe('filterPatients (PRO-06)', () => {
  const joao = patient('joao', { fullName: 'João da Silva' });
  const maria = patient('maria', { fullName: 'Maria Souza', timeInRangePercent: 40 });
  const anon = patient('anon', { fullName: null, initials: 'AB' });
  const rows = [joao, maria, anon];

  it('finds "João" with "joao", ignoring case and accents, and with "JOÃO"', () => {
    expect(ids(filterPatients(rows, { query: 'joao' }))).toEqual(['joao']);
    expect(ids(filterPatients(rows, { query: 'JOÃO' }))).toEqual(['joao']);
    expect(ids(filterPatients(rows, { query: ' da silva ' }))).toEqual(['joao']);
  });

  it('matches the initials of a patient with no name, and only theirs', () => {
    expect(ids(filterPatients(rows, { query: 'ab' }))).toEqual(['anon']);
    expect(ids(filterPatients(rows, { query: 'jo' }))).toEqual(['joao']);
  });

  it('keeps only the patients of the chosen risk level', () => {
    expect(ids(filterPatients(rows, { risk: 'HIGH' }))).toEqual(['maria']);
    expect(ids(filterPatients(rows, { risk: 'OK' }))).toEqual(['joao', 'anon']);
    expect(ids(filterPatients(rows, { risk: 'INSUFFICIENT' }))).toEqual([]);
  });

  it('combines risk and name', () => {
    expect(ids(filterPatients(rows, { risk: 'HIGH', query: 'maria' }))).toEqual(['maria']);
    expect(ids(filterPatients(rows, { risk: 'HIGH', query: 'joao' }))).toEqual([]);
  });

  it('returns every row, in order, for no filter or a blank query, without changing the input', () => {
    expect(ids(filterPatients(rows))).toEqual(['joao', 'maria', 'anon']);
    expect(ids(filterPatients(rows, { query: '   ' }))).toEqual(['joao', 'maria', 'anon']);
    expect(rows).toHaveLength(3);
  });
});

describe('sortPatients (PRO-07)', () => {
  const rows = [
    patient('b', { timeInRangePercent: 60, lastReadingAt: '2026-08-05T10:00:00.000Z' }),
    patient('none', { timeInRangePercent: null, lastReadingAt: null }),
    patient('c', { timeInRangePercent: 90, lastReadingAt: '2026-08-05T09:00:00.000Z' }),
    patient('a', { timeInRangePercent: 75, lastReadingAt: '2026-08-05T11:00:00.000Z' }),
  ];

  it('sorts by TIR in both directions, the patient with none last in each', () => {
    expect(ids(sortPatients(rows, 'timeInRangePercent', 'asc'))).toEqual(['b', 'a', 'c', 'none']);
    expect(ids(sortPatients(rows, 'timeInRangePercent', 'desc'))).toEqual(['c', 'a', 'b', 'none']);
  });

  it('sorts by the last reading in both directions, the patient with no reading last in each', () => {
    expect(ids(sortPatients(rows, 'lastReadingAt', 'asc'))).toEqual(['c', 'b', 'a', 'none']);
    expect(ids(sortPatients(rows, 'lastReadingAt', 'desc'))).toEqual(['a', 'b', 'c', 'none']);
  });

  it('sorts by name ignoring accents and case, a patient with no name last', () => {
    const named = [
      patient('1', { fullName: 'zélia' }),
      patient('2', { fullName: null }),
      patient('3', { fullName: 'Álvaro' }),
      patient('4', { fullName: 'beto' }),
    ];
    expect(ids(sortPatients(named, 'name', 'asc'))).toEqual(['3', '4', '1', '2']);
    expect(ids(sortPatients(named, 'name', 'desc'))).toEqual(['1', '4', '3', '2']);
  });

  it('puts HIGH first when sorting the risk ascending, and insufficient data last', () => {
    const risky = [
      patient('ok'),
      patient('insufficient', { sensorUsePercent: 10 }),
      patient('high', { timeInRangePercent: 30 }),
      patient('attention', { timeInRangePercent: 65 }),
    ];
    expect(ids(sortPatients(risky, 'risk', 'asc'))).toEqual(['high', 'attention', 'ok', 'insufficient']);
    expect(ids(sortPatients(risky, 'risk', 'desc'))).toEqual(['insufficient', 'ok', 'attention', 'high']);
  });

  it.each<[SortColumn]>([['gmiPercent'], ['cvPercent'], ['hypoEpisodes'], ['alertsCount']])(
    'sorts by %s, lowest first ascending',
    (column) => {
      const input = [3, 1, 2].map((value, index) => patient(String(index), { [column]: value }));
      expect(ids(sortPatients(input, column, 'asc'))).toEqual(['1', '2', '0']);
      expect(ids(sortPatients(input, column, 'desc'))).toEqual(['0', '2', '1']);
    },
  );

  it('keeps rows that tie in their order, in both directions, and leaves the input alone', () => {
    const tied = [patient('x', { alertsCount: 1 }), patient('y', { alertsCount: 1 }), patient('z', { alertsCount: 0 })];
    expect(ids(sortPatients(tied, 'alertsCount', 'asc'))).toEqual(['z', 'x', 'y']);
    expect(ids(sortPatients(tied, 'alertsCount', 'desc'))).toEqual(['x', 'y', 'z']);
    expect(ids(tied)).toEqual(['x', 'y', 'z']);
  });

  it('offers every column of the table', () => {
    expect([...SORT_COLUMNS].sort()).toEqual([
      'alertsCount',
      'cvPercent',
      'gmiPercent',
      'hypoEpisodes',
      'lastReadingAt',
      'name',
      'risk',
      'timeInRangePercent',
    ]);
  });
});
