/// <reference types="node" />
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { withTimeZone } from '../../../../test/browserTimeZone';
import { patientPageOf, patientRowOf } from '../../../../test/professionalFakes';
import { describeCohortWidget, renderProfessionalWidget, TEST_DAYS } from '../../../../test/professionalWidgetHarness';
import type { LoadPatientsInput } from '../../application/professionalUseCases';
import type { PatientPage, PatientRow } from '../../domain/cohort';
import { ProfessionalPeriodProvider } from '../periodContext';
import ProPatientsTable, { NAMES_UNAVAILABLE_HINT, PRO_PATIENTS_TABLE_TITLE, proPatientsTableDefinition } from './proPatientsTable';
import { PATIENTS_SCROLL_LABEL, PATIENTS_TABLE_CAPTION } from './patientsTableView';

const NBSP = '\u00a0';
const css = readFileSync(join(import.meta.dirname, 'proPatientsTable.module.css'), 'utf8');
const badgeCss = readFileSync(join(import.meta.dirname, 'riskBadge.module.css'), 'utf8');

afterEach(() => vi.restoreAllMocks());

const ANA = patientRowOf();
const BRUNO = patientRowOf({ patientId: 'p2', fullName: 'Bruno Alves', initials: 'BA', displayName: 'Bruno Alves', timeInRangePercent: 40, hypoEpisodes: 7, alertsCount: 12 });
const CARLA = patientRowOf({ patientId: 'p3', fullName: 'Carla Dias', initials: 'CD', displayName: 'Carla Dias', timeInRangePercent: 65, gmiPercent: 7.4 });
const DAVI = patientRowOf({
  patientId: 'p4',
  fullName: null,
  initials: 'PB4',
  displayName: 'PB4',
  lastReadingAt: null,
  timeInRangePercent: null,
  gmiPercent: null,
  cvPercent: null,
  sensorUsePercent: 40,
});
const FOUR = patientPageOf([ANA, BRUNO, CARLA, DAVI]);

const NAMED_FOUR = patientPageOf([ANA, BRUNO, CARLA]);

/** The names in the order the table lists them. */
const listed = () => within(screen.getByRole('table')).getAllByRole('link').map((link) => link.textContent);
const tableOf = () => screen.findByRole('table', { name: PATIENTS_TABLE_CAPTION });
const sortHeader = (label: string) => screen.getByRole('columnheader', { name: new RegExp(`^${label}`) });

async function mountTable(page: PatientPage = FOUR) {
  const view = renderProfessionalWidget(<ProPatientsTable size="L" />, { patients: page });
  await tableOf();
  return { ...view, user: userEvent.setup() };
}

describeCohortWidget({
  Widget: ProPatientsTable,
  definition: proPatientsTableDefinition,
  title: PRO_PATIENTS_TABLE_TITLE,
  shown: 'Ana Souza',
  source: 'patients',
});

describe('pro-patients-table rows (PRO-03)', () => {
  it('lists name, last reading, TIR, GMI, CV, hypo episodes, alerts and risk, formatted pt-BR on the browser clock', async () => {
    withTimeZone('America/Sao_Paulo');
    await mountTable(patientPageOf([ANA]));

    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    const [, row] = within(table).getAllByRole('row');
    const cells = [...(row?.querySelectorAll('th, td') ?? [])].map((cell) => cell.textContent);
    expect(headers).toEqual(['Paciente', 'Última leitura', 'TIR', 'GMI', 'CV', 'Hipos', 'Alertas', 'Risco↑']);
    expect(cells).toEqual(['Ana Souza', '06/08/2026 05:05', `78,0${NBSP}%`, `6,9${NBSP}%`, `31,5${NBSP}%`, '2', '5', '✓OK']);
  });

  it('shows — for everything the patient has no value for', async () => {
    withTimeZone('UTC');
    await mountTable(patientPageOf([DAVI]));

    const [, row] = within(screen.getByRole('table')).getAllByRole('row');
    const cells = [...(row?.querySelectorAll('th, td') ?? [])].map((cell) => cell.textContent);
    expect(cells).toEqual(['PB4', '—', '—', '—', '—', '2', '5', '?Dados insuficientes']);
  });

  it.each([
    { row: BRUNO, risk: 'HIGH', text: 'Alto', icon: '▲' },
    { row: CARLA, risk: 'ATTENTION', text: 'Atenção', icon: '◆' },
    { row: ANA, risk: 'OK', text: 'OK', icon: '✓' },
    { row: DAVI, risk: 'INSUFFICIENT', text: 'Dados insuficientes', icon: '?' },
  ])('marks a patient of risk $risk with the word "$text", the shape $icon and its hue', async ({ row, risk, text, icon }) => {
    await mountTable(patientPageOf([row]));

    const badge = within(screen.getByRole('table')).getByText(text).closest('[data-risk]');
    expect(badge).toHaveAttribute('data-risk', risk);
    expect(badge).toHaveTextContent(`${icon}${text}`);
    expect(badgeCss).toContain(`.badge[data-risk='${risk}']`);
  });

  it('writes the initials for a patient with no name and says why, once', async () => {
    await mountTable();

    expect(within(screen.getByRole('table')).getByRole('link', { name: 'PB4' })).toBeInTheDocument();
    expect(screen.getAllByText(NAMES_UNAVAILABLE_HINT)).toHaveLength(1);
  });

  it('has no hint about names when every patient has one', async () => {
    await mountTable(NAMED_FOUR);

    expect(screen.queryByText(NAMES_UNAVAILABLE_HINT)).not.toBeInTheDocument();
  });

  it.each([
    { id: 'p2', path: '/profissional/pacientes/p2' },
    { id: 'a/b c', path: '/profissional/pacientes/a%2Fb%20c' },
  ])('links the name of patient $id to $path (PRO-08)', async ({ id, path }) => {
    await mountTable(patientPageOf([patientRowOf({ patientId: id, displayName: 'Eva Lins', fullName: 'Eva Lins' })]));

    expect(screen.getByRole('link', { name: 'Eva Lins' })).toHaveAttribute('href', path);
  });
});

