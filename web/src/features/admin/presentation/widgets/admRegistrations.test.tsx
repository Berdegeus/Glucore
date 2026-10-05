import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overviewOf } from '../../../../test/adminFakes';
import { describeAdminChart, renderAdminWidget, renderDrawnChart } from '../../../../test/adminWidgetHarness';
import AdmRegistrations, { ADM_REGISTRATIONS_TITLE, admRegistrationsDefinition } from './admRegistrations';

describeAdminChart({
  Widget: AdmRegistrations,
  definition: admRegistrationsDefinition,
  title: ADM_REGISTRATIONS_TITLE,
  emptyCause: 'Sem dados no período',
  summary: 'Cadastros por dia, 9 no total, de 05/08 a 06/08.',
  columns: ['Dia', 'Cadastros'],
  rows: [
    ['05/08/2026', '4'],
    ['06/08/2026', '5'],
  ],
});

describe('adm-registrations figure (ADM-02)', () => {
  it('draws one line with a point for each day, named by its day and month', async () => {
    const { all, axisLabels } = await renderDrawnChart(<AdmRegistrations size="M" />);

    expect(all('.recharts-line-curve')).toHaveLength(1);
    expect(all('.recharts-area-area')).toHaveLength(0);
    expect(axisLabels()).toEqual(['05/08', '06/08']);
  });

  it('keeps a day with no registration on the line, at zero, and still draws', async () => {
    const registrationsByDay = [
      { day: '2026-08-05', count: 0 },
      { day: '2026-08-06', count: 3 },
    ];
    const { axisLabels } = await renderDrawnChart(<AdmRegistrations size="M" />, { overview: overviewOf({ registrationsByDay }) });

    expect(axisLabels()).toEqual(['05/08', '06/08']);
    expect(screen.getByRole('img', { name: 'Cadastros por dia, 3 no total, de 05/08 a 06/08.' })).toBeInTheDocument();
  });

  it('says it has no data, not a flat line, when no account was created in the period', async () => {
    const registrationsByDay = [{ day: '2026-08-05', count: 0 }];
    renderAdminWidget(<AdmRegistrations size="M" />, { overview: overviewOf({ registrationsByDay }) });

    expect(await screen.findByText('Sem dados no período')).toBeInTheDocument();
  });
});
