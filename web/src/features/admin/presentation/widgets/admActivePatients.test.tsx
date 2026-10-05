import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overviewOf } from '../../../../test/adminFakes';
import { describeAdminChart, renderAdminWidget, renderDrawnChart } from '../../../../test/adminWidgetHarness';
import AdmActivePatients, { ADM_ACTIVE_PATIENTS_TITLE, admActivePatientsDefinition } from './admActivePatients';

describeAdminChart({
  Widget: AdmActivePatients,
  definition: admActivePatientsDefinition,
  title: ADM_ACTIVE_PATIENTS_TITLE,
  emptyCause: 'Sem dados no período',
  summary: 'Pacientes cadastrados e ativos: Cadastrados 35; Ativos 24 h 18; Ativos 7 dias 27.',
  columns: ['Grupo', 'Pacientes'],
  rows: [
    ['Cadastrados', '35'],
    ['Ativos 24 h', '18'],
    ['Ativos 7 dias', '27'],
  ],
});

describe('adm-active-patients figure (ADM-02)', () => {
  it('draws three bars: registered, active in 24 hours and active in 7 days, in that order', async () => {
    const { all, axisLabels } = await renderDrawnChart(<AdmActivePatients size="M" />);

    expect(all('.recharts-bar-rectangle')).toHaveLength(3);
    expect(axisLabels()).toEqual(['Cadastrados', 'Ativos 24 h', 'Ativos 7 dias']);
  });

  it('reads each bar from its own count of the overview', async () => {
    const activePatients = { last24h: 2, last7d: 5, registered: 9 };
    renderAdminWidget(<AdmActivePatients size="M" />, { overview: overviewOf({ activePatients }) });

    expect(await screen.findByRole('img', { name: 'Pacientes cadastrados e ativos: Cadastrados 9; Ativos 24 h 2; Ativos 7 dias 5.' })).toBeInTheDocument();
  });

  it('still draws when patients are registered but none was active', async () => {
    const activePatients = { last24h: 0, last7d: 0, registered: 4 };
    renderAdminWidget(<AdmActivePatients size="M" />, { overview: overviewOf({ activePatients }) });

    expect(await screen.findByRole('button', { name: 'Ver como tabela' })).toBeInTheDocument();
    expect(screen.queryByText('Sem dados no período')).not.toBeInTheDocument();
  });
});