describe('pro-patients-table sorting (PRO-07)', () => {
  it('starts with the highest risk on top, the missing ones last', async () => {
    await mountTable();

    expect(listed()).toEqual(['Bruno Alves', 'Carla Dias', 'Ana Souza', 'PB4']);
    expect(sortHeader('Risco')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sorts a column ascending, then descending on a second click, and marks it with aria-sort', async () => {
    const { user } = await mountTable();

    await user.click(within(sortHeader('TIR')).getByRole('button'));
    expect(listed()).toEqual(['Bruno Alves', 'Carla Dias', 'Ana Souza', 'PB4']);
    expect(sortHeader('TIR')).toHaveAttribute('aria-sort', 'ascending');
    expect(sortHeader('Risco')).not.toHaveAttribute('aria-sort');

    await user.click(within(sortHeader('TIR')).getByRole('button'));
    expect(listed()).toEqual(['Ana Souza', 'Carla Dias', 'Bruno Alves', 'PB4']);
    expect(sortHeader('TIR')).toHaveAttribute('aria-sort', 'descending');
  });

  it.each([
    { column: 'Paciente', ascending: ['Ana Souza', 'Bruno Alves', 'Carla Dias', 'PB4'] },
    { column: 'GMI', ascending: ['Ana Souza', 'Bruno Alves', 'Carla Dias', 'PB4'] },
    { column: 'Hipos', ascending: ['Ana Souza', 'Carla Dias', 'PB4', 'Bruno Alves'] },
    { column: 'Alertas', ascending: ['Ana Souza', 'Carla Dias', 'PB4', 'Bruno Alves'] },
  ])('sorts by $column', async ({ column, ascending }) => {
    const { user } = await mountTable();

    await user.click(within(sortHeader(column)).getByRole('button'));

    expect(listed()).toEqual(ascending);
  });

  it('is operable by keyboard: a header button takes focus with Tab and sorts on Enter', async () => {
    const { user } = await mountTable();
    const button = within(sortHeader('Paciente')).getByRole('button');

    await user.click(within(sortHeader('Risco')).getByRole('button'));
    button.focus();
    await user.keyboard('{Enter}');

    expect(button).toHaveFocus();
    expect(sortHeader('Paciente')).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('pro-patients-table filters (PRO-06)', () => {
  it('shows only the patients of the chosen risk, and all of them again on "Todos os níveis"', async () => {
    const { user } = await mountTable();
    const select = screen.getByRole('combobox', { name: 'Nível de risco' });

    await user.selectOptions(select, 'Alto');
    expect(listed()).toEqual(['Bruno Alves']);

    await user.selectOptions(select, 'Dados insuficientes');
    expect(listed()).toEqual(['PB4']);

    await user.selectOptions(select, 'Todos os níveis');
    expect(listed()).toHaveLength(4);
  });

  it('offers the four levels, worst first', async () => {
    await mountTable();

    const options = within(screen.getByRole('combobox', { name: 'Nível de risco' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Todos os níveis', 'Alto', 'Atenção', 'OK', 'Dados insuficientes']);
  });

  it.each([
    { typed: 'CARLA', found: ['Carla Dias'] },
    { typed: 'alv', found: ['Bruno Alves'] },
    { typed: 'pb4', found: ['PB4'] },
    { typed: 'a', found: ['Bruno Alves', 'Carla Dias', 'Ana Souza'] },
  ])('finds "$typed" by name, ignoring case', async ({ typed, found }) => {
    const { user } = await mountTable();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nome' }), typed);

    expect(listed()).toEqual(found);
  });

  it('combines the risk and the name, and keeps the column order', async () => {
    const { user } = await mountTable();
    await user.click(within(sortHeader('TIR')).getByRole('button'));

    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nome' }), 'a');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nível de risco' }), 'OK');

    expect(listed()).toEqual(['Ana Souza']);
  });

  it('says no patient matches, keeping the filters and the pager, when the filter empties the page', async () => {
    const { user, container } = await mountTable();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nome' }), 'zzz');

    expect(screen.getByRole('status')).toHaveTextContent('Nenhum paciente corresponde ao filtro');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar por nome' })).toHaveValue('zzz');
    expect(screen.getByRole('navigation', { name: 'Paginação da lista de pacientes' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

function pageOf(rows: PatientRow[], page: number, total: number): PatientPage {
  return { items: rows, page, limit: 50, total };
}

describe('pro-patients-table pages of 50 (PRO-16)', () => {
  const second = patientRowOf({ patientId: 'p60', fullName: 'Zeca Matos', initials: 'ZM', displayName: 'Zeca Matos' });
  const loadPatients = (input: LoadPatientsInput) => Promise.resolve(pageOf(input.page === 2 ? [second] : [ANA], input.page ?? 1, 120));

  it.each([
    { total: 1, info: 'Página 1 de 1 · 1 paciente', previous: false, next: false },
    { total: 50, info: 'Página 1 de 1 · 50 pacientes', previous: false, next: false },
    { total: 51, info: 'Página 1 de 2 · 51 pacientes', previous: false, next: true },
    { total: 120, info: 'Página 1 de 3 · 120 pacientes', previous: false, next: true },
  ])('reads "$info" for $total patients', async ({ total, info, previous, next }) => {
    await mountTable(pageOf([ANA], 1, total));

    const pager = screen.getByRole('navigation', { name: 'Paginação da lista de pacientes' });
    expect(within(pager).getByText(info)).toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: 'Anterior' })).toHaveProperty('disabled', !previous);
    expect(within(pager).getByRole('button', { name: 'Próxima' })).toHaveProperty('disabled', !next);
  });

  it('asks for the next page, 50 at a time, and shows it', async () => {
    const loader = vi.fn(loadPatients);
    renderProfessionalWidget(<ProPatientsTable size="L" />, { services: { loadPatients: loader } });
    await tableOf();
    const user = userEvent.setup();
    expect(loader).toHaveBeenLastCalledWith({ days: TEST_DAYS, page: 1, limit: 50 });

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(await screen.findByRole('link', { name: 'Zeca Matos' })).toBeInTheDocument();
    expect(loader).toHaveBeenLastCalledWith({ days: TEST_DAYS, page: 2, limit: 50 });
    expect(screen.getByText('Página 2 de 3 · 120 pacientes')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(await screen.findByRole('link', { name: 'Ana Souza' })).toBeInTheDocument();
  });

  it('keeps the table and the pager on screen while the next page loads', async () => {
    let release: (page: PatientPage) => void = () => undefined;
    const loader = vi.fn((input: LoadPatientsInput) =>
      input.page === 2 ? new Promise<PatientPage>((resolve) => (release = resolve)) : loadPatients(input),
    );
    renderProfessionalWidget(<ProPatientsTable size="L" />, { services: { loadPatients: loader } });
    await tableOf();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(screen.getByRole('link', { name: 'Ana Souza' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument();
    release(pageOf([second], 2, 120));
    expect(await screen.findByRole('link', { name: 'Zeca Matos' })).toBeInTheDocument();
  });

  it('starts over on page 1 when the period changes', async () => {
    const loader = vi.fn(loadPatients);
    function Switch() {
      const [days, setDays] = useState(30);
      return (
        <>
          <button type="button" onClick={() => setDays(7)}>
            7 dias
          </button>
          <ProfessionalPeriodProvider days={days}>
            <ProPatientsTable size="L" />
          </ProfessionalPeriodProvider>
        </>
      );
    }
    renderProfessionalWidget(<Switch />, { services: { loadPatients: loader } });
    await tableOf();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 3 · 120 pacientes');

    await user.click(screen.getByRole('button', { name: '7 dias' }));

    await waitFor(() => expect(loader).toHaveBeenLastCalledWith({ days: 7, page: 1, limit: 50 }));
    expect(await screen.findByText('Página 1 de 3 · 120 pacientes')).toBeInTheDocument();
  });
});

describe('pro-patients-table on narrow widths (RSP-03)', () => {
  it('puts the table in a focusable, named region that scrolls on its own', async () => {
    await mountTable();

    const scroller = screen.getByRole('region', { name: PATIENTS_SCROLL_LABEL });
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(within(scroller).getByRole('table')).toBeInTheDocument();
  });

  it.each([
    ['scrolls on its own', /\.scroll\s*\{[^}]*overflow-x:\s*auto/],
    ['never grows past the card', /\.scroll\s*\{[^}]*max-width:\s*100%/],
    ['keeps the table from shrinking below its columns', /\.table\s*\{[^}]*min-width:\s*48rem/],
  ])('has a stylesheet in which the region %s', (_rule, pattern) => {
    expect(css).toMatch(pattern);
  });
});

describe('pro-patients-table accessibility', () => {
  it('has no axe violations with a sorted, filtered page of every risk level', async () => {
    const { user, container } = await mountTable();
    await user.click(within(sortHeader('TIR')).getByRole('button'));

    expect(await axe(container)).toHaveNoViolations();
  });
});
