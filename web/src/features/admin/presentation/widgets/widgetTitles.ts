// The titles of the administrator's widgets. They live apart from the widget modules so the editor can list a widget
// by name without loading its chart code.

export const ADM_KPI_ACCOUNTS_TITLE = 'Contas';
export const ADM_KPI_REGISTRATIONS_TITLE = 'Cadastros no período';
export const ADM_KPI_REGISTRATIONS_NOTE = 'contas novas no período';
export const ADM_KPI_ACTIVE_PATIENTS_TITLE = 'Pacientes ativos';
export const ADM_KPI_GRANTS_TITLE = 'Vínculos ativos';
export const ADM_KPI_GRANTS_NOTE = 'entre pacientes e profissionais';

/** Title of each administrator widget by its `titleKey`. */
export const ADMIN_WIDGET_TITLES: Readonly<Record<string, string>> = {
  'widget.adm-kpi-accounts': ADM_KPI_ACCOUNTS_TITLE,
  'widget.adm-kpi-registrations': ADM_KPI_REGISTRATIONS_TITLE,
  'widget.adm-kpi-active-patients': ADM_KPI_ACTIVE_PATIENTS_TITLE,
  'widget.adm-kpi-grants': ADM_KPI_GRANTS_TITLE,
};
