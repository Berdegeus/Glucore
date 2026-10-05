import { describe, expect, it } from 'vitest';
import { alertsTypeAlternative, alertsTypeRows } from './alertsTypeModel';

const NBSP = '\u00a0';
const BY_TYPE = [
  { alertType: 'FAST_DROP', count: 2 },
  { alertType: 'SYNC_FAILURE', count: 1 },
  { alertType: 'SOMETHING_NEW', count: 4 },
];

describe('alerts by type model (PAC-09)', () => {
  it('names each type in words and keeps one the table does not know as sent', () => {
    expect(alertsTypeRows(BY_TYPE)).toEqual([
      { type: 'Queda rápida', count: 2 },
      { type: 'Falha de sincronização', count: 1 },
      { type: 'SOMETHING_NEW', count: 4 },
    ]);
  });

  it('lists the same names and counts in the table', () => {
    expect(alertsTypeAlternative(BY_TYPE).rows).toEqual([
      ['Queda rápida', '2'],
      ['Falha de sincronização', '1'],
      ['SOMETHING_NEW', '4'],
    ]);
  });

  it.each([
    { types: BY_TYPE, sentence: `Alertas por tipo, 7${NBSP}alertas no período: Queda rápida 2; Falha de sincronização 1; SOMETHING_NEW 4.` },
    { types: [{ alertType: 'SYNC_FAILURE', count: 1 }], sentence: `Alertas por tipo, 1${NBSP}alerta no período: Falha de sincronização 1.` },
  ])('summarizes the counts in one sentence: $sentence', ({ types, sentence }) => {
    expect(alertsTypeAlternative(types).summary).toBe(sentence);
  });
});
