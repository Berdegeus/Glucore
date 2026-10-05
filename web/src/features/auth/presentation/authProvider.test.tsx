import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/domain/appError';
import { makeAuthServices, sessionOf } from '../../../test/authServices';
import { AuthProvider, SESSION_EXPIRED_MESSAGE, useAuth, type AuthServices } from './authProvider';

const credentials = { email: 'ana@example.com', password: 'secret' };

function Probe() {
  const { state, login, adoptSession, logout, retryRestore } = useAuth();
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      {state.status === 'authenticated' && <p>{`Olá, ${state.session.account.fullName}`}</p>}
      {state.status === 'anonymous' && state.notice && <p role="alert">{state.notice}</p>}
      <button onClick={() => login(credentials).catch(() => undefined)}>entrar</button>
      <button onClick={() => adoptSession(sessionOf('HEALTH_PROFESSIONAL', 'Dra. Lia'))}>adotar</button>
      <button onClick={() => logout()}>sair</button>
      <button onClick={retryRestore}>de novo</button>
    </div>
  );
}

function setup(services: AuthServices) {
  const queryClient = new QueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider services={services}>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { queryClient, ...view };
}

const status = () => screen.getByTestId('status').textContent;
const waitForStatus = (expected: string) => waitFor(() => expect(status()).toBe(expected));
const press = (name: string) => userEvent.click(screen.getByRole('button', { name }));

async function signIn(services: AuthServices) {
  const view = setup(services);
  await waitForStatus('anonymous');
  await press('entrar');
  await waitForStatus('authenticated');
  return view;
}

describe('AuthProvider restore', () => {
  it('restores the session of a reloaded tab', async () => {
    const { services } = makeAuthServices({ restoreSession: vi.fn().mockResolvedValue(sessionOf('PATIENT', 'Bia')) });
    setup(services);
    expect(status()).toBe('restoring');
    await waitForStatus('authenticated');
    expect(screen.getByText('Olá, Bia')).toBeInTheDocument();
  });

  it('is anonymous, with no notice, when there is no session to restore', async () => {
    setup(makeAuthServices().services);
    await waitForStatus('anonymous');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports a failed restore and tries again on request', async () => {
    const restoreSession = vi.fn().mockRejectedValueOnce(new AppError('unavailable')).mockResolvedValue(sessionOf());
    setup(makeAuthServices({ restoreSession }).services);
    await waitForStatus('failed');
    await press('de novo');
    await waitForStatus('authenticated');
    expect(restoreSession).toHaveBeenCalledTimes(2);
  });
});

describe('AuthProvider login', () => {
  it('signs in through the use case', async () => {
    const { services } = makeAuthServices();
    await signIn(services);
    expect(services.login).toHaveBeenCalledWith(credentials);
    expect(screen.getByText('Olá, Ana Souza')).toBeInTheDocument();
  });

  it('lets the error reach the caller and stays anonymous', async () => {
    const login = vi.fn().mockRejectedValue(new AppError('invalid-credentials'));
    const { services } = makeAuthServices({ login });
    setup(services);
    await waitForStatus('anonymous');
    await press('entrar');
    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(status()).toBe('anonymous');
  });
});

describe('AuthProvider adoptSession', () => {
  it('signs the person in with a session another flow opened, without calling login', async () => {
    const { services } = makeAuthServices();
    setup(services);
    await waitForStatus('anonymous');

    await press('adotar');

    expect(status()).toBe('authenticated');
    expect(screen.getByText('Olá, Dra. Lia')).toBeInTheDocument();
    expect(services.login).not.toHaveBeenCalled();
  });
});

describe('AuthProvider expiry (ACC-09)', () => {
  it('goes anonymous and shows the notice once when several calls fail together', async () => {
    const { services, sessionEvents, logout } = makeAuthServices();
    await signIn(services);

    act(() => {
      sessionEvents.emitExpired();
      sessionEvents.emitExpired();
      sessionEvents.emitExpired();
    });

    expect(status()).toBe('anonymous');
    expect(screen.getAllByText('Sua sessão expirou. Entre novamente.')).toHaveLength(1);
    expect(SESSION_EXPIRED_MESSAGE).toBe('Sua sessão expirou. Entre novamente.');
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows the notice again after a new login and a second expiry', async () => {
    const { services, sessionEvents } = makeAuthServices();
    await signIn(services);
    act(() => sessionEvents.emitExpired());
    expect(screen.getAllByText(SESSION_EXPIRED_MESSAGE)).toHaveLength(1);

    await press('entrar');
    await waitForStatus('authenticated');
    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).not.toBeInTheDocument();
    act(() => sessionEvents.emitExpired());
    expect(screen.getAllByText(SESSION_EXPIRED_MESSAGE)).toHaveLength(1);
  });

  it('ignores an expiry that arrives after the person signed out', async () => {
    const { services, sessionEvents } = makeAuthServices();
    await signIn(services);
    await press('sair');
    act(() => sessionEvents.emitExpired());
    expect(status()).toBe('anonymous');
    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('AuthProvider logout and shared browser (ACC-11)', () => {
  it('signs out: clears the token and the query cache, and returns to anonymous', async () => {
    const { services, tokenStore } = makeAuthServices();
    const { queryClient } = await signIn(services);
    queryClient.setQueryData(['summary'], { mean: 120 });

    await press('sair');

    expect(status()).toBe('anonymous');
    expect(tokenStore.read()).toBeNull();
    expect(queryClient.getQueryData(['summary'])).toBeUndefined();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the query cache when the session expires', async () => {
    const { services, sessionEvents, tokenStore } = makeAuthServices();
    const { queryClient } = await signIn(services);
    queryClient.setQueryData(['summary'], { mean: 120 });

    act(() => sessionEvents.emitExpired());

    expect(tokenStore.read()).toBeNull();
    expect(queryClient.getQueryData(['summary'])).toBeUndefined();
  });

  it('does not show the first person data to the second person', async () => {
    const login = vi
      .fn()
      .mockResolvedValueOnce(sessionOf('PATIENT', 'Ana'))
      .mockResolvedValueOnce(sessionOf('PATIENT', 'Caio'));
    const { services } = makeAuthServices({ login });
    const { queryClient } = await signIn(services);
    queryClient.setQueryData(['summary'], { owner: 'Ana' });

    await press('sair');
    await press('entrar');
    await waitForStatus('authenticated');

    expect(screen.getByText('Olá, Caio')).toBeInTheDocument();
    expect(queryClient.getQueryData(['summary'])).toBeUndefined();
  });
});
