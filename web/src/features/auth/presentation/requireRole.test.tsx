import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { homePathFor, ROLES, type Role } from '../../../shared/domain/role';
import { makeAuthServices, signedInAs } from '../../../test/authServices';
import { renderWithAuth } from '../../../test/renderWithAuth';
import { useAuth } from './authProvider';
import { loginPathFor, RequireRole, resolvePostLoginPath, safeInternalPath, UNAVAILABLE_MESSAGE } from './requireRole';

const mounted = vi.fn<(page: string) => void>();
beforeEach(() => mounted.mockClear());

function Page({ name }: { name: string }) {
  useEffect(() => mounted(name), [name]);
  return <h1>{`página ${name}`}</h1>;
}

/** Stand-in for the login page: signs in on click, then follows `resolvePostLoginPath`. */
function LoginStandIn() {
  const { state, login } = useAuth();
  const [params] = useSearchParams();
  if (state.status === 'authenticated') {
    return <Navigate to={resolvePostLoginPath(params.get('next'), state.session.account.role)} replace />;
  }
  return <button onClick={() => void login({ email: 'a@b.co', password: 'x' })}>entrar</button>;
}

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function guarded(role: Role, name: string, path: string) {
  return <Route path={path} element={<RequireRole role={role}><Page name={name} /></RequireRole>} />;
}

function renderApp(route: string, services = makeAuthServices().services) {
  return renderWithAuth(
    <>
      <Routes>
        <Route path="/login" element={<LoginStandIn />} />
        {guarded('PATIENT', 'paciente', '/paciente')}
        {guarded('HEALTH_PROFESSIONAL', 'profissional', '/profissional')}
        {guarded('HEALTH_PROFESSIONAL', 'detalhe', '/profissional/pacientes/:id')}
        {guarded('ADMINISTRATOR', 'admin', '/admin')}
      </Routes>
      <Where />
    </>,
    { services, route },
  );
}

const where = () => screen.getByTestId('where').textContent;
const waitForWhere = (expected: string) => waitFor(() => expect(where()).toBe(expected));
const signIn = () => userEvent.click(screen.getByRole('button', { name: 'entrar' }));

describe('RequireRole for the right role', () => {
  it('renders the route', async () => {
    renderApp('/paciente', signedInAs('PATIENT').services);
    expect(await screen.findByRole('heading', { name: 'página paciente' })).toBeInTheDocument();
    expect(where()).toBe('/paciente');
  });

  it('waits for the session restore without showing children or redirecting', () => {
    renderApp('/paciente', signedInAs('PATIENT').services);
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalledWith('paciente');
    expect(where()).toBe('/paciente');
  });

  it('offers a retry when the session cannot be restored', async () => {
    const restoreSession = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(null);
    renderApp('/paciente', makeAuthServices({ restoreSession }).services);
    expect(await screen.findByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitForWhere('/login?next=%2Fpaciente');
  });
});

describe('RequireRole for another role (ACC-03)', () => {
  const WRONG_ROLE: [Role, string][] = [
    ['PATIENT', '/admin'],
    ['PATIENT', '/profissional'],
    ['HEALTH_PROFESSIONAL', '/paciente'],
    ['HEALTH_PROFESSIONAL', '/admin'],
    ['ADMINISTRATOR', '/paciente'],
    ['ADMINISTRATOR', '/profissional'],
  ];

  it.each(WRONG_ROLE)('sends %s away from %s to their own dashboard without mounting it', async (role, path) => {
    renderApp(path, signedInAs(role).services);
    await waitForWhere(homePathFor(role));
    await waitFor(() => expect(mounted).toHaveBeenCalledWith(homePathFor(role).slice(1)));
    expect(mounted).not.toHaveBeenCalledWith(path.slice(1));
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('shows the patient the patient dashboard when they open /admin', async () => {
    renderApp('/admin', signedInAs('PATIENT').services);
    expect(await screen.findByRole('heading', { name: 'página paciente' })).toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalledWith('admin');
    expect(where()).toBe('/paciente');
  });
});

describe('RequireRole for an anonymous visitor (ACC-04)', () => {
  it('goes to the login and comes back to the requested route after signing in', async () => {
    renderApp('/paciente');
    await waitForWhere('/login?next=%2Fpaciente');
    expect(mounted).not.toHaveBeenCalled();

    await signIn();
    expect(await screen.findByRole('heading', { name: 'página paciente' })).toBeInTheDocument();
    expect(where()).toBe('/paciente');
  });

  it('keeps the path and query of a deep link', async () => {
    renderApp('/profissional/pacientes/42?periodo=14#glicose', makeAuthServices({}, 'HEALTH_PROFESSIONAL').services);

    await waitForWhere('/login?next=%2Fprofissional%2Fpacientes%2F42%3Fperiodo%3D14%23glicose');
    await signIn();
    await waitForWhere('/profissional/pacientes/42?periodo=14');
    expect(await screen.findByRole('heading', { name: 'página detalhe' })).toBeInTheDocument();
  });

  it.each(['//evil.com', 'https://evil.com/x', '/\\evil.com', 'javascript:alert(1)'])(
    'discards the unsafe destination %s and opens the home of the role',
    async (next) => {
      renderApp(`/login?next=${encodeURIComponent(next)}`);
      await signIn();
      await waitForWhere('/paciente');
    },
  );
});

describe('safeInternalPath', () => {
  it.each(['/paciente', '/', '/profissional/pacientes/1?periodo=14#a', '/loginx'])('keeps %s', (path) => {
    expect(safeInternalPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    '',
    'paciente',
    '//evil.com',
    '//evil.com/paciente',
    'https://x',
    'http://localhost/paciente',
    '/\\evil.com',
    '/\t/evil.com',
    'javascript:alert(1)',
    'data:text/html,x',
    '/login',
    '/login/',
    '/LOGIN?next=/admin',
  ])('discards %j', (value) => {
    expect(safeInternalPath(value)).toBeNull();
  });
});

describe('loginPathFor and resolvePostLoginPath', () => {
  it('encodes the requested location into next', () => {
    expect(loginPathFor({ pathname: '/admin', search: '?a=1', hash: '' })).toBe('/login?next=%2Fadmin%3Fa%3D1');
  });

  it('leaves next out when the requested location is the login itself', () => {
    expect(loginPathFor({ pathname: '/login', search: '', hash: '' })).toBe('/login');
  });

  it.each(ROLES)('falls back to the home of %s', (role) => {
    expect(resolvePostLoginPath(null, role)).toBe(homePathFor(role));
    expect(resolvePostLoginPath('//evil.com', role)).toBe(homePathFor(role));
    expect(resolvePostLoginPath('/admin', role)).toBe('/admin');
  });
});
