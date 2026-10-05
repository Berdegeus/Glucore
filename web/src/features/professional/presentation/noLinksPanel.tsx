import { useId } from 'react';
import styles from './noLinksPanel.module.css';
import { useWidgetCohort } from './widgets/cohortWidget';
import { RedeemForm } from './widgets/proRedeemCode';

export const NO_LINKS_TITLE = 'Nenhum paciente vinculado';
export const HOW_TO_GET_CODE =
  'Peça ao paciente para abrir o aplicativo, ir em Configurações › Compartilhar com profissional e gerar um código. Informe o código abaixo para vincular.';

/**
 * What a professional with no linked patient sees above the grid (PRO-01): how
 * the code is obtained and the field that takes it. It reads the same cohort as
 * the widgets, so it costs no request of its own; once a code is redeemed the
 * cohort reloads and the panel goes away without a reload of the page.
 */
export function NoLinksPanel() {
  const { data } = useWidgetCohort();
  const titleId = useId();
  if (data?.patientCount !== 0) return null;
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        {NO_LINKS_TITLE}
      </h2>
      <p className={styles.text}>{HOW_TO_GET_CODE}</p>
      <RedeemForm />
    </section>
  );
}
