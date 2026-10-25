import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PASSWORD_POLICY_HINT } from '../../registration';
import styles from './passwordRecoveryPage.module.css';
import { INVALID_TOKEN_MESSAGE, resetFailureMessage } from './recoveryMessages';
import { usePasswordRecoveryServices } from './passwordRecoveryServices';

/**
 * The page the e-mail links to (`?token=`). The token is read once into state
 * and the query string is replaced away, so it does not linger in the address
 * bar, the history or a `Referer`.
 */
export function ResetPasswordPage() {
  const { resetPassword } = usePasswordRecoveryServices();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) void navigate('/redefinir-senha', { replace: true });
  }, [token, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('As senhas não coincidem');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (failure) {
      setError(resetFailureMessage(failure));
    } finally {
      setPending(false);
    }
  }

  if (!token && !done) {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="reset-title">
          <h1 id="reset-title" className={styles.title}>
            Redefinir senha
          </h1>
          <p className={styles.error} role="alert">
            {INVALID_TOKEN_MESSAGE}
          </p>
          <Link className={styles.link} to="/esqueci-a-senha">
            Pedir novo e-mail
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(event) => void submit(event)} aria-labelledby="reset-title" noValidate>
        <h1 id="reset-title" className={styles.title}>
          Redefinir senha
        </h1>
        {done ? (
          <>
            <p className={styles.notice} role="status">
              Senha redefinida. Entre com a nova senha.
            </p>
            <Link className={styles.link} to="/login">
              Ir para o login
            </Link>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reset-password">
                Nova senha
              </label>
              <input
                id="reset-password"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                aria-required
                aria-describedby="reset-password-hint"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p id="reset-password-hint" className={styles.notice}>
                {PASSWORD_POLICY_HINT}
              </p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reset-confirmation">
                Confirmar nova senha
              </label>
              <input
                id="reset-confirmation"
                className={styles.input}
                type="password"
                autoComplete="new-password"
                aria-required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
