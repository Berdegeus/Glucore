// The titles of the professional's widgets. They live apart from the widget modules so the editor can list a widget
// by name without loading its chart code; `widgetCatalog.ts` hands them to the title resolver.

export const PRO_KPI_PATIENTS_TITLE = 'Pacientes vinculados';
export const PRO_REDEEM_CODE_TITLE = 'Vincular paciente por código';

/** Title of each professional widget by its `titleKey`. */
export const PROFESSIONAL_WIDGET_TITLES: Readonly<Record<string, string>> = {
  'widget.pro-kpi-patients': PRO_KPI_PATIENTS_TITLE,
  'widget.pro-redeem-code': PRO_REDEEM_CODE_TITLE,
};
