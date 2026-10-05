import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { WidgetShell, type WidgetProps } from '../../../dashboard-layout';
import { PROFESSIONAL_KEY } from '../professionalQueryKeys';
import { useProfessionalServices } from '../professionalServices';
import styles from './proRedeemCode.module.css';
import { EMPTY_CODE_MESSAGE, LINKED_MESSAGE, redeemErrorMessage } from './redeemMessages';
import { PRO_REDEEM_CODE_TITLE } from './widgetTitles';

// The definition lives in a light module so the catalog can list the widget without loading its form code.
export { proRedeemCodeDefinition } from './proRedeemCode.definition';

export { PRO_REDEEM_CODE_TITLE };

export const CODE_LABEL = 'Código do paciente';
export const CODE_HINT = 'Peça ao paciente o código gerado no aplicativo. Espaços e hífens são aceitos.';
export const SUBMIT_LABEL = 'Vincular paciente';
export const PENDING_LABEL = 'Vinculando…';

/** The form alone, for the page that explains how to get a code (PRO-01); the widget is this inside its card. */
export function RedeemForm() {
  const { redeemInvite } = useProfessionalServices();
  const client = useQueryClient();
  const ids = { input: useId(), hint: useId(), message: useId() };
  const [code, setCode] = useState('');
  const [missing, setMissing] = useState(false);
  const redeem = useMutation({
    mutationFn: (code: string) => redeemInvite(code),
    onSuccess: () => {
      setCode('');
      // The new patient joins the list and the cohort without a reload (PRO-02).
      return client.invalidateQueries({ queryKey: PROFESSIONAL_KEY });
    },
  });
  const error = missing ? EMPTY_CODE_MESSAGE : redeem.isError ? redeemErrorMessage(redeem.error) : null;

  function change(event: ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value.toUpperCase());
    setMissing(false);
    redeem.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // An empty field is refused here, so nothing goes over the network.
    if (code.trim() === '') setMissing(true);
    else redeem.mutate(code);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={ids.input}>
          {CODE_LABEL}
        </label>
        <input
          id={ids.input}
          className={styles.input}
          type="text"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={change}
          aria-invalid={error !== null}
          aria-describedby={`${ids.hint} ${ids.message}`}
        />
        <p id={ids.hint} className={styles.hint}>
          {CODE_HINT}
        </p>
      </div>
      <div id={ids.message}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {redeem.isSuccess && (
          <p className={styles.success} role="status">
            {LINKED_MESSAGE}
          </p>
        )}
      </div>
      <button className={styles.submit} type="submit" disabled={redeem.isPending}>
        {redeem.isPending ? PENDING_LABEL : SUBMIT_LABEL}
      </button>
    </form>
  );
}

/**
 * The field that links a patient: the code the patient generated in the app (PRO-01, PRO-02). It is always the
 * form, so it has no empty state; a bad code, too many tries or an outage are said inside the card (CON-05).
 */
export default function ProRedeemCode({ size }: WidgetProps) {
  return (
    <WidgetShell title={PRO_REDEEM_CODE_TITLE} size={size} state={{ kind: 'ready' }}>
      <RedeemForm />
    </WidgetShell>
  );
}
