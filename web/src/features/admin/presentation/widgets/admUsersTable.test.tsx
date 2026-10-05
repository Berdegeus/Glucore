/// <reference types="node" />
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { accountRowOf } from '../../../../test/adminFakes';
import { describeAdminWidget, renderAdminWidget } from '../../../../test/adminWidgetHarness';
import { withTimeZone } from '../../../../test/browserTimeZone';
import type { LoadUsersInput } from '../../application/adminUseCases';
import type { AccountPage, AccountRow } from '../../domain/overview';
import { AdminPeriodProvider } from '../adminPeriodContext';
import AdmUsersTable, { ADM_USERS_TABLE_TITLE, admUsersTableDefinition, NO_ACCOUNTS_CAUSE } from './admUsersTable';
import { USERS_COLUMNS, USERS_SCROLL_LABEL, USERS_TABLE_CAPTION } from './usersTableView';

const css = readFileSync(join(import.meta.dirname, 'admUsersTable.module.css'), 'utf8');

afterEach(() => vi.restoreAllMocks());

describeAdminWidget({
  Widget: AdmUsersTable,
  definition: admUsersTableDefinition,
  title: ADM_USERS_TABLE_TITLE,
  shown: 'Ana Souza',
  emptyCause: NO_ACCOUNTS_CAUSE,
  source: 'users',
});

const ANA = accountRowOf();
const BRUNO = accountRowOf({ id: 'u2', fullName: 'Bruno Alves', email: 'bruno@clinica.example', role: 'HEALTH_PROFESSIONAL', status: 'INACTIVE' });
const CARLA = accountRowOf({ id: 'u3', fullName: 'Carla Dias', email: 'carla@glucore.example', role: 'ADMINISTRATOR', status: 'BLOCKED' });
const ZECA = accountRowOf({ id: 'u60', fullName: 'Zeca Matos', email: 'zeca@example.com' });

const pageOf = (items: AccountRow[], page: number, total: number): AccountPage => ({ items, page, limit: 25, total });
const loaderOf = (page: AccountPage) => vi.fn((input: LoadUsersInput) => Promise.resolve({ ...page, page: input.page ?? 1 }));

const tableOf = () => screen.findByRole('table', { name: USERS_TABLE_CAPTION });
const names = () => within(screen.getByRole('table')).getAllByRole('rowheader').map((cell) => cell.textContent);

async function mountTable(page: AccountPage = pageOf([ANA, BRUNO, CARLA], 1, 3)) {
  const loadUsers = loaderOf(page);
  const view = renderAdminWidget(<AdmUsersTable size="L" />, { services: { loadUsers } });
  await tableOf();
  return { ...view, loadUsers, user: userEvent.setup() };
}

describe('adm-users-table rows (ADM-04)', () => {
  it('lists name, e-mail, role in pt-BR, status in words and the creation date, on the browser clock', async () => {
    withTimeZone('America/Sao_Paulo');
    await mountTable(pageOf([accountRowOf({ createdAt: '2026-05-04T01:30:00.000Z' })], 1, 1));

    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent);
    const [, row] = within(table).getAllByRole('row');
    const cells = [...(row?.querySelectorAll('th, td') ?? [])].map((cell) => cell.textContent);
    expect(headers).toEqual(['Nome', 'E-mail', 'Papel', 'Status', 'Criada em']);
    expect(cells).toEqual(['Ana Souza', 'ana@example.com', 'Paciente', '✓Ativa', '03/05/2026']);
  });

  it('shows only account fields: no column of readings, alerts, carbs or insulin (ADM-03)', async () => {
    await mountTable();

    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(USERS_COLUMNS.length);
    expect(USERS_COLUMNS).toEqual(['Nome', 'E-mail', 'Papel', 'Status', 'Criada em']);
  });

  it.each([
    { row: ANA, role: 'Paciente' },
    { row: BRUNO, role: 'Profissional de saúde' },
    { row: CARLA, role: 'Administrador' },
  ])('names the role of $row.fullName "$role"', async ({ row, role }) => {
    await mountTable(pageOf([row], 1, 1));

    expect(within(screen.getByRole('table')).getByText(role, { selector: 'td' })).toBeInTheDocument();
  });

  it.each([
    { row: ANA, status: 'ACTIVE', text: 'Ativa', icon: '✓' },
    { row: BRUNO, status: 'INACTIVE', text: 'Inativa', icon: '–' },
    { row: CARLA, status: 'BLOCKED', text: 'Bloqueada', icon: '✕' },
  ])('marks a $status account with the word "$text", the shape $icon and its hue', async ({ row, status, text, icon }) => {
    await mountTable(pageOf([row], 1, 1));

    const badge = within(screen.getByRole('table')).getByText(text).closest('[data-status]');
    expect(badge).toHaveAttribute('data-status', status);
    expect(badge).toHaveTextContent(`${icon}${text}`);
    expect(css).toContain(`.badge[data-status='${status}']`);
  });
});

