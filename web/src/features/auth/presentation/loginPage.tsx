import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { isAppError } from '../../../shared/domain/appError';
import { ErrorState, Skeleton } from '../../../shared/presentation/ui/states';
import { useAuth } from './authProvider';
import styles from './loginPage.module.css';
import { resolvePostLoginPath, UNAVAILABLE_MESSAGE } from './requireRole';

export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha incorretos';
export const TOO_MANY_ATTEMPTS_MESSAGE = 'Muitas tentativas. Tente novamente em alguns minutos.';
export const LOGIN_FAILED_MESSAGE = 'Não foi possível entrar. Tente novamente.';

/** Maps what the login call rejected with onto the message of the contract (ACC-07, ACC-08). */
export function loginErrorMessage(error: unknown): string {
  if (!isAppError(error)) return LOGIN_FAILED_MESSAGE;
  switch (error.kind) {
    case 'invalid-credentials':
      return INVALID_CREDENTIALS_MESSAGE;
    case 'rate-limited':
      return TOO_MANY_ATTEMPTS_MESSAGE;
    case 'unavailable':
      return UNAVAILABLE_MESSAGE;
    default:
      return LOGIN_FAILED_MESSAGE;
  }
}

function LoginForm({ notice }: { notice: string | null }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login({ email: email.trim(), password });
    } catch (failure) {
      // The e-mail stays in the field so the person only retypes the password (ACC-07).
      setError(loginErrorMessage(failure));
      setPending(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={(event) => void submit(event)} aria-labelledby="login-title">
      <h1 id="login-title" className={styles.title}>
        Entrar no Glucore
      </h1>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-email">
          E-mail
        </label>
        <input
          id="login-email"
          className={styles.input}
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">
          Senha
        </label>
        <input
          id="login-password"
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

/**
 * The sign-in screen (ACC-01). A signed-in visitor is sent on to `?next=` when
 * it is a path of this app, else to the home of their role (ACC-02, ACC-04).
 */
export function LoginPage() {
  const { state, retryRestore } = useAuth();
  const [params] = useSearchParams();

  switch (state.status) {
    case 'restoring':
      return <Skeleton height="100vh" />;
    case 'failed':
      return <ErrorState message={UNAVAILABLE_MESSAGE} onRetry={retryRestore} />;
    case 'authenticated':
      return <Navigate to={resolvePostLoginPath(params.get('next'), state.session.account.role)} replace />;
    case 'anonymous':
      return (
        <main className={styles.page}>
          <LoginForm notice={state.notice} />
        </main>
      );
  }
}
