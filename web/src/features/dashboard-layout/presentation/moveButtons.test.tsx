import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { layoutOfIds } from '../../../test/layoutFakes';
import { moveWidget, type DashboardLayout } from '../domain/layout';
import { MOVE_AFTER_LABEL, MOVE_BEFORE_LABEL, MoveButtons } from './moveButtons';

const TITLES: Record<string, string> = { a: 'Alfa', b: 'Beta', c: 'Gama' };

/** Three widgets, each with its buttons, over the same `moveWidget` the editor uses. */
function Harness() {
  const [layout, setLayout] = useState<DashboardLayout>(layoutOfIds('a', 'b', 'c'));
  return (
    <ol aria-label="widgets">
      {layout.widgets.map((item, index) => (
        <li key={item.id} aria-label={TITLES[item.id]}>
          <MoveButtons
            title={TITLES[item.id] ?? item.id}
            index={index}
            count={layout.widgets.length}
            onMove={(to) => setLayout((current) => moveWidget(current, item.id, to))}
          />
        </li>
      ))}
    </ol>
  );
}

const order = () => within(screen.getByRole('list', { name: 'widgets' })).getAllByRole('listitem').map((item) => item.getAttribute('aria-label'));
const before = (title: string) => screen.getByRole('button', { name: `${MOVE_BEFORE_LABEL}: ${title}` });
const after = (title: string) => screen.getByRole('button', { name: `${MOVE_AFTER_LABEL}: ${title}` });

describe('MoveButtons (LAY-05)', () => {
  it('moves a widget with Tab and Enter alone, and says where it went', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    // The first widget cannot go earlier, so its "antes" button is skipped by Tab.
    await user.tab();
    expect(after('Alfa')).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(order()).toEqual(['Beta', 'Alfa', 'Gama']);
    expect(within(screen.getByRole('listitem', { name: 'Alfa' })).getByRole('status')).toHaveTextContent('Alfa movido para a posição 2 de 3');
  });

  it('moves a widget earlier with the "antes" button and Enter', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    before('Gama').focus();
    await user.keyboard('{Enter}');

    expect(order()).toEqual(['Alfa', 'Gama', 'Beta']);
    expect(within(screen.getByRole('listitem', { name: 'Gama' })).getByRole('status')).toHaveTextContent('Gama movido para a posição 2 de 3');
  });

  it('turns "antes" off on the first widget and "depois" off on the last, and nowhere else', () => {
    render(<Harness />);

    expect(before('Alfa')).toBeDisabled();
    expect(after('Alfa')).toBeEnabled();
    expect(before('Beta')).toBeEnabled();
    expect(after('Beta')).toBeEnabled();
    expect(before('Gama')).toBeEnabled();
    expect(after('Gama')).toBeDisabled();
  });

  it('does not call onMove from a disabled button', async () => {
    const onMove = vi.fn();
    render(<MoveButtons title="Alfa" index={0} count={2} onMove={onMove} />);

    await userEvent.setup().click(before('Alfa'));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('has nothing to move, and both buttons off, when the widget is alone', () => {
    render(<MoveButtons title="Alfa" index={0} count={1} onMove={vi.fn()} />);

    expect(before('Alfa')).toBeDisabled();
    expect(after('Alfa')).toBeDisabled();
  });

  it('keeps the focus on the button just used while it can still be used', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    after('Alfa').focus();

    await user.keyboard('{Enter}');

    expect(after('Alfa')).toHaveFocus();
  });

  it('moves the focus to the other button when the one used reaches the end', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    after('Alfa').focus();

    await user.keyboard('{Enter}{Enter}');

    expect(order()).toEqual(['Beta', 'Gama', 'Alfa']);
    expect(after('Alfa')).toBeDisabled();
    expect(before('Alfa')).toHaveFocus();
  });

  it('drops the announcement when something else, such as a drag, moves the widget again', async () => {
    function Moved() {
      const [index, setIndex] = useState(0);
      return (
        <>
          <MoveButtons title="Alfa" index={index} count={3} onMove={setIndex} />
          <button type="button" onClick={() => setIndex(2)}>
            arrastar
          </button>
        </>
      );
    }
    render(<Moved />);
    const user = userEvent.setup();

    await user.click(after('Alfa'));
    expect(screen.getByRole('status')).toHaveTextContent('Alfa movido para a posição 2 de 3');
    await user.click(screen.getByRole('button', { name: 'arrastar' }));

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('announces politely, in a region that exists before the move', () => {
    render(<MoveButtons title="Alfa" index={1} count={3} onMove={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('has no axe violations, in the middle and at the ends', async () => {
    const { container } = render(<Harness />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