describe('adm-users-table filters (ADM-04)', () => {
  it('offers the three roles and the three statuses, with an option for any', async () => {
    await mountTable();

    const optionsOf = (name: string) => within(screen.getByRole('combobox', { name })).getAllByRole('option').map((option) => option.textContent);
    expect(optionsOf('Papel')).toEqual(['Todos os papéis', 'Paciente', 'Profissional de saúde', 'Administrador']);
    expect(optionsOf('Status')).toEqual(['Todos os status', 'Ativa', 'Inativa', 'Bloqueada']);
  });

  it.each([
    { label: 'Papel', option: 'Profissional de saúde', any: 'Todos os papéis', asked: { role: 'HEALTH_PROFESSIONAL' } },
    { label: 'Status', option: 'Bloqueada', any: 'Todos os status', asked: { status: 'BLOCKED' } },
  ])('asks the API for $asked when the $label filter picks "$option", and for all again on "$any"', async ({ label, option, any, asked }) => {
    const { loadUsers, user } = await mountTable();
    const select = screen.getByRole('combobox', { name: label });

    await user.selectOptions(select, option);
    await waitFor(() => expect(loadUsers).toHaveBeenLastCalledWith({ ...asked, page: 1, limit: 25 }));

    // The unfiltered first page is still cached, so going back to it is answered without a new request.
    await user.selectOptions(select, any);
    expect(select).toHaveValue('');
    expect(loadUsers).toHaveBeenCalledTimes(2);
  });

  it('combines the role and the status in one request', async () => {
    const { loadUsers, user } = await mountTable();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Papel' }), 'Paciente');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Ativa');

    await waitFor(() => expect(loadUsers).toHaveBeenLastCalledWith({ role: 'PATIENT', status: 'ACTIVE', page: 1, limit: 25 }));
  });

  it('asks for the search only once the box has rested, with the whole text and no request per key', async () => {
    const { loadUsers, user } = await mountTable();
    expect(loadUsers).toHaveBeenCalledTimes(1);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nome ou e-mail' }), 'ana');

    await waitFor(() => expect(loadUsers).toHaveBeenLastCalledWith({ q: 'ana', page: 1, limit: 25 }));
    expect(loadUsers).toHaveBeenCalledTimes(2);
  });

  it('keeps the filters and the pager, and says no account was found, when the filters empty the list', async () => {
    const loadUsers = vi.fn((input: LoadUsersInput) => Promise.resolve(input.q ? pageOf([], 1, 0) : pageOf([ANA], 1, 1)));
    const { container } = renderAdminWidget(<AdmUsersTable size="L" />, { services: { loadUsers } });
    await tableOf();
    const user = userEvent.setup();

    await user.type(screen.getByRole('searchbox', { name: 'Buscar por nome ou e-mail' }), 'zzz');

    expect(await screen.findByRole('status')).toHaveTextContent('Nenhuma conta encontrada');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar por nome ou e-mail' })).toHaveValue('zzz');
    expect(screen.getByRole('combobox', { name: 'Papel' })).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1 · 0 contas')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('adm-users-table pages of 25 (ADM-04)', () => {
  it.each([
    { total: 1, info: 'Página 1 de 1 · 1 conta', next: false },
    { total: 25, info: 'Página 1 de 1 · 25 contas', next: false },
    { total: 26, info: 'Página 1 de 2 · 26 contas', next: true },
    { total: 60, info: 'Página 1 de 3 · 60 contas', next: true },
  ])('reads "$info" for $total accounts', async ({ total, info, next }) => {
    await mountTable(pageOf([ANA], 1, total));

    const pager = screen.getByRole('navigation', { name: 'Paginação da lista de contas' });
    expect(within(pager).getByText(info)).toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(within(pager).getByRole('button', { name: 'Próxima' })).toHaveProperty('disabled', !next);
  });

  it('asks for 25 accounts at a time and moves between pages', async () => {
    const loadUsers = vi.fn((input: LoadUsersInput) => Promise.resolve(pageOf([input.page === 2 ? ZECA : ANA], input.page ?? 1, 60)));
    renderAdminWidget(<AdmUsersTable size="L" />, { services: { loadUsers } });
    await tableOf();
    const user = userEvent.setup();
    expect(loadUsers).toHaveBeenLastCalledWith({ page: 1, limit: 25 });

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(await screen.findByText('Zeca Matos')).toBeInTheDocument();
    expect(loadUsers).toHaveBeenLastCalledWith({ page: 2, limit: 25 });
    expect(screen.getByText('Página 2 de 3 · 60 contas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
  });

  it('keeps the table and the pager on screen while the next page loads', async () => {
    let release: (page: AccountPage) => void = () => undefined;
    const loadUsers = vi.fn((input: LoadUsersInput) =>
      input.page === 2 ? new Promise<AccountPage>((resolve) => (release = resolve)) : Promise.resolve(pageOf([ANA], 1, 60)),
    );
    renderAdminWidget(<AdmUsersTable size="L" />, { services: { loadUsers } });
    await tableOf();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Próxima' }));

    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument();
    release(pageOf([ZECA], 2, 60));
    expect(await screen.findByText('Zeca Matos')).toBeInTheDocument();
  });

  it('goes back to page 1 when a filter changes', async () => {
    const loadUsers = vi.fn((input: LoadUsersInput) => Promise.resolve(pageOf([ANA], input.page ?? 1, 60)));
    renderAdminWidget(<AdmUsersTable size="L" />, { services: { loadUsers } });
    await tableOf();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 3 · 60 contas');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Ativa');

    await waitFor(() => expect(loadUsers).toHaveBeenLastCalledWith({ status: 'ACTIVE', page: 1, limit: 25 }));
    expect(await screen.findByText('Página 1 de 3 · 60 contas')).toBeInTheDocument();
  });

  it('starts over on page 1 with no filter when the period changes', async () => {
    const loadUsers = vi.fn((input: LoadUsersInput) => Promise.resolve(pageOf([ANA], input.page ?? 1, 60)));
    function Switch() {
      const [days, setDays] = useState(30);
      return (
        <>
          <button type="button" onClick={() => setDays(7)}>
            7 dias
          </button>
          <AdminPeriodProvider days={days}>
            <AdmUsersTable size="L" />
          </AdminPeriodProvider>
        </>
      );
    }
    renderAdminWidget(<Switch />, { services: { loadUsers } });
    await tableOf();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Papel' }), 'Paciente');
    await user.click(await screen.findByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2 de 3 · 60 contas');

    await user.click(screen.getByRole('button', { name: '7 dias' }));

    expect(await screen.findByText('Página 1 de 3 · 60 contas')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Papel' })).toHaveValue('');
  });
});

describe('adm-users-table on narrow widths (RSP-03)', () => {
  it('puts the table in a focusable, named region that scrolls on its own', async () => {
    await mountTable();

    const scroller = screen.getByRole('region', { name: USERS_SCROLL_LABEL });
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(within(scroller).getByRole('table')).toBeInTheDocument();
  });

  it.each([
    ['scrolls on its own', /\.scroll\s*\{[^}]*overflow-x:\s*auto/],
    ['never grows past the card', /\.scroll\s*\{[^}]*max-width:\s*100%/],
    ['keeps the table from shrinking below its columns', /\.table\s*\{[^}]*min-width:\s*40rem/],
  ])('has a stylesheet in which the region %s', (_rule, pattern) => {
    expect(css).toMatch(pattern);
  });
});

describe('adm-users-table accessibility', () => {
  it('has no axe violations with accounts of every role and status', async () => {
    const { container } = await mountTable();

    expect(names()).toEqual(['Ana Souza', 'Bruno Alves', 'Carla Dias']);
    expect(await axe(container)).toHaveNoViolations();
  });
});
