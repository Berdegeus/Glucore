/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { LoginPage, RequireRole } from '../features/auth';
import type { Role } from '../shared/domain/role';
import { ThemeProvider } from '../shared/presentation/theme/themeProvider';
import { signedInAs } from '../test/authServices';
import { renderWithAuth } from '../test/renderWithAuth';
import { AppShell } from './appShell';

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderShell(role: Role = 'PATIENT', route = '/paciente') {
  const made = signedInAs(role, 'Ana Souza');
  const view = renderWithAuth(
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireRole requiredRole={role}>
              <AppShell />
            </RequireRole>
          }
        >
          <Route path="/paciente" element={<h1>Meu painel</h1>} />
          <Route path="/profissional" element={<h1>Pacientes do profissional</h1>} />
          <Route path="/admin" element={<h1>Visão da plataforma</h1>} />
        </Route>
      </Routes>
      <Where />
    </ThemeProvider>,
    { services: made.services, route },
  );
  return { ...made, ...view };
}

const where = () => screen.getByTestId('where').textContent;
const menuButton = () => screen.getByRole('button', { name: 'Menu' });
const nav = () => screen.getByRole('navigation', { name: 'Principal' });

describe('AppShell header', () => {
  it('shows the name and the role of the person (ACC-11)', async () => {
    renderShell('HEALTH_PROFESSIONAL', '/profissional');
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Profissional de saúde')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pacientes do profissional' })).toBeInTheDocument();
  });

  it.each<[Role, string, string]>([
    ['PATIENT', 'Meu painel', '/paciente'],
    ['HEALTH_PROFESSIONAL', 'Pacientes', '/profissional'],
    ['ADMINISTRATOR', 'Plataforma', '/admin'],
  ])('offers the navigation of %s', async (role, label, path) => {
    renderShell(role, path);
    const link = await screen.findByRole('link', { name: label });
    expect(link).toHaveAttribute('href', path);
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('has a skip link to the main content (RSP-06)', async () => {
    renderShell();
    const skip = await screen.findByRole('link', { name: 'Pular para o conteúdo' });
    expect(skip).toHaveAttribute('href', '#conteudo');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });
});

describe('AppShell sign out (ACC-11)', () => {
  it('"Sair" clears the token and returns to the plain login', async () => {
    const { tokenStore } = renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(where()).toBe('/login'));
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(tokenStore.read()).toBeNull();
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });

  it('renders nothing when nobody is signed in', () => {
    const { container } = renderWithAuth(<AppShell />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AppShell menu (RSP-03, RSP-06)', () => {
  it('opens and closes with Enter and Space on the menu button', async () => {
    renderShell();
    const user = userEvent.setup();
    await screen.findByText('Ana Souza');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(nav()).toHaveAttribute('data-open', 'false');

    menuButton().focus();
    await user.keyboard('{Enter}');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(nav()).toHaveAttribute('data-open', 'true');
    expect(menuButton()).toHaveAttribute('aria-controls', nav().id);

    await user.keyboard(' ');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(nav()).toHaveAttribute('data-open', 'false');
  });

  it('closes on Escape from inside the menu and returns focus to the button', async () => {
    renderShell();
    const user = userEvent.setup();
    await screen.findByText('Ana Souza');
    await user.click(menuButton());
    await user.tab();
    expect(screen.getByRole('link', { name: 'Meu painel' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveFocus();
  });

  it('closes after choosing a destination', async () => {
    renderShell();
    const user = userEvent.setup();
    await screen.findByText('Ana Souza');
    await user.click(menuButton());
    await user.click(screen.getByRole('link', { name: 'Meu painel' }));
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses the navigation below 640px in the stylesheet', () => {
    const css = readFileSync(join(import.meta.dirname, 'appShell.module.css'), 'utf8');
    const media = css.slice(css.indexOf('@media (max-width: 639px)'));
    expect(media).toMatch(/\.nav\s*\{[^}]*display:\s*none/);
    expect(media).toMatch(/\.nav\[data-open='true'\]\s*\{[^}]*display:\s*flex/);
    expect(media).toMatch(/\.menuButton\s*\{[^}]*display:\s*inline-flex/);
    // Above 640px the menu button stays hidden and the navigation shows.
    expect(css.slice(0, css.indexOf('@media'))).toMatch(/\.menuButton\s*\{[^}]*display:\s*none/);
  });
});

describe('AppShell theme (RSP-10)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => delete document.documentElement.dataset.theme);

  it('applies the chosen theme at once', async () => {
    renderShell();
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Tema' }), 'Escuro');
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tema' }), 'Claro');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('starts on the system theme', async () => {
    renderShell();
    expect(await screen.findByRole('combobox', { name: 'Tema' })).toHaveValue('system');
  });
});

describe('AppShell accessibility (RSP-06)', () => {
  it('has no axe violations, with the menu closed and open', async () => {
    const { container } = renderShell();
    await screen.findByText('Ana Souza');
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(menuButton());
    expect(await axe(container)).toHaveNoViolations();
  });
});
