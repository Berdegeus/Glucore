import { describe, expect, it } from 'vitest';
import { alertLabel } from './alertLabels';

describe('alertLabel (PAC-09)', () => {
  it.each([
    ['HYPO_RISK', 'Risco de hipoglicemia'],
    ['HYPER_RISK', 'Risco de hiperglicemia'],
    ['FAST_DROP', 'Queda rápida'],
    ['FAST_RISE', 'Subida rápida'],
    ['SENSOR_RECONNECTED', 'Sensor reconectado'],
    ['SYNC_FAILURE', 'Falha de sincronização'],
  ])('reads %s as "%s"', (type, label) => {
    expect(alertLabel(type)).toBe(label);
  });

  it.each(['NEW_KIND', '', 'constructor'])('shows the type "%s" as sent when it has no label', (type) => {
    expect(alertLabel(type)).toBe(type);
  });
});
