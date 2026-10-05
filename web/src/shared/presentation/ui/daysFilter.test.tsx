import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { DaysFilter } from './daysFilter';

const OPTIONS = [7, 14, 30, 90] as const;

function renderFilter(value = 14, options: readonly number[] = OPTIONS) {
  const onChange = vi.fn();
  const view = render(<DaysFilter options={options} value={value} onChange={onChange} label="Período" />);
  return { ...view, onChange };
}

describe('DaysFilter', () => {
  it('offers one chip per option, in order, inside a group with the given name', () => {
    renderFilter();

    const group = screen.getByRole('group', { name: 'Período' });
    expect([...group.querySelectorAll('button')].map((chip) => chip.textContent)).toEqual(['7 dias', '14 dias', '30 dias', '90 dias']);
  });

  it('presses only the chip of the current value', () => {
    renderFilter(30);

    const pressed = screen.getAllByRole('button').map((chip) => chip.getAttribute('aria-pressed'));
    expect(pressed).toEqual(['false', 'false', 'true', 'false']);
  });

  it('presses no chip when the value is not on offer', () => {
    renderFilter(15);

    expect(screen.getAllByRole('button').every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('takes whatever options it is given, so another page can offer 7, 30 and 90', () => {
    renderFilter(30, [7, 30, 90]);

    expect(screen.getAllByRole('button').map((chip) => chip.textContent)).toEqual(['7 dias', '30 dias', '90 dias']);
  });

  it('tells the caller the days of the chip that was clicked, with the mouse or the keyboard', async () => {
    const { onChange } = renderFilter();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '90 dias' }));
    screen.getByRole('button', { name: '7 dias' }).focus();
    await user.keyboard('{Enter}');

    expect(onChange.mock.calls).toEqual([[90], [7]]);
  });

  it('has no axe violations', async () => {
    const { container } = renderFilter();

    expect(await axe(container)).toHaveNoViolations();
  });
});
