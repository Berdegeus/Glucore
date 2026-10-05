import type { Role } from '../../../shared/domain/role';

/**
 * Every widget id each role may have on its dashboard, in catalog order. It
 * repeats `contracts/widget-catalog.json` (the backend validates the `PUT`
 * against the same file), and a test fails when the two drift apart.
 */
export const widgetIds: Readonly<Record<Role, readonly string[]>> = {
  PATIENT: [
    'kpi-tir',
    'kpi-gmi',
    'kpi-mean',
    'kpi-cv',
    'kpi-sensor-use',
    'card-freshness',
    'chart-trend',
    'chart-daily-tir',
    'chart-zones',
    'chart-agp',
    'chart-heatmap',
    'table-excursions',
    'chart-insulin-type',
    'chart-alerts-type',
    'chart-carbs-insulin',
    'chart-day-detail',
  ],
  HEALTH_PROFESSIONAL: [
    'pro-redeem-code',
    'pro-kpi-patients',
    'pro-kpi-tir',
    'pro-kpi-gmi',
    'pro-kpi-hypo',
    'pro-kpi-stale',
    'pro-patients-table',
    'pro-tir-by-patient',
    'pro-risk-scatter',
    'pro-tir-histogram',
    'pro-hypo-by-hour',
  ],
  ADMINISTRATOR: [
    'adm-kpi-accounts',
    'adm-kpi-registrations',
    'adm-kpi-active-patients',
    'adm-kpi-grants',
    'adm-users-role',
    'adm-registrations',
    'adm-active-patients',
    'adm-readings-volume',
    'adm-grants',
    'adm-alerts',
    'adm-users-table',
  ],
};
