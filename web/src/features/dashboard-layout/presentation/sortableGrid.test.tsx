import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { press, stackGridCells } from '../../../test/dndHelpers';
import { layoutOfIds } from '../../../test/layoutFakes';
import { moveWidget, type DashboardLayout } from '../domain/layout';
import { SortableGrid } from './sortableGrid';

const TITLES: Record<string, string> = { a: 'Alfa', b: 'Beta', c: 'Gama' };

function Harness({ onMove }: { onMove?: (id: string, toIndex: number) => void }) {
  const [layout, setLayout] = useState<DashboardLayout>(layoutOfIds('a', 'b', 'c'));
  return (
    <SortableGrid
      items={layout.widgets}
      titleOf={(id) => TITLES[id] ?? id}
      onMove={(id, toIndex) => {
        onMove?.(id, toIndex);
        setLayout((current) => moveWidget(current, id, toIndex));
      }}
      renderControls={(item, index) => <span>{`controles de ${item.id} na posição ${index}`}</span>}
      renderContent={(item) => <p>{`conteúdo ${TITLES[item.id]}`}</p>}
    />
  );
}

const order = () => screen.getAllByText(/^conteúdo /).map((content) => content.textContent?.replace('conteúdo ', ''));
const handle = (title: string) => screen.getByRole('button', { name: `Arrastar ${title}` });

beforeEach(stackGridCells);
afterEach(() => vi.restoreAllMocks());

describe('SortableGrid with the keyboard sensor (LAY-04)', () => {
  it('moves a widget down: handle, Space, ArrowDown, Space', async () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);
    expect(order()).toEqual(['Alfa', 'Beta', 'Gama']);

    handle('Alfa').focus();
    await press(handle('Alfa'), 'Space');
    await press(handle('Alfa'), 'ArrowDown');
    await press(handle('Alfa'), 'Space');

    expect(order()).toEqual(['Beta', 'Alfa', 'Gama']);
    expect(onMove).toHaveBeenCalledExactlyOnceWith('a', 1);
  });

  it('moves a widget up to the first place', async () => {
    render(<Harness />);

    handle('Gama').focus();
    await press(handle('Gama'), 'Space');
    await press(handle('Gama'), 'ArrowUp');
    await press(handle('Gama'), 'ArrowUp');
    await press(handle('Gama'), 'Space');

    expect(order()).toEqual(['Gama', 'Alfa', 'Beta']);
  });

  it('leaves the order alone when the drag is cancelled with Escape', async () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);

    handle('Alfa').focus();
    await press(handle('Alfa'), 'Space');
    await press(handle('Alfa'), 'ArrowDown');
    await press(handle('Alfa'), 'Escape');

    expect(order()).toEqual(['Alfa', 'Beta', 'Gama']);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not call onMove when the widget is dropped where it was', async () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);

    handle('Beta').focus();
    await press(handle('Beta'), 'Space');
    await press(handle('Beta'), 'Space');

    expect(onMove).not.toHaveBeenCalled();
  });

  it('announces where the widget is while it moves and where it was dropped, in Portuguese', async () => {
    render(<Harness />);

    handle('Alfa').focus();
    await press(handle('Alfa'), 'Space');
    expect(screen.getByRole('status')).toHaveTextContent('Alfa sobre a posição 1 de 3.');
    await press(handle('Alfa'), 'ArrowDown');
    expect(screen.getByRole('status')).toHaveTextContent('Alfa sobre a posição 2 de 3.');
    await press(handle('Alfa'), 'Space');

    expect(screen.getByRole('status')).toHaveTextContent('Alfa solto na posição 2 de 3.');
  });

  it('announces a cancelled drag', async () => {
    render(<Harness />);

    handle('Beta').focus();
    await press(handle('Beta'), 'Space');
    await press(handle('Beta'), 'Escape');

    expect(screen.getByRole('status')).toHaveTextContent('Movimento cancelado: Beta voltou para a posição 2 de 3.');
  });
});

describe('SortableGrid markup', () => {
  it('draws each cell with its size, handle, controls and widget, in order', () => {
    const { container } = render(<Harness />);

    expect([...container.querySelectorAll('[data-size]')].map((cell) => cell.getAttribute('data-size'))).toEqual(['S', 'S', 'S']);
    const first = container.querySelector('[data-size]') as HTMLElement;
    expect(within(first).getByRole('button', { name: 'Arrastar Alfa' })).toBeInTheDocument();
    expect(within(first).getByText('controles de a na posição 0')).toBeInTheDocument();
    expect(within(first).getByText('conteúdo Alfa')).toBeInTheDocument();
  });

  it('explains the keyboard drag to screen readers through the handle', () => {
    render(<Harness />);

    const description = document.getElementById(handle('Alfa').getAttribute('aria-describedby') ?? '');
    expect(description).toHaveTextContent(/Espaço/);
    expect(handle('Alfa')).toHaveAttribute('aria-roledescription', 'item reordenável');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
