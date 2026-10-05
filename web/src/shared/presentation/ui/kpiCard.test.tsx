import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { KpiCard, TARGET_MET_TEXT, TARGET_MISSED_TEXT, type KpiTarget } from './kpiCard';

const AT_LEAST_70: KpiTarget = { kind: 'atLeast', value: 70, unit: '%' };
const AT_MOST_36: KpiTarget = { kind: 'atMost', value: 36, unit: '%' };

describe('KpiCard value (RSP-09)', () => {
  it('shows the number in pt-BR with its unit', () => {
    render(<KpiCard value={70.5} unit="%" />);

    expect(screen.getByText('70,5')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('rounds to the digits asked for: whole mg/dL', () => {
    render(<KpiCard value={142.4} unit="mg/dL" fractionDigits={0} />);

    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('mg/dL')).toBeInTheDocument();
  });

  it.each([null, Number.NaN])('shows — for %s, with no unit and no verdict on the target', (value) => {
    render(<KpiCard value={value} unit="%" target={AT_LEAST_70} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('%')).not.toBeInTheDocument();
    expect(screen.queryByText(TARGET_MET_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(TARGET_MISSED_TEXT)).not.toBeInTheDocument();
  });
});

describe('KpiCard target (PAC-05, RSP-08)', () => {
  it('states the target of a goal to reach', () => {
    render(<KpiCard value={80} unit="%" target={AT_LEAST_70} />);

    expect(screen.getByText('Meta: 70 %')).toBeInTheDocument();
  });

  it('states the target of a ceiling with "até"', () => {
    render(<KpiCard value={20} unit="%" target={AT_MOST_36} />);

    expect(screen.getByText('Meta: até 36 %')).toBeInTheDocument();
  });

  it.each([
    { target: AT_LEAST_70, value: 69.9, met: false },
    { target: AT_LEAST_70, value: 70, met: true },
    { target: AT_LEAST_70, value: 95, met: true },
    { target: AT_MOST_36, value: 35.9, met: true },
    { target: AT_MOST_36, value: 36, met: true },
    { target: AT_MOST_36, value: 36.1, met: false },
  ])('$target.kind $target.value with $value: met is $met, said in words', ({ target, value, met }) => {
    render(<KpiCard value={value} unit="%" target={target} />);

    expect(screen.getByText(met ? TARGET_MET_TEXT : TARGET_MISSED_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(met ? TARGET_MISSED_TEXT : TARGET_MET_TEXT)).not.toBeInTheDocument();
  });

  it('pairs the verdict with an icon that is hidden from screen readers, so color is never the only cue', () => {
    render(<KpiCard value={50} unit="%" target={AT_LEAST_70} />);

    const verdict = screen.getByText(TARGET_MISSED_TEXT);
    expect(verdict.querySelector('[aria-hidden="true"]')?.textContent).toBe('!');
  });

  it('gives a card with no target no target line and no verdict', () => {
    render(<KpiCard value={142} unit="mg/dL" fractionDigits={0} />);

    expect(screen.queryByText(/Meta/)).not.toBeInTheDocument();
    expect(screen.queryByText(TARGET_MET_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(TARGET_MISSED_TEXT)).not.toBeInTheDocument();
  });

  it('shows the note under the value', () => {
    render(<KpiCard value={6.9} unit="%" note="Poucos dados no período" />);

    expect(screen.getByText('Poucos dados no período')).toBeInTheDocument();
  });
});

describe('KpiCard accessibility (RSP-08)', () => {
  it.each([
    ['met', 80],
    ['missed', 50],
    ['empty', null],
  ])('has no axe violations when the target is %s', async (_name, value) => {
    const { container } = render(<KpiCard value={value} unit="%" target={AT_LEAST_70} note="Nota" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
