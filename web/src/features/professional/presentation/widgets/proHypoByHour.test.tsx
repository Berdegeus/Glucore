import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cohortSummaryOf } from '../../../../test/professionalFakes';
import { describeCohortChart, renderProfessionalWidget } from '../../../../test/professionalWidgetHarness';
import { hypoByHourAlternative, hypoByHourRows } from './hypoByHourModel';
import ProHypoByHour, { PRO_HYPO_BY_HOUR_TITLE, proHypoByHourDefinition } from './proHypoByHour';

const HOURS = Array.from({ length: 24 }, (_, hour) => `${hour}h`);
const FIXTURE_COUNTS: Record<string, string> = { '3h': '2', '14h': '1' };

describeCohortChart({
  Widget: ProHypoByHour,
  definition: proHypoByHourDefinition,
  title: PRO_HYPO_BY_HOUR_TITLE,
  summary: 'Episódios de hipoglicemia por hora do dia: 3 episódios no total, mais frequentes às 3h (2 episódios).',
  columns: ['Hora do dia', 'Episódios'],
  rows: HOURS.map((hour) => [hour, FIXTURE_COUNTS[hour] ?? '0']),
});

describe('pro-hypo-by-hour figure (PRO-10)', () => {
  it('draws one bar per hour, from "0h" to "23h"', async () => {
    const { container } = renderProfessionalWidget(<ProHypoByHour size="M" />);
    await screen.findByRole('button', { name: 'Ver como tabela' });

    const labels = [...container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((label) => label.textContent);
    expect(labels).toHaveLength(24);
    expect(labels[0]).toBe('0h');
    expect(labels[23]).toBe('23h');
  });

  it('counts an hour the gateway left out as no episode and keeps the hours in order', () => {
    const rows = hypoByHourRows(
      cohortSummaryOf({
        hypoByHour: [
          { hour: 23, count: 4 },
          { hour: 0, count: 1 },
        ],
      }),
    );

    expect(rows).toHaveLength(24);
    expect(rows[0]).toEqual({ hour: '0h', count: 1 });
    expect(rows[1]).toEqual({ hour: '1h', count: 0 });
    expect(rows[23]).toEqual({ hour: '23h', count: 4 });
  });

  it('says there was no episode when every hour is zero', () => {
    const { summary } = hypoByHourAlternative(cohortSummaryOf({ hypoByHour: [] }));

    expect(summary).toBe('Episódios de hipoglicemia por hora do dia: nenhum episódio no período.');
  });

  it('reads "episódio" in the singular and names the first hour when two tie', () => {
    const { summary } = hypoByHourAlternative(
      cohortSummaryOf({
        hypoByHour: [
          { hour: 9, count: 1 },
          { hour: 20, count: 1 },
        ],
      }),
    );

    expect(summary).toBe('Episódios de hipoglicemia por hora do dia: 2 episódios no total, mais frequentes às 9h (1 episódio).');
  });
});
