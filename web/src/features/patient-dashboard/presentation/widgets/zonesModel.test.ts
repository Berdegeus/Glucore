import { describe, expect, it } from 'vitest';
import { ZONE_COLORS } from '../../../../shared/presentation/charts/palette';
import { ZONE_LABELS, ZONE_SEGMENTS, zonesAlternative, zonesRow } from './zonesModel';

const NBSP = '\u00a0';
const DISTRIBUTION = { veryLow: 1.25, low: 5, target: 62.5, high: 25, veryHigh: 6.25 };

describe('zones model (PAC-10)', () => {
  it('orders the segments from very low to very high, each in its zone color', () => {
    expect(ZONE_SEGMENTS.map(({ key, label, color }) => [key, label, color])).toEqual([
      ['veryLow', 'Muito baixa', ZONE_COLORS[0]],
      ['low', 'Baixa', ZONE_COLORS[1]],
      ['target', 'No alvo', ZONE_COLORS[2]],
      ['high', 'Alta', ZONE_COLORS[3]],
      ['veryHigh', 'Muito alta', ZONE_COLORS[4]],
    ]);
    expect(Object.keys(ZONE_LABELS)).toEqual(ZONE_SEGMENTS.map((segment) => segment.key));
  });

  it('draws the five shares in one row', () => {
    expect(zonesRow(DISTRIBUTION)).toEqual({ period: 'Período', ...DISTRIBUTION });
  });

  it('lists each zone with its percentage, in zone order', () => {
    expect(zonesAlternative(DISTRIBUTION).rows).toEqual([
      ['Muito baixa', `1,3${NBSP}%`],
      ['Baixa', `5,0${NBSP}%`],
      ['No alvo', `62,5${NBSP}%`],
      ['Alta', `25,0${NBSP}%`],
      ['Muito alta', `6,3${NBSP}%`],
    ]);
  });

  it('summarizes the five shares in one sentence', () => {
    expect(zonesAlternative(DISTRIBUTION).summary).toBe(
      `Distribuição do tempo em cinco zonas de glicose: muito baixa 1,3${NBSP}%, baixa 5,0${NBSP}%, no alvo 62,5${NBSP}%, alta 25,0${NBSP}%, muito alta 6,3${NBSP}%.`,
    );
  });
});
