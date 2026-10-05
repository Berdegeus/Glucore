import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { summaryFixture } from '../../../../test/summaryFakes';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartInsulinType, { chartInsulinTypeDefinition, CHART_INSULIN_TYPE_TITLE, NO_INSULIN_CAUSE } from './chartInsulinType';

const NBSP = '\u00a0';

describeChartWidget({
  Widget: ChartInsulinType,
  definition: chartInsulinTypeDefinition,
  title: CHART_INSULIN_TYPE_TITLE,
  emptyCause: NO_INSULIN_CAUSE,
  summary: `Insulina total por tipo: RAPID 30,0${NBSP}U em 3${NBSP}registros.`,
  columns: ['Tipo', 'Total', 'Registros'],
  rows: [['RAPID', `30,0${NBSP}U`, '3']],
});

describe('chart-insulin-type figure (PAC-09)', () => {
  it('draws one bar per insulin type', async () => {
    const insulinByType = [
      { insulinType: 'RAPID', totalUnits: 30, count: 3, avgUnits: 10 },
      { insulinType: 'BASAL', totalUnits: 20, count: 1, avgUnits: 20 },
    ];
    const { container } = renderWidget(<ChartInsulinType size="M" />, { summary: summaryFixture({ insulinByType }) });

    await screen.findByRole('img');
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2);
  });

  it('says there is no insulin record, not that there are no readings, when only the insulin is missing', async () => {
    renderWidget(<ChartInsulinType size="M" />, { summary: summaryFixture({ insulinByType: [] }) });

    expect(await screen.findByText('Nenhum registro de insulina no período')).toBeInTheDocument();
  });
});
