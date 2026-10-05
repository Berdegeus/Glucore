import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { ChartFrame, TABLE_TOGGLE_LABEL } from './chartFrame';

const SUMMARY = 'Tempo no alvo por dia: 62 % na segunda e 70 % na terça.';
const COLUMNS = ['Dia', 'Tempo no alvo'];
const ROWS = [
  ['seg', '62,0 %'],
  ['ter', '70,0 %'],
];

function renderFrame() {
  return render(
    <ChartFrame title="Tempo no alvo" summary={SUMMARY} columns={COLUMNS} rows={ROWS}>
      <svg data-testid="chart" />
    </ChartFrame>,
  );
}

const toggle = () => screen.getByRole('button', { name: TABLE_TOGGLE_LABEL });

describe('ChartFrame', () => {
  it('shows the title and the chart as one image labelled with the summary (RSP-07)', () => {
    renderFrame();
    expect(screen.getByRole('heading', { name: 'Tempo no alvo' })).toBeInTheDocument();
    const image = screen.getByRole('img', { name: SUMMARY });
    expect(within(image).getByTestId('chart')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('offers the table view as an unpressed toggle named "Ver como tabela" (RSP-07)', () => {
    renderFrame();
    expect(TABLE_TOGGLE_LABEL).toBe('Ver como tabela');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('swaps the chart for a table with the received columns and rows (RSP-07)', async () => {
    renderFrame();
    await userEvent.setup().click(toggle());

    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Tempo no alvo' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(COLUMNS);
    const body = within(table).getAllByRole('row').slice(1);
    expect(body.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual(ROWS);
  });

  it('names the table with the caption it is given instead of the title (RSP-07)', async () => {
    render(
      <ChartFrame title="Carboidratos e insulina" summary={SUMMARY} columns={COLUMNS} rows={ROWS} tableCaption="Valores em unidades diferentes">
        <svg />
      </ChartFrame>,
    );
    await userEvent.setup().click(toggle());

    expect(screen.getByRole('table', { name: 'Valores em unidades diferentes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Carboidratos e insulina' })).toBeInTheDocument();
  });

  it('goes back to the chart when toggled again', async () => {
    renderFrame();
    const user = userEvent.setup();
    await user.click(toggle());
    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('img', { name: SUMMARY })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('toggles with the keyboard (RSP-06)', async () => {
    renderFrame();
    const user = userEvent.setup();
    await user.tab();
    expect(toggle()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('table')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('has no axe violations as a chart and as a table (RSP-07)', async () => {
    const { container } = renderFrame();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.setup().click(toggle());
    expect(await axe(container)).toHaveNoViolations();
  });
});
