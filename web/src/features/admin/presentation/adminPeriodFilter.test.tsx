import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AdminPeriodFilter } from './adminPeriodFilter';

/** The filter as the page holds it: the chosen period in state, handed back to the filter. */
function PageWithFilter({ onChange }: { onChange: (days: number) => void }) {
  const [days, setDays] = useState<number | undefined>(undefined);
  return (
    <AdminPeriodFilter
      value={days}
      onChange={(next) => {
        setDays(next);
        onChange(next);
      }}
    />
  );
}

const pressedChips = () =>
  within(screen.getByRole('group', { name: 'Período' }))
    .getAllByRole('button')
    .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
    .map((chip) => chip.textContent);

describe('AdminPeriodFilter (ADM-07, RSP-04)', () => {
  it('offers 7, 30 and 90 days in a "Período" group, with 30 pressed until another is picked', () => {
    render(<PageWithFilter onChange={vi.fn()} />);

    const chips = within(screen.getByRole('group', { name: 'Período' })).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual(['7 dias', '30 dias', '90 dias']);
    expect(pressedChips()).toEqual(['30 dias']);
  });

  it.each([
    ['7 dias', 7],
    ['90 dias', 90],
    ['30 dias', 30],
  ])('the chip "%s" switches the period to %i days', async (chip, days) => {
    const onChange = vi.fn();
    render(<PageWithFilter onChange={onChange} />);

    await userEvent.setup().click(screen.getByRole('button', { name: chip }));

    expect(onChange).toHaveBeenLastCalledWith(days);
    expect(pressedChips()).toEqual([chip]);
  });

  it('has no axe violations', async () => {
    const { container } = render(<AdminPeriodFilter value={90} onChange={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
