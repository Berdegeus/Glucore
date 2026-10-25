import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import styles from './passwordRecoveryPage.module.css';
import { REQUEST_SENT_MESSAGE, requestFailureMessage } from './recoveryMessages';
import { usePasswordRecoveryServices } from './passwordRecoveryServices';

/** Asks for the reset e-mail. The answer is the same whether or not the address has an account. */
export function ForgotPasswordPage() {
  const { requestPasswordReset } = usePasswordRecoveryServices();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (failure) {
      setError(requestFailureMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(event) => void submit(event)} aria-labelledby="forgot-title" noValidate>
        <h1 id="forgot-title" className={styles.title}>
          Recuperar senha
        </h1>
        {sent ? (
          <p className={styles.notice} role="status">
            {REQUEST_SENT_MESSAGE}
          </p>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="forgot-email">
                E-mail cadastrado
              </label>
              <input
                id="forgot-email"
                className={styles.input}
                type="email"
                autoComplete="username"
                aria-required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button type="submit" className={styles.submit} disabled={pending}>
              {pending ? 'Enviando…' : 'Enviar instruções'}
            </button>
          </>
        )}
        <Link className={styles.link} to="/login">
          Voltar para o login
        </Link>
      </form>
    </main>
  );
}
