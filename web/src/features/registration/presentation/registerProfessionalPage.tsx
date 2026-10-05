import { useState, type FormEvent, type HTMLInputAutoCompleteAttribute, type HTMLInputTypeAttribute } from 'react';
import { Navigate } from 'react-router';
import { homePathFor } from '../../../shared/domain/role';
import { ErrorState, Skeleton } from '../../../shared/presentation/ui/states';
import { UNAVAILABLE_MESSAGE, useAuth } from '../../auth';
import { PASSWORD_POLICY_HINT } from '../domain/passwordPolicy';
import { LICENSE_NUMBER_MAX_LENGTH, SPECIALTY_MAX_LENGTH } from '../domain/registration';
import styles from './registerProfessionalPage.module.css';
import { registrationFailure, type RegistrationFailure, type RegistrationField } from './registrationMessages';
import { useRegistrationServices } from './registrationServices';

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  type?: HTMLInputTypeAttribute;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  maxLength?: number;
  /** The field is part of the contract; the phone is the only one left out of it. */
  optional?: boolean;
  /** Help read after the label, e.g. the password rule. */
  hint?: string;
  invalid?: boolean;
}

function TextField({ id, label, value, onChange, type = 'text', autoComplete, maxLength, optional, hint, invalid }: FieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}> (opcional)</span>}
      </label>
      <input
        id={id}
        className={styles.input}
        type={type}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-required={optional ? undefined : true}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={hint ? hintId : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

const EMPTY = { fullName: '', email: '', password: '', phone: '', licenseNumber: '', specialty: '' };

function RegistrationForm() {
  const { registerProfessional } = useRegistrationServices();
  const { adoptSession } = useAuth();
  const [values, setValues] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<RegistrationFailure | null>(null);

  const bind = (name: keyof typeof EMPTY) => ({
    value: values[name],
    onChange: (value: string) => setValues((current) => ({ ...current, [name]: value })),
  });
  const flagged = (name: RegistrationField) => failure?.field === name;
  const submitLabel = pending ? 'Criando conta…' : 'Criar conta';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    try {
      // The session is adopted here and the page below sends the person home.
      adoptSession(await registerProfessional(values));
    } catch (error) {
      // What was typed stays in the fields, the password included, so only the refused one is fixed.
      setFailure(registrationFailure(error));
      setPending(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={(event) => void submit(event)} aria-labelledby="register-title" noValidate>
      <h1 id="register-title" className={styles.title}>
        Criar conta de profissional
      </h1>
      <TextField id="register-name" label="Nome completo" autoComplete="name" invalid={flagged('fullName')} {...bind('fullName')} />
      <TextField id="register-email" label="E-mail" type="email" autoComplete="email" invalid={flagged('email')} {...bind('email')} />
      <TextField
        id="register-password"
        label="Senha"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_POLICY_HINT}
        invalid={flagged('password')}
        {...bind('password')}
      />
      <TextField id="register-phone" label="Telefone" type="tel" autoComplete="tel" optional {...bind('phone')} />
      <TextField
        id="register-license"
        label="Número de registro (CRM)"
        maxLength={LICENSE_NUMBER_MAX_LENGTH}
        invalid={flagged('licenseNumber')}
        {...bind('licenseNumber')}
      />
      <TextField
        id="register-specialty"
        label="Especialidade"
        maxLength={SPECIALTY_MAX_LENGTH}
        invalid={flagged('specialty')}
        {...bind('specialty')}
      />
      {failure && (
        <p className={styles.error} role="alert">
          {failure.message}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {submitLabel}
      </button>
    </form>
  );
}

/**
 * The professional's sign-up screen (REG-01). Once the account is open the
 * person is signed in, and the page sends them to the home of their role
 * (`/profissional`), as the login does. Someone already signed in has no use
 * for it and goes home too.
 */
export function RegisterProfessionalPage() {
  const { state, retryRestore } = useAuth();

  if (state.status === 'restoring') return <Skeleton height="100vh" />;
  if (state.status === 'failed') return <ErrorState message={UNAVAILABLE_MESSAGE} onRetry={retryRestore} />;
  if (state.status === 'authenticated') return <Navigate to={homePathFor(state.session.account.role)} replace />;
  return (
    <main className={styles.page}>
      <RegistrationForm />
    </main>
  );
}
