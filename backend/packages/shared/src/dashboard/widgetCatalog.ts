import type { UserRoleName } from '../auth/claims';

/**
 * The dashboard widget catalog, as the services see it.
 *
 * The source of truth is `contracts/widget-catalog.json` at the repository
 * root, which the web reads too. It is copied here rather than imported because
 * this package's rootDir is `src/` and the build would refuse a file outside
 * it. A test in auth-service reads the JSON and fails on any divergence, so the
 * two cannot drift silently.
 */

export type WidgetSize = 'S' | 'M' | 'L';

export const WIDGET_SIZES: readonly WidgetSize[] = ['S', 'M', 'L'];

/** Upper bound on the number of widgets one saved layout may hold. */
export const MAX_LAYOUT_WIDGETS = 20;

export const WIDGET_IDS_BY_ROLE: Readonly<Record<UserRoleName, readonly string[]>> = {
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
