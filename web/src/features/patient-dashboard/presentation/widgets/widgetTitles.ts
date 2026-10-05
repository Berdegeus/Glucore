// The titles of the patient's widgets. They live apart from the widget modules so the editor can list a widget
// by name without loading its chart code; `widgetCatalog.ts` hands them to the title resolver.

export const CARD_FRESHNESS_TITLE = 'Última leitura';
export const CHART_AGP_TITLE = 'Perfil ambulatorial (AGP)';
export const CHART_ALERTS_TYPE_TITLE = 'Alertas por tipo';
export const CHART_CARBS_INSULIN_TITLE = 'Carboidratos e insulina por dia';
export const CHART_DAILY_TIR_TITLE = 'Tempo no alvo por dia';
export const CHART_DAY_DETAIL_TITLE = 'Dia detalhado';
export const CHART_HEATMAP_TITLE = 'Glicose por dia da semana e hora';
export const CHART_INSULIN_TYPE_TITLE = 'Insulina por tipo';
export const CHART_TREND_TITLE = 'Tendência da glicose';
export const CHART_ZONES_TITLE = 'Tempo por zona de glicose';
export const KPI_CV_TITLE = 'Variabilidade (CV)';
export const KPI_GMI_TITLE = 'GMI';
export const KPI_MEAN_TITLE = 'Glicose média';
export const KPI_SENSOR_USE_TITLE = 'Uso do sensor';
export const KPI_TIR_TITLE = 'Tempo no alvo';
export const TABLE_EXCURSIONS_TITLE = 'Episódios de hipo e hiperglicemia';

/** Title of each patient widget by its `titleKey`. */
export const PATIENT_WIDGET_TITLES: Readonly<Record<string, string>> = {
  'widget.card-freshness': CARD_FRESHNESS_TITLE,
  'widget.chart-agp': CHART_AGP_TITLE,
  'widget.chart-alerts-type': CHART_ALERTS_TYPE_TITLE,
  'widget.chart-carbs-insulin': CHART_CARBS_INSULIN_TITLE,
  'widget.chart-daily-tir': CHART_DAILY_TIR_TITLE,
  'widget.chart-day-detail': CHART_DAY_DETAIL_TITLE,
  'widget.chart-heatmap': CHART_HEATMAP_TITLE,
  'widget.chart-insulin-type': CHART_INSULIN_TYPE_TITLE,
  'widget.chart-trend': CHART_TREND_TITLE,
  'widget.chart-zones': CHART_ZONES_TITLE,
  'widget.kpi-cv': KPI_CV_TITLE,
  'widget.kpi-gmi': KPI_GMI_TITLE,
  'widget.kpi-mean': KPI_MEAN_TITLE,
  'widget.kpi-sensor-use': KPI_SENSOR_USE_TITLE,
  'widget.kpi-tir': KPI_TIR_TITLE,
  'widget.table-excursions': TABLE_EXCURSIONS_TITLE,
};
