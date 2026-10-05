/// <reference types="node" />
import { screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeZone } from '../../../../test/browserTimeZone';
import { summaryFixture } from '../../../../test/summaryFakes';
import { describeSummaryWidget, renderWidget } from '../../../../test/widgetHarness';
import TableExcursions, {
  EXCURSIONS_SCROLL_LABEL,
  NO_EXCURSIONS_CAUSE,
  tableExcursionsDefinition,
  TABLE_EXCURSIONS_TITLE,
} from './tableExcursions';

const NBSP = '\u00a0';
const css = readFileSync(join(import.meta.dirname, 'tableExcursions.module.css'), 'utf8');

afterEach(() => vi.restoreAllMocks());

describeSummaryWidget({
  Widget: TableExcursions,
  definition: tableExcursionsDefinition,
  title: TABLE_EXCURSIONS_TITLE,
  shown: 'Hipoglicemia',
  emptyCause: NO_EXCURSIONS_CAUSE,
});

describe('table-excursions rows (PAC-08)', () => {
  it('lists each episode with type, start, duration, minimum and maximum, on the browser clock', async () => {
    withTimeZone('America/Sao_Paulo');
    renderWidget(<TableExcursions size="L" />);

    const table = await screen.findByRole('table', { name: TABLE_EXCURSIONS_TITLE });
    const rows = within(table).getAllByRole('row');
    expect(rows.map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent))).toEqual([
      ['Tipo', 'Início', 'Duração', 'Mínimo', 'Máximo'],
      ['Hipoglicemia', '05/08/2026 05:00', '30 min', `55${NBSP}mg/dL`, `65${NBSP}mg/dL`],
    ]);
  });

  it('writes both kinds out in words and keeps the order of the summary', async () => {
    const highAt = '2026-08-05T20:00:00.000Z';
    const high = { kind: 'HYPER' as const, startedAt: highAt, endedAt: highAt, durationMin: 90, minGlucose: 190, maxGlucose: 280 };
    const [low] = summaryFixture().excursions;
    withTimeZone('UTC');
    renderWidget(<TableExcursions size="L" />, { summary: summaryFixture({ excursions: low ? [low, high] : [high] }) });

    const table = await screen.findByRole('table');
    const body = within(table).getAllByRole('row').slice(1);
    expect(body.map((row) => [...row.querySelectorAll('td')].slice(0, 3).map((cell) => cell.textContent))).toEqual([
      ['Hipoglicemia', '05/08/2026 08:00', '30 min'],
      ['Hiperglicemia', '05/08/2026 20:00', '90 min'],
    ]);
  });

  it('says "Nenhum episódio no período" when the period has readings but no episode', async () => {
    renderWidget(<TableExcursions size="L" />, { summary: summaryFixture({ excursions: [] }) });

    expect(await screen.findByText('Nenhum episódio no período')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('table-excursions on narrow widths (RSP-03)', () => {
  it('puts the table in a focusable, named region that scrolls on its own', async () => {
    renderWidget(<TableExcursions size="L" />);

    const scroller = await screen.findByRole('region', { name: EXCURSIONS_SCROLL_LABEL });
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(within(scroller).getByRole('table')).toBeInTheDocument();
  });

  it('scrolls horizontally inside that region and keeps the table from shrinking below its columns, in the stylesheet', () => {
    expect(css).toMatch(/\.scroll\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.scroll\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.table\s*\{[^}]*min-width:\s*32rem/);
  });
});
