import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { overviewOf } from '../../../../test/adminFakes';
import { describeAdminChart, renderAdminWidget, renderDrawnChart } from '../../../../test/adminWidgetHarness';
import AdmGrants, { ADM_GRANTS_TITLE, admGrantsDefinition } from './admGrants';

describeAdminChart({
  Widget: AdmGrants,
  definition: admGrantsDefinition,
  title: ADM_GRANTS_TITLE,
  emptyCause: 'Sem dados no período',
  summary: 'Vínculos criados por semana, 5 no total, de 27/07 a 03/08.',
  columns: ['Semana iniciada em', 'Vínculos'],
  rows: [
    ['27/07/2026', '3'],
    ['03/08/2026', '2'],
  ],
});

describe('adm-grants figure (ADM-02)', () => {
  it('draws one line with a point for each week, named by the day the week starts', async () => {
    const { all, axisLabels } = await renderDrawnChart(<AdmGrants size="M" />);

    expect(all('.recharts-line-curve')).toHaveLength(1);
    expect(axisLabels()).toEqual(['27/07', '03/08']);
  });

  it('draws a week with no new link at zero', async () => {
    const createdByWeek = [
      { weekStart: '2026-07-27', count: 0 },
      { weekStart: '2026-08-03', count: 4 },
    ];
    renderAdminWidget(<AdmGrants size="M" />, { overview: overviewOf({ grants: { active: 14, createdByWeek } }) });

    expect(await screen.findByRole('img', { name: 'Vínculos criados por semana, 4 no total, de 27/07 a 03/08.' })).toBeInTheDocument();
  });

  it('counts the links created in the weeks, not the ones active now', async () => {
    const createdByWeek = [{ weekStart: '2026-08-03', count: 2 }];
    renderAdminWidget(<AdmGrants size="M" />, { overview: overviewOf({ grants: { active: 870, createdByWeek } }) });

    expect(await screen.findByRole('img', { name: 'Vínculos criados por semana, 2 no total, de 03/08 a 03/08.' })).toBeInTheDocument();
  });
});
