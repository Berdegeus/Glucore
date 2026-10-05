import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TABLE_TOGGLE_LABEL } from '../../../../shared/presentation/charts/chartFrame';
import { emptyPeriodSummary, expectSkeletonOfSize, renderWidget } from '../../../../test/widgetHarness';
import { defineChartWidget, defineSummaryWidget } from './defineSummaryWidget';
import { NO_READINGS_CAUSE } from './summaryWidget';

// What a widget gets for the three lines of `defineSummaryWidget` and
// `defineChartWidget` (PAC-17, RSP-07): the grid's size, the one summary, the
// shell's states and, for a chart, the frame with its alternatives.

const TITLE = 'Widget de teste';
const CAUSE = 'Sem episódios';
const card = () => screen.findByRole('region', { name: TITLE });

const Kpi = defineSummaryWidget({
  title: TITLE,
  isEmpty: (summary) => summary.gmiPercent === null,
  render: (summary) => <p>GMI {summary.gmiPercent}</p>,
});

const Chart = defineChartWidget({
  title: TITLE,
  alternative: (summary) => ({ summary: `${summary.byDay.length} dias`, columns: ['Dia'], rows: summary.byDay.map((day) => [day.day]) }),
  chart: (summary) => <p>{summary.byDay.length} barras</p>,
});

describe('defineSummaryWidget', () => {
  it('renders the figure from the summary in a card named by the title', async () => {
    renderWidget(<Kpi size="S" />);

    expect(await within(await card()).findByText('GMI 6.9')).toBeInTheDocument();
  });

  it('hands the grid size to the shell: the skeleton has the height of that size while loading', () => {
    renderWidget(<Kpi size="M" />, { load: () => new Promise(() => undefined) });

    expectSkeletonOfSize('M');
  });

  it('gives "Sem leituras no período" when the widget is empty and names no cause', async () => {
    renderWidget(<Kpi size="S" />, { summary: emptyPeriodSummary() });

    expect(await within(await card()).findByText(NO_READINGS_CAUSE)).toBeInTheDocument();
    expect(screen.queryByText(/GMI/)).not.toBeInTheDocument();
  });

  it('gives the cause the widget names instead', async () => {
    const Episodes = defineSummaryWidget({ title: TITLE, isEmpty: () => true, emptyCause: CAUSE, render: () => <p>nunca</p> });
    renderWidget(<Episodes size="S" />);

    expect(await within(await card()).findByText(CAUSE)).toBeInTheDocument();
    expect(screen.queryByText(NO_READINGS_CAUSE)).not.toBeInTheDocument();
  });
});

describe('defineChartWidget', () => {
  it('draws the chart inside the frame, with its text summary and its table alternative', async () => {
    renderWidget(<Chart size="L" />);

    const region = within(await card());
    expect(await region.findByRole('img', { name: '2 dias' })).toHaveTextContent('2 barras');

    await userEvent.setup().click(region.getByRole('button', { name: TABLE_TOGGLE_LABEL }));

    const cells = within(region.getByRole('table', { name: TITLE })).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual(['2026-08-05', '2026-08-06']);
  });

  it('is empty when the period has no readings, unless the widget says otherwise', async () => {
    renderWidget(<Chart size="L" />, { summary: emptyPeriodSummary() });

    expect(await within(await card()).findByText(NO_READINGS_CAUSE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TABLE_TOGGLE_LABEL })).not.toBeInTheDocument();
  });

  it('uses the emptiness test and the cause the widget gives', async () => {
    const Alerts = defineChartWidget({
      title: TITLE,
      isEmpty: (summary) => summary.alertsByType.length === 0,
      emptyCause: CAUSE,
      alternative: () => ({ summary: 'x', columns: [], rows: [] }),
      chart: () => <p>nunca</p>,
    });
    renderWidget(<Alerts size="L" />, { summary: { ...emptyPeriodSummary(), totals: { ...emptyPeriodSummary().totals, readingsCount: 17 } } });

    expect(await within(await card()).findByText(CAUSE)).toBeInTheDocument();
    expect(screen.queryByText(NO_READINGS_CAUSE)).not.toBeInTheDocument();
  });
});
