import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { daysWithReadings, summaryFixture } from '../../../../test/summaryFakes';
import { describeChartWidget, renderWidget } from '../../../../test/widgetHarness';
import ChartDailyTir, { chartDailyTirDefinition, CHART_DAILY_TIR_TITLE } from './chartDailyTir';

const NBSP = ' ';

describeChartWidget({
  Widget: ChartDailyTir,
  definition: chartDailyTirDefinition,
  title: CHART_DAILY_TIR_TITLE,
  summary: `Tempo no alvo por dia, de 05/08 a 06/08: 21,4${NBSP}%.`,
  columns: ['Dia', 'Tempo no alvo'],
  rows: [
    ['05/08/2026', `21,4${NBSP}%`],
    ['06/08/2026', '—'],
  ],
});

describe('chart-daily-tir figure (PAC-07)', () => {
  it('draws one bar per day with a percentage and none for a day with no readings', async () => {
    const { container } = renderWidget(<ChartDailyTir size="M" />);

    await screen.findByRole('img');
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(1);
  });

  it('draws a bar for every day of a period that has readings each day', async () => {
    const { container } = renderWidget(<ChartDailyTir size="M" />, { summary: summaryFixture({ byDay: daysWithReadings(5) }) });

    await screen.findByRole('img');
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(5);
  });
});
