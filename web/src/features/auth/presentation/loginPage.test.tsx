import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AppError, type AppErrorKind } from '../../../shared/domain/appError';
import { homePathFor } from '../../../shared/domain/role';
import { makeAuthServices, sessionOf, signedInAs } from '../../../test/authServices';
import { renderWithAuth } from '../../../test/renderWithAuth';
import type { AuthServices } from './authProvider';
import { LoginPage } from './loginPage';
import { RequireRole } from './requireRole';

const EMAIL = 'ana@example.com';

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderLogin(services: AuthServices = makeAuthServices().services, route = '/login') {
  return renderWithAuth(
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/paciente" element={<RequireRole requiredRole="PATIENT"><h1>painel</h1></RequireRole>} />
      </Routes>
      <Where />
    </>,
    { services, route },
  );
}

const where = () => screen.getByTestId('where').textContent;
const emailField = () => screen.getByLabelText('E-mail');
const submitButton = () => screen.getByRole('button', { name: /Entrar|Entrando/ });

async function fillAndSubmit(user = userEvent.setup()) {
  await user.type(await screen.findByLabelText('E-mail'), EMAIL);
  await user.type(screen.getByLabelText('Senha'), 'wrong-password');
  await user.click(submitButton());
}

function failingLogin(kind: AppErrorKind) {
  return makeAuthServices({ login: vi.fn().mockRejectedValue(new AppError(kind)) }).services;
}

describe('LoginPage errors', () => {
  it('shows the wrong-credentials message on 401 and keeps the e-mail (ACC-07)', async () => {
    renderLogin(failingLogin('invalid-credentials'));
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos');
    expect(emailField()).toHaveValue(EMAIL);
    expect(submitButton()).toBeEnabled();
  });

  it('shows the too-many-attempts message on 429 (ACC-08)', async () => {
    renderLogin(failingLogin('rate-limited'));
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Tente novamente em alguns minutos.',
    );
  });

  it.each<[AppErrorKind, string]>([
    ['unavailable', 'Serviço indisponível. Tente novamente em instantes.'],
    ['unknown', 'Não foi possível entrar. Tente novamente.'],
  ])('shows a message of its own for %s', async (kind, message) => {
    renderLogin(failingLogin(kind));
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('clears the error when the person tries again', async () => {
    const login = vi.fn().mockRejectedValueOnce(new AppError('invalid-credentials')).mockResolvedValue(sessionOf());
    renderLogin(makeAuthServices({ login }).services);
    const user = userEvent.setup();
    await fillAndSubmit(user);
    await screen.findByRole('alert');

    await user.click(submitButton());
    await waitFor(() => expect(where()).toBe('/paciente'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('LoginPage request', () => {
  it('disables the submit button while the request runs and sends the trimmed e-mail', async () => {
    let finish: (value: ReturnType<typeof sessionOf>) => void = () => undefined;
    const login = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderLogin(makeAuthServices({ login }).services);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('E-mail'), `  ${EMAIL} `);
    await user.type(screen.getByLabelText('Senha'), 'secret');
    await user.click(submitButton());

    expect(submitButton()).toBeDisabled();
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ email: EMAIL, password: 'secret' });
    await user.click(submitButton());
    expect(login).toHaveBeenCalledTimes(1);

    await act(async () => finish(sessionOf()));
    await waitFor(() => expect(where()).toBe('/paciente'));
  });

  it('submits with the keyboard alone (RSP-06)', async () => {
    const { services } = makeAuthServices();
    renderLogin(services);
    const user = userEvent.setup();
    await screen.findByLabelText('E-mail');
    await user.tab();
    expect(emailField()).toHaveFocus();
    await user.keyboard(EMAIL);
    await user.tab();
    await user.keyboard('secret{Enter}');

    await waitFor(() => expect(where()).toBe('/paciente'));
    expect(services.login).toHaveBeenCalledWith({ email: EMAIL, password: 'secret' });
  });
});

describe('LoginPage redirects (ACC-01, ACC-02, ACC-04)', () => {
  it('opens the home of the role after login', async () => {
    renderLogin(makeAuthServices({}, 'PATIENT').services);
    await fillAndSubmit();
    await waitFor(() => expect(where()).toBe(homePathFor('PATIENT')));
  });

  it('sends a signed-in visitor of /login on to their home', async () => {
    renderLogin(signedInAs('PATIENT').services);
    await waitFor(() => expect(where()).toBe('/paciente'));
  });

  it('shows the form, not a redirect, to an anonymous visitor', async () => {
    renderLogin();
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    expect(where()).toBe('/login');
  });

  it('offers a retry when the gateway is down at restore', async () => {
    const restoreSession = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(null);
    renderLogin(makeAuthServices({ restoreSession }).services);
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
  });
});

describe('LoginPage session notice (ACC-09)', () => {
  it('shows the expiry notice once, on the login the person lands on', async () => {
    const { services, sessionEvents } = signedInAs('PATIENT');
    renderLogin(services, '/paciente');
    await screen.findByRole('heading', { name: 'painel' });

    act(() => {
      sessionEvents.emitExpired();
      sessionEvents.emitExpired();
    });

    expect(await screen.findAllByText('Sua sessão expirou. Entre novamente.')).toHaveLength(1);
    expect(where()).toBe('/login?next=%2Fpaciente');
    expect(emailField()).toHaveValue('');
  });

  it('shows no notice on a plain visit', async () => {
    renderLogin();
    await screen.findByLabelText('E-mail');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('LoginPage professional sign-up link (REG-01)', () => {
  it('points a health professional to the registration page, reachable with the keyboard', async () => {
    renderLogin();
    const link = await screen.findByRole('link', { name: 'Sou profissional de saúde — criar conta' });
    expect(link).toHaveAttribute('href', '/cadastro-profissional');

    const user = userEvent.setup();
    await user.click(submitButton());
    await user.tab();
    expect(link).toHaveFocus();
  });
});

describe('LoginPage accessibility (RSP-06)', () => {
  it('has no axe violations, with or without an error and a notice', async () => {
    const { container } = renderLogin(failingLogin('invalid-credentials'));
    await screen.findByLabelText('E-mail');
    expect(await axe(container)).toHaveNoViolations();

    await fillAndSubmit();
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations while showing the expiry notice', async () => {
    const { services, sessionEvents } = signedInAs('PATIENT');
    const { container } = renderLogin(services, '/paciente');
    await screen.findByRole('heading', { name: 'painel' });
    act(() => sessionEvents.emitExpired());
    await screen.findByText('Sua sessão expirou. Entre novamente.');
    expect(await axe(container)).toHaveNoViolations();
  });
});
