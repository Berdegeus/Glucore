import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overviewOf } from '../../../../test/adminFakes';
import { describeAdminChart, renderAdminWidget, renderDrawnChart } from '../../../../test/adminWidgetHarness';
import AdmAlerts, { ADM_ALERTS_TITLE, admAlertsDefinition } from './admAlerts';

// The fixture carries two types the app does not name, so the fallback to the raw value shows too.
describeAdminChart({
  Widget: AdmAlerts,
  definition: admAlertsDefinition,
  title: ADM_ALERTS_TITLE,
  emptyCause: 'Sem dados no período',
  summary: 'Alertas da plataforma por tipo, 61 no total: LOW 21; HIGH 40.',
  columns: ['Tipo', 'Alertas'],
  rows: [
    ['LOW', '21'],
    ['HIGH', '40'],
  ],
});

const KNOWN = [
  { alertType: 'HYPO_RISK', count: 7 },
  { alertType: 'SYNC_FAILURE', count: 3 },
  { alertType: 'NEW_KIND', count: 1 },
];

describe('adm-alerts figure (ADM-02)', () => {
  it('draws one bar per alert type', async () => {
    const { all } = await renderDrawnChart(<AdmAlerts size="M" />);

    expect(all('.recharts-bar-rectangle')).toHaveLength(2);
  });

  it('names the types as the patient reads them and falls back to the raw value for an unknown one', async () => {
    const { axisLabels } = await renderDrawnChart(<AdmAlerts size="M" />, { overview: overviewOf({ alertsByType: KNOWN }) });

    expect(axisLabels()).toEqual(['Risco de hipoglicemia', 'Falha de sincronização', 'NEW_KIND']);
  });

  it('says it has no data when the platform raised no alert', async () => {
    renderAdminWidget(<AdmAlerts size="M" />, { overview: overviewOf({ alertsByType: [] }) });

    expect(await screen.findByText('Sem dados no período')).toBeInTheDocument();
  });
});
