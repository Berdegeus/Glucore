import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { WIDGET_SIZES } from '../domain/layout';
import { DashboardGrid, GridItem } from './dashboardGrid';

// Vitest does not apply layout, so the breakpoints and spans are checked in the
// stylesheet itself (RSP-01), and the component only has to hand it `data-size`.
const css = readFileSync(join(import.meta.dirname, 'dashboardGrid.module.css'), 'utf8');

/** The rules inside `@media (min-width: <px>px) { ... }`. */
function mediaBlock(px: number): string {
  const start = css.indexOf(`@media (min-width: ${px}px)`);
  if (start < 0) throw new Error(`no @media for ${px}px`);
  const next = css.indexOf('@media', start + 1);
  return css.slice(start, next < 0 ? undefined : next);
}

const baseCss = css.slice(0, css.indexOf('@media'));

describe('DashboardGrid and GridItem (RSP-01)', () => {
  it.each(WIDGET_SIZES)('puts data-size="%s" on a cell of that size', (size) => {
    render(
      <DashboardGrid>
        <GridItem size={size}>conteúdo</GridItem>
      </DashboardGrid>,
    );

    expect(screen.getByText('conteúdo')).toHaveAttribute('data-size', size);
  });

  it('keeps the cells in the order they were given', () => {
    render(
      <DashboardGrid data-testid="grid">
        <GridItem size="S">primeiro</GridItem>
        <GridItem size="L">segundo</GridItem>
        <GridItem size="M">terceiro</GridItem>
      </DashboardGrid>,
    );

    const cells = Array.from(screen.getByTestId('grid').children);

    expect(cells.map((cell) => [cell.textContent, cell.getAttribute('data-size')])).toEqual([
      ['primeiro', 'S'],
      ['segundo', 'L'],
      ['terceiro', 'M'],
    ]);
  });

  it('passes extra attributes and a class name through to the elements', () => {
    render(
      <DashboardGrid aria-label="Widgets" className="extra">
        <GridItem size="S" data-widget="kpi-tir" className="cell">
          x
        </GridItem>
      </DashboardGrid>,
    );

    expect(screen.getByLabelText('Widgets')).toHaveClass('extra');
    expect(screen.getByText('x')).toHaveAttribute('data-widget', 'kpi-tir');
    expect(screen.getByText('x')).toHaveClass('cell');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <main>
        <DashboardGrid role="group" aria-label="Widgets">
          <GridItem size="M">um</GridItem>
          <GridItem size="S">dois</GridItem>
        </DashboardGrid>
      </main>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('dashboardGrid.module.css (RSP-01, RSP-02)', () => {
  it('starts with one column and has breakpoints at 640px and 1024px only', () => {
    expect(baseCss).toMatch(/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(1,/);
    expect(css.match(/@media/g)).toHaveLength(2);
    expect(css).toContain('@media (min-width: 640px)');
    expect(css).toContain('@media (min-width: 1024px)');
  });

  it('has 2 columns from 640px and 4 from 1024px', () => {
    expect(mediaBlock(640)).toMatch(/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
    expect(mediaBlock(1024)).toMatch(/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
  });

  it('gives S one column, M one on a single column and two from 640px, L the full width', () => {
    expect(baseCss).toMatch(/\[data-size='S'\],\s*\.item\[data-size='M'\]\s*\{[^}]*grid-column:\s*span 1;/);
    expect(mediaBlock(640)).toMatch(/\[data-size='M'\]\s*\{[^}]*grid-column:\s*span 2;/);
    expect(baseCss).toMatch(/\[data-size='L'\]\s*\{[^}]*grid-column:\s*1 \/ -1;/);
  });

  it('never asks for a span the viewport has no columns for', () => {
    // M's span of 2 only appears once there are 2 columns; L spans by line, not by count.
    expect(baseCss).not.toMatch(/span [2-9]/);
    expect(mediaBlock(1024)).not.toMatch(/span [5-9]/);
  });

  it('lets cells and tracks shrink below their content, so nothing widens the page', () => {
    expect(baseCss).toMatch(/\.item\s*\{[^}]*min-width:\s*0;/);
    expect(css.match(/repeat\(\d, minmax\(0, 1fr\)\)/g)).toHaveLength(3);
  });
});
