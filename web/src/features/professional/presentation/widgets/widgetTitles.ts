// The titles of the professional's widgets. They live apart from the widget modules so the editor can list a widget
// by name without loading its chart code; `widgetCatalog.ts` hands them to the title resolver.

export const PRO_KPI_GMI_TITLE = 'GMI médio';
export const PRO_KPI_HYPO_TITLE = 'Pacientes com hipo';
export const PRO_KPI_HYPO_NOTE = 'com hipoglicemia no período';
export const PRO_KPI_PATIENTS_TITLE = 'Pacientes vinculados';
export const PRO_KPI_TIR_TITLE = 'TIR médio';
export const PRO_KPI_STALE_TITLE = 'Sem leitura recente';
export const PRO_KPI_STALE_NOTE = 'sem leitura há mais de 24 h';
export const PRO_REDEEM_CODE_TITLE = 'Vincular paciente por código';

/** Title of each professional widget by its `titleKey`. */
export const PROFESSIONAL_WIDGET_TITLES: Readonly<Record<string, string>> = {
  'widget.pro-kpi-gmi': PRO_KPI_GMI_TITLE,
  'widget.pro-kpi-hypo': PRO_KPI_HYPO_TITLE,
  'widget.pro-kpi-patients': PRO_KPI_PATIENTS_TITLE,
  'widget.pro-kpi-tir': PRO_KPI_TIR_TITLE,
  'widget.pro-kpi-stale': PRO_KPI_STALE_TITLE,
  'widget.pro-redeem-code': PRO_REDEEM_CODE_TITLE,
};
