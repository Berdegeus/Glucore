import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AppError } from '../../../../shared/domain/appError';
import { carb, fakeDiary, insulin, reading } from '../../../../test/diaryFakes';
import { renderDiaryWidget, TEST_ZONE } from '../../../../test/diaryHarness';
import { stubChartContainer } from '../../../../test/chartContainer';
import { describeCatalogDefinition, expectSkeletonOfSize } from '../../../../test/widgetHarness';
import { TABLE_TOGGLE_LABEL } from '../../../../shared/presentation/charts/chartFrame';
import { ERROR_MESSAGE, RETRY_LABEL } from '../../../../shared/presentation/ui/states';
import { createLoadDayDetail, type LoadDayDetail } from '../../application/loadDayDetail';
import { diaryQueryKey } from '../useDayDetail';
import ChartDayDetail, { chartDayDetailDefinition, CHART_DAY_DETAIL_TITLE, DAY_SELECT_LABEL, NO_DAYS_CAUSE } from './chartDayDetail';

stubChartContainer();

const NBSP = ' ';
/** `hours:minutes` after 2026-08-05 00:00 in Sao Paulo (03:00 UTC). */
const brt = (day: number, hours: number, minutes = 0) => Date.UTC(2026, 7, day, 3 + hours, minutes);

const DIARY = {
  // The 23:30 reading is already 6 August in UTC, and belongs to the 5th in Sao Paulo.
  readings: [reading(brt(6, 9, 5), 130), reading(brt(6, 9), 120), reading(brt(5, 23, 30), 95), reading(brt(5, 8, 5), 110), reading(brt(5, 8), 90)],
  carbs: [carb(brt(7, 8), 99), carb(brt(5, 8, 4), 30)],
  insulin: [insulin(brt(5, 8, 6), 4)],
};

const card = () => screen.findByRole('region', { name: CHART_DAY_DETAIL_TITLE });
const picker = async () => within(await card()).findByRole('combobox', { name: DAY_SELECT_LABEL });

describeCatalogDefinition(chartDayDetailDefinition);

describe('chart-day-detail figure (PAC-11)', () => {
  it('opens on the newest day with readings, with the sentence for screen readers', async () => {
    renderDiaryWidget(<ChartDayDetail size="L" />, { diary: DIARY });

    const region = within(await card());
    expect(await region.findByRole('img', { name: `Glicose em 06/08/2026: 2${NBSP}leituras, de 120${NBSP}mg/dL a 130${NBSP}mg/dL; sem registro de carboidrato ou insulina.` })).toBeInTheDocument();
    expect(await picker()).toHaveValue('2026-08-06');
  });

  it('offers only the days that have readings, newest first, written as dates', async () => {
    renderDiaryWidget(<ChartDayDetail size="L" />, { diary: DIARY });

    const options = within(await picker()).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['06/08/2026', '05/08/2026']);
  });

  it('shows the day chosen, with the 23:30 reading on the 5th and the carbohydrate and insulin of that day', async () => {
    renderDiaryWidget(<ChartDayDetail size="L" />, { diary: DIARY });

    await userEvent.setup().selectOptions(await picker(), '2026-08-05');

    const region = within(await card());
    expect(
      await region.findByRole('img', {
        name: `Glicose em 05/08/2026: 3${NBSP}leituras, de 90${NBSP}mg/dL a 110${NBSP}mg/dL; 1${NBSP}registro de carboidrato (30${NBSP}g) e 1${NBSP}registro de insulina (4,0${NBSP}U).`,
      }),
    ).toBeInTheDocument();
  });

  it('draws a point per reading and one marker for each of carbohydrate and insulin, with their own legend entries', async () => {
    const { container } = renderDiaryWidget(<ChartDayDetail size="L" />, { diary: DIARY });
    await userEvent.setup().selectOptions(await picker(), '2026-08-05');

    const region = within(await card());
    await region.findByRole('img', { name: /Glicose em 05\/08\/2026/ });
    expect(container.querySelectorAll('.recharts-line-dots .recharts-symbols')).toHaveLength(2);
    const legend = region.getAllByRole('listitem').map((item) => item.textContent);
    expect(legend).toEqual(['Glicose', 'Carboidrato (marcador)', 'Insulina (marcador)']);
  });

  it('offers "Ver como tabela" with each reading and entry of the day by local time', async () => {
    renderDiaryWidget(<ChartDayDetail size="L" />, { diary: DIARY });
    const user = userEvent.setup();
    await user.selectOptions(await picker(), '2026-08-05');

    await user.click(await within(await card()).findByRole('button', { name: TABLE_TOGGLE_LABEL }));

    const table = screen.getByRole('table', { name: 'Leituras, carboidrato e insulina de 05/08/2026' });
    const body = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent));
    expect(body).toEqual([
      ['08:00', `90${NBSP}mg/dL`, '—', '—'],
      ['08:04', '—', `30${NBSP}g (Pão)`, '—'],
      ['08:05', `110${NBSP}mg/dL`, '—', '—'],
      ['08:06', '—', '—', `4,0${NBSP}U (RAPID)`],
      ['23:30', `95${NBSP}mg/dL`, '—', '—'],
    ]);
  });

  it('keeps the day chosen across a reload that still has it, and falls back to the newest when it is gone', async () => {
    const reloads = [DIARY, DIARY, { ...DIARY, readings: DIARY.readings.slice(0, 2) }];
    const load: LoadDayDetail = () => createLoadDayDetail({ diary: fakeDiary(reloads.shift()).repository, timeZone: { timeZone: () => TEST_ZONE } })();
    const { client } = renderDiaryWidget(<ChartDayDetail size="L" />, { load: vi.fn(load) });
    await userEvent.setup().selectOptions(await picker(), '2026-08-05');

    await act(() => client.invalidateQueries({ queryKey: diaryQueryKey }));
    expect(await picker()).toHaveValue('2026-08-05');

    await act(() => client.invalidateQueries({ queryKey: diaryQueryKey }));
    expect(await picker()).toHaveValue('2026-08-06');
  });
});

describe('chart-day-detail states (LAY-15, LAY-16)', () => {
  it('shows the skeleton at the height of its size while the diary loads', () => {
    renderDiaryWidget(<ChartDayDetail size="L" />, { load: () => new Promise(() => undefined) });

    expectSkeletonOfSize('L');
  });

  it('gives the cause, and no picker, when there is no reading to choose a day from', async () => {
    renderDiaryWidget(<ChartDayDetail size="L" />, { diary: { carbs: DIARY.carbs } });

    const region = within(await card());
    expect(await region.findByText(NO_DAYS_CAUSE)).toBeInTheDocument();
    expect(region.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('keeps an error inside its own card and reloads on "Tentar novamente"', async () => {
    const load = vi
      .fn<LoadDayDetail>()
      .mockRejectedValueOnce(new AppError('unavailable'))
      .mockResolvedValue({ days: ['2026-08-05'], detailOf: (day) => ({ day, timeZone: 'UTC', readings: [reading(brt(5, 8), 100)], carbs: [], insulin: [] }) });
    renderDiaryWidget(<ChartDayDetail size="L" />, { load });

    const region = within(await card());
    expect(await region.findByRole('alert')).toHaveTextContent(ERROR_MESSAGE);

    await userEvent.setup().click(region.getByRole('button', { name: RETRY_LABEL }));

    expect(await region.findByRole('combobox', { name: DAY_SELECT_LABEL })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('has no axe violations with data', async () => {
    const { container } = renderDiaryWidget(<ChartDayDetail size="L" />, { diary: DIARY });
    await picker();

    expect(await axe(container)).toHaveNoViolations();
  });
});
