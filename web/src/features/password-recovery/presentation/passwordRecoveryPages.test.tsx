import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { AppProviders } from '../../../app/appProviders';
import { createContainer } from '../../../composition/container';
import { API_BASE } from '../../../test/httpClient';
import { TEST_API_URL } from '../../../test/pageHarness';
import { server } from '../../../test/server';
import { ForgotPasswordPage } from './forgotPasswordPage';
import { ResetPasswordPage } from './resetPasswordPage';

const FORGOT_URL = `${API_BASE}/auth/forgot-password`;
const RESET_URL = `${API_BASE}/auth/reset-password`;

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderAt(route: string) {
  return render(
    <AppProviders container={createContainer({ apiUrl: TEST_API_URL })}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/esqueci-a-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/login" element={<p>login</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('ForgotPasswordPage', () => {
  it('asks for the e-mail and answers with the neutral message', async () => {
    let body: unknown;
    server.use(
      http.post(FORGOT_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ message: 'If the email is registered, instructions were sent.' });
      }),
    );
    const user = userEvent.setup();
    renderAt('/esqueci-a-senha');

    await user.type(await screen.findByLabelText('E-mail cadastrado'), ' ana@clinica.com ');
    await user.click(screen.getByRole('button', { name: 'Enviar instruções' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Se o e-mail estiver cadastrado');
    expect(body).toEqual({ email: 'ana@clinica.com' });
  });

  it('flags an address without @ and sends nothing', async () => {
    const user = userEvent.setup();
    renderAt('/esqueci-a-senha');

    await user.type(await screen.findByLabelText('E-mail cadastrado'), 'ana');
    await user.click(screen.getByRole('button', { name: 'Enviar instruções' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um e-mail válido');
  });

  it('shows the too-many-attempts message on 429 and has no accessibility violations', async () => {
    server.use(http.post(FORGOT_URL, () => new HttpResponse(null, { status: 429 })));
    const user = userEvent.setup();
    const { container } = renderAt('/esqueci-a-senha');

    await user.type(await screen.findByLabelText('E-mail cadastrado'), 'ana@clinica.com');
    await user.click(screen.getByRole('button', { name: 'Enviar instruções' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ResetPasswordPage', () => {
  async function fill(user: ReturnType<typeof userEvent.setup>, password: string, confirmation = password) {
    await user.type(await screen.findByLabelText('Nova senha'), password);
    await user.type(screen.getByLabelText('Confirmar nova senha'), confirmation);
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
  }

  it('takes the token from the link, removes it from the address and resets the password', async () => {
    let body: unknown;
    server.use(
      http.post(RESET_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ message: 'Password reset successful.' });
      }),
    );
    const user = userEvent.setup();
    renderAt('/redefinir-senha?token=tok-123');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/redefinir-senha'));
    expect(screen.getByTestId('where').textContent).not.toContain('tok-123');

    await fill(user, 'Senha123!');

    expect(await screen.findByRole('status')).toHaveTextContent('Senha redefinida');
    expect(body).toEqual({ token: 'tok-123', password: 'Senha123!' });
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute('href', '/login');
  });

  it('refuses a weak password and a mismatched confirmation before the network', async () => {
    const user = userEvent.setup();
    renderAt('/redefinir-senha?token=tok-123');

    await fill(user, 'fraca');
    expect(await screen.findByRole('alert')).toHaveTextContent('Mínimo de 8 caracteres');

    await user.clear(screen.getByLabelText('Confirmar nova senha'));
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'outra');
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('As senhas não coincidem');
  });

  it('says the link is invalid when the API refuses the token', async () => {
    server.use(http.post(RESET_URL, () => HttpResponse.json({ error: 'Invalid or expired token' }, { status: 400 })));
    const user = userEvent.setup();
    renderAt('/redefinir-senha?token=velho');

    await fill(user, 'Senha123!');

    expect(await screen.findByRole('alert')).toHaveTextContent('Link inválido ou expirado');
  });

  it('offers a new e-mail when opened without a token', async () => {
    renderAt('/redefinir-senha');

    expect(await screen.findByRole('alert')).toHaveTextContent('Link inválido ou expirado');
    expect(screen.getByRole('link', { name: 'Pedir novo e-mail' })).toHaveAttribute('href', '/esqueci-a-senha');
  });
});
