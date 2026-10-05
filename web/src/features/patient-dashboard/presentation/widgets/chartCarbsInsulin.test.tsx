import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dayBucket, summaryFixture } from '../../../../test/summaryFakes';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartCarbsInsulin, { chartCarbsInsulinDefinition, CHART_CARBS_INSULIN_TITLE, NO_DIARY_CAUSE } from './chartCarbsInsulin';

const NBSP = '\u00a0';

describeChartWidget({
  Widget: ChartCarbsInsulin,
  definition: chartCarbsInsulinDefinition,
  title: CHART_CARBS_INSULIN_TITLE,
  emptyCause: NO_DIARY_CAUSE,
  tableName: 'Carboidratos em gramas e insulina em unidades, por dia',
  summary: `Carboidratos e insulina por dia, de 05/08 a 06/08: carboidratos 30${NBSP}g a 105${NBSP}g, insulina 0,0${NBSP}U a 30,0${NBSP}U; valores em unidades diferentes; veja a tabela.`,
  columns: ['Dia', 'Carboidratos', 'Insulina'],
  rows: [
    ['05/08/2026', `105${NBSP}g`, `30,0${NBSP}U`],
    ['06/08/2026', `30${NBSP}g`, `0,0${NBSP}U`],
  ],
});

describe('chart-carbs-insulin figure (PAC-10)', () => {
  it('names both series with their unit in the legend', async () => {
    renderWidget(<ChartCarbsInsulin size="M" />);

    const region = within(await screen.findByRole('region', { name: CHART_CARBS_INSULIN_TITLE }));
    const legend = (await region.findAllByRole('listitem')).map((item) => item.textContent);
    expect(legend).toEqual(['Carboidratos (g)', 'Insulina (U)']);
  });

  it('draws a pair of bars for every day, including a day with only diary entries and no reading', async () => {
    const byDay = [dayBucket({ day: '2026-07-01', carbsGrams: 50, insulinUnits: 4 }), dayBucket({ day: '2026-07-02', avgGlucose: null, readingsCount: 0, carbsGrams: 30, insulinUnits: 2 })];
    const { container } = renderWidget(<ChartCarbsInsulin size="M" />, { summary: summaryFixture({ byDay }) });

    await screen.findByRole('img');
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(4);
  });

  it('says there is no diary record, not that there are no readings, when only the diary is empty', async () => {
    const byDay = [dayBucket({ carbsGrams: 0, insulinUnits: 0 })];
    renderWidget(<ChartCarbsInsulin size="M" />, { summary: summaryFixture({ byDay }) });

    expect(await screen.findByText('Nenhum registro de carboidrato ou insulina no período')).toBeInTheDocument();
  });
});
