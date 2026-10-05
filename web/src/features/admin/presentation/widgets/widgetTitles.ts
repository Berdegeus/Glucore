// The titles of the administrator's widgets. They live apart from the widget modules so the editor can list a widget
// by name without loading its chart code.

export const ADM_KPI_ACCOUNTS_TITLE = 'Contas';

/** Title of each administrator widget by its `titleKey`. */
export const ADMIN_WIDGET_TITLES: Readonly<Record<string, string>> = {
  'widget.adm-kpi-accounts': ADM_KPI_ACCOUNTS_TITLE,
};
