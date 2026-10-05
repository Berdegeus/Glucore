import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { AppProviders } from '../../../app/appProviders';
import { createContainer } from '../../../composition/container';
import { accountOf } from '../../../test/authFakes';
import { API_BASE } from '../../../test/httpClient';
import { TEST_API_URL } from '../../../test/pageHarness';
import { server } from '../../../test/server';
import { RegisterProfessionalPage } from './registerProfessionalPage';

const REGISTER_URL = `${API_BASE}/auth/register/professional`;
const PASSWORD = 'Senha123!';
const POLICY = 'Mínimo de 8 caracteres, com maiúscula, minúscula, número e caractere especial';
const LICENSE = 'Número de registro (CRM)';
const FILLED: Record<string, string> = {
  'Nome completo': '  Dra. Ana Souza ',
  'E-mail': 'ana@clinica.com',
  Senha: PASSWORD,
  [LICENSE]: 'CRM-SP 123456',
  Especialidade: 'Endocrinologia',
};

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

const where = () => screen.getByTestId('where').textContent;
const submitButton = () => screen.getByRole('button', { name: /Criar conta|Criando/ });
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`));

/** The page on the real container over MSW, inside the providers the app has. */
function renderPage({ token }: { token?: string } = {}) {
  const container = createContainer({ apiUrl: TEST_API_URL });
  if (token) container.tokenStore.save(token);
  const view = render(
    <AppProviders container={container}>
      <MemoryRouter initialEntries={['/cadastro-profissional']}>
        <Routes>
          <Route path="/cadastro-profissional" element={<RegisterProfessionalPage />} />
          <Route path="*" element={<p>destino</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </AppProviders>,
  );
  return { ...view, appContainer: container };
}

const CREATED = () => HttpResponse.json({ userId: 'u1', token: 'tok-1' }, { status: 201 });

/** Answers the registration with `answer()` and `/me` as a professional; returns the bodies received. */
function mockRegistration(answer: () => Response = CREATED) {
  const bodies: unknown[] = [];
  server.use(
    http.post(REGISTER_URL, async ({ request }) => {
      bodies.push(await request.json());
      return answer();
    }),
    http.get(`${API_BASE}/me`, () => HttpResponse.json(accountOf('HEALTH_PROFESSIONAL'))),
  );
  return bodies;
}

async function fill(values: Record<string, string>) {
  const user = userEvent.setup();
  await screen.findByLabelText('Senha');
  for (const [label, text] of Object.entries(values)) await user.type(field(label), text);
  return user;
}

async function fillAndSubmit(overrides: Record<string, string> = {}) {
  const user = await fill({ ...FILLED, ...overrides });
  await user.click(submitButton());
}

afterEach(() => window.sessionStorage.clear());

describe('RegisterProfessionalPage form (REG-01, REG-02)', () => {
  it('shows the password rule as help text of the password field', async () => {
    renderPage();
    const password = await screen.findByLabelText('Senha');

    expect(screen.getByText(POLICY)).toBeInTheDocument();
    expect(password).toHaveAccessibleDescription(POLICY);
    expect(password).toHaveAttribute('type', 'password');
  });

  it('asks for every field but the phone, which says it is optional', async () => {
    renderPage();
    await screen.findByLabelText('Senha');

    for (const label of ['Nome completo', 'E-mail', 'Senha', LICENSE, 'Especialidade']) {
      expect(field(label)).toHaveAttribute('aria-required', 'true');
    }
    expect(field('Telefone')).not.toHaveAttribute('aria-required');
    expect(screen.getByText('(opcional)')).toBeInTheDocument();
  });

  it('creates the account with the trimmed fields, signs in and opens /profissional', async () => {
    const bodies = mockRegistration();
    const { appContainer } = renderPage();

    await fillAndSubmit();

    await waitFor(() => expect(where()).toBe('/profissional'));
    expect(bodies).toEqual([
      {
        fullName: 'Dra. Ana Souza',
        email: 'ana@clinica.com',
        password: PASSWORD,
        licenseNumber: 'CRM-SP 123456',
        specialty: 'Endocrinologia',
      },
    ]);
    expect(appContainer.tokenStore.read()).toBe('tok-1');
  });

  it('sends the phone when one is typed', async () => {
    const bodies = mockRegistration();
    renderPage();

    await fillAndSubmit({ Telefone: '+55 11 99999-0000' });

    await waitFor(() => expect(where()).toBe('/profissional'));
    expect(bodies[0]).toMatchObject({ phone: '+55 11 99999-0000' });
  });

  it('disables the button while the request runs, so it is sent once', async () => {
    let release: () => void = () => undefined;
    const bodies: unknown[] = [];
    server.use(
      http.post(REGISTER_URL, async ({ request }) => {
        bodies.push(await request.json());
        await new Promise<void>((resolve) => (release = resolve));
        return CREATED();
      }),
      http.get(`${API_BASE}/me`, () => HttpResponse.json(accountOf('HEALTH_PROFESSIONAL'))),
    );
    renderPage();

    await fillAndSubmit();

    await waitFor(() => expect(submitButton()).toBeDisabled());
    await userEvent.click(submitButton());
    release();
    await waitFor(() => expect(where()).toBe('/profissional'));
    expect(bodies).toHaveLength(1);
  });

  it('sends a person who is already signed in on to their home', async () => {
    server.use(http.get(`${API_BASE}/me`, () => HttpResponse.json(accountOf('HEALTH_PROFESSIONAL'))));
    renderPage({ token: 'tok-1' });

    await waitFor(() => expect(where()).toBe('/profissional'));
  });
});

describe('RegisterProfessionalPage restore failure', () => {
  it('offers a retry when the gateway is down while the stored session is restored, then shows the form', async () => {
    let answers = 0;
    server.use(
      http.get(`${API_BASE}/me`, () => {
        answers += 1;
        return answers === 1 ? HttpResponse.json({ error: 'down' }, { status: 503 }) : HttpResponse.json({ error: 'x', code: 'TOKEN_INVALID' }, { status: 401 });
      }),
    );
    renderPage({ token: 'tok-1' });

    expect(await screen.findByText('Serviço indisponível. Tente novamente em instantes.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByLabelText('Senha')).toBeInTheDocument();
  });
});

describe('RegisterProfessionalPage refusals (REG-02, REG-03, REG-07)', () => {
  const refuse = (status: number, body: object) => () => HttpResponse.json(body, { status });
  const CASES: [string, () => Response, string][] = [
    ['409 EMAIL_TAKEN', refuse(409, { error: 'taken', code: 'EMAIL_TAKEN' }), 'Este e-mail já está cadastrado'],
    ['400 WEAK_PASSWORD', refuse(400, { error: 'weak', code: 'WEAK_PASSWORD' }), POLICY],
    ['400 on another field', refuse(400, { error: 'invalid' }), 'Confira os dados informados.'],
    ['429', refuse(429, { error: 'slow down' }), 'Muitas tentativas. Tente novamente em alguns minutos.'],
    ['503', refuse(503, { error: 'down' }), 'Serviço indisponível. Tente novamente em instantes.'],
    ['500', refuse(500, { error: 'boom' }), 'Não foi possível criar a conta. Tente novamente.'],
  ];

  it.each(CASES)('shows the message of its own for %s and keeps what was typed', async (_label, answer, message) => {
    mockRegistration(answer);
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(field('E-mail')).toHaveValue('ana@clinica.com');
    expect(field('Senha')).toHaveValue(PASSWORD);
    expect(submitButton()).toBeEnabled();
    expect(where()).toBe('/cadastro-profissional');
  });

  it('flags the e-mail field when the e-mail is taken', async () => {
    mockRegistration(refuse(409, { error: 'taken', code: 'EMAIL_TAKEN' }));
    renderPage();

    await fillAndSubmit();

    await screen.findByRole('alert');
    expect(field('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Senha')).not.toHaveAttribute('aria-invalid');
  });

  it.each<[string, Record<string, string>, string, string]>([
    ['a weak password', { Senha: 'abc' }, POLICY, 'Senha'],
    ['an invalid e-mail', { 'E-mail': 'not-an-email' }, 'Informe um e-mail válido', 'E-mail'],
    ['a short name', { 'Nome completo': 'Al' }, 'Informe o nome completo', 'Nome completo'],
    ['a blank registration number', { [LICENSE]: '   ' }, 'Informe o número de registro, com até 40 caracteres', LICENSE],
    ['a blank specialty', { Especialidade: '   ' }, 'Informe a especialidade, com até 80 caracteres', 'Especialidade'],
  ])('refuses %s without sending anything and flags the field', async (_label, change, message, flagged) => {
    const bodies = mockRegistration();
    renderPage();
    const values = { ...FILLED, ...change };

    await fill(values);
    await userEvent.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(field(flagged)).toHaveAttribute('aria-invalid', 'true');
    expect(bodies).toHaveLength(0);
  });
});

describe('RegisterProfessionalPage keyboard and accessibility (RSP-06)', () => {
  it('fills and submits with the keyboard alone', async () => {
    const bodies = mockRegistration();
    renderPage();
    const user = userEvent.setup();
    await screen.findByLabelText('Senha');

    await user.tab();
    expect(field('Nome completo')).toHaveFocus();
    await user.keyboard('Ana Souza');
    await user.tab();
    await user.keyboard('ana@clinica.com');
    await user.tab();
    await user.keyboard(PASSWORD);
    await user.tab();
    await user.tab();
    await user.keyboard('CRM 1');
    await user.tab();
    await user.keyboard('Endocrinologia{Enter}');

    await waitFor(() => expect(where()).toBe('/profissional'));
    expect(bodies).toEqual([
      { fullName: 'Ana Souza', email: 'ana@clinica.com', password: PASSWORD, licenseNumber: 'CRM 1', specialty: 'Endocrinologia' },
    ]);
  });

  it('has no axe violations, idle or showing an error', async () => {
    mockRegistration(() => HttpResponse.json({ error: 'taken', code: 'EMAIL_TAKEN' }, { status: 409 }));
    const { container } = renderPage();
    await screen.findByLabelText('Senha');
    expect(await axe(container)).toHaveNoViolations();

    await fillAndSubmit();
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });
});
