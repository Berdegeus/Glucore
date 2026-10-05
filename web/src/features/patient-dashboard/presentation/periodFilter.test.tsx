import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PERIOD_PRESETS, toRange, type DateRange } from '../domain/period';
import { PeriodFilter } from './periodFilter';

const TODAY = '2026-03-15';
const ERROR_TEXT = 'Escolha um período de até 90 dias';

function renderFilter(value: DateRange = toRange(14, TODAY)) {
  const onChange = vi.fn();
  const view = render(<PeriodFilter value={value} today={TODAY} onChange={onChange} />);
  return { onChange, ...view };
}

const chip = (name: string) => screen.getByRole('button', { name });
const group = () => screen.getByRole('group', { name: 'Período' });

/** Opens the custom form, types the two dates (replacing what is there) and applies. */
async function applyCustom(from: string, to: string) {
  const user = userEvent.setup();
  await user.click(chip('Personalizado'));
  fireEvent.change(screen.getByLabelText('Início'), { target: { value: from } });
  fireEvent.change(screen.getByLabelText('Fim'), { target: { value: to } });
  await user.click(chip('Aplicar'));
}

describe('PeriodFilter presets (PAC-02)', () => {
  it('offers the 7, 14, 30 and 90 day chips and a custom one, in a group named Período', () => {
    renderFilter();

    expect(within(group()).getAllByRole('button').map((button) => button.textContent)).toEqual([
      '7 dias',
      '14 dias',
      '30 dias',
      '90 dias',
      'Personalizado',
    ]);
  });

  it.each(PERIOD_PRESETS)('choosing %s days reports the period ending today', async (preset) => {
    const { onChange } = renderFilter(toRange(14, TODAY));

    await userEvent.setup().click(chip(`${preset} dias`));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(toRange(preset, TODAY));
  });

  it.each(PERIOD_PRESETS)('marks only the chip of the current period as pressed: %s days', (preset) => {
    renderFilter(toRange(preset, TODAY));

    const pressed = within(group())
      .getAllByRole('button', { pressed: true })
      .map((button) => button.textContent);

    expect(pressed).toEqual([`${preset} dias`]);
  });

  it('can be driven from the keyboard', async () => {
    const { onChange } = renderFilter();
    const user = userEvent.setup();

    await user.tab();
    expect(chip('7 dias')).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(toRange(7, TODAY));
  });
});

describe('PeriodFilter custom period (PAC-03, PAC-04)', () => {
  it('shows no date fields until Personalizado is chosen, then fills them with the current period', async () => {
    renderFilter(toRange(14, TODAY));
    expect(screen.queryByLabelText('Início')).not.toBeInTheDocument();

    await userEvent.setup().click(chip('Personalizado'));

    expect(screen.getByLabelText('Início')).toHaveValue('2026-03-02');
    expect(screen.getByLabelText('Fim')).toHaveValue('2026-03-15');
    expect(chip('Personalizado')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('14 dias')).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens on the custom form when the current period is not a preset', () => {
    renderFilter({ from: '2026-03-01', to: '2026-03-10' });

    expect(chip('Personalizado')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Início')).toHaveValue('2026-03-01');
  });

  it.each([
    ['one day', '2026-03-10', '2026-03-10'],
    ['exactly 90 days', '2026-01-01', '2026-03-31'],
  ])('reports a custom period of %s and shows no error', async (_label, from, to) => {
    const { onChange } = renderFilter();

    await applyCustom(from, to);

    expect(onChange).toHaveBeenCalledWith({ from, to });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['91 days', '2026-01-01', '2026-04-01'],
    ['a start after the end', '2026-03-02', '2026-03-01'],
    ['an empty start', '', '2026-03-10'],
  ])('shows "Escolha um período de até 90 dias" for %s and reports nothing', async (_label, from, to) => {
    const { onChange } = renderFilter();

    await applyCustom(from, to);

    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_TEXT);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Início')).toBeInvalid();
    expect(screen.getByLabelText('Fim')).toHaveAccessibleDescription(ERROR_TEXT);
  });

  it('takes the error away once a valid period is applied', async () => {
    const { onChange } = renderFilter();
    await applyCustom('2026-01-01', '2026-04-01');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Fim'), { target: { value: '2026-03-31' } });
    await userEvent.setup().click(chip('Aplicar'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-03-31' });
  });

  it('closes the custom form when a preset is chosen', async () => {
    renderFilter();
    const user = userEvent.setup();
    await user.click(chip('Personalizado'));

    await user.click(chip('30 dias'));

    expect(screen.queryByLabelText('Início')).not.toBeInTheDocument();
  });
});

describe('PeriodFilter accessibility', () => {
  it('has no axe violations with the presets', async () => {
    const { container } = renderFilter();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with the custom form and its error shown', async () => {
    const { container } = renderFilter();
    await applyCustom('2026-01-01', '2026-04-01');

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
