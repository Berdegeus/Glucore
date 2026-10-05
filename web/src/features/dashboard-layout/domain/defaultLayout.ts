import type { Role } from '../../../shared/domain/role';
import type { DashboardLayout, WidgetSize } from './layout';

type Plan = readonly (readonly [id: string, size: WidgetSize])[];

function layoutFrom(plan: Plan): DashboardLayout {
  return { widgets: plan.map(([id, size]) => ({ id, size })) };
}

// One strategy per role: a person with no saved layout sees every widget of
// their role, KPIs first, then the charts, wide ones on a row of their own.
const patientLayout = (): DashboardLayout =>
  layoutFrom([
    ['kpi-tir', 'S'],
    ['kpi-gmi', 'S'],
    ['kpi-mean', 'S'],
    ['kpi-cv', 'S'],
    ['kpi-sensor-use', 'S'],
    ['card-freshness', 'S'],
    ['chart-zones', 'M'],
    ['chart-trend', 'L'],
    ['chart-daily-tir', 'M'],
    ['chart-alerts-type', 'M'],
    ['chart-agp', 'L'],
    ['chart-heatmap', 'L'],
    ['table-excursions', 'L'],
    ['chart-insulin-type', 'M'],
    ['chart-carbs-insulin', 'M'],
    ['chart-day-detail', 'L'],
  ]);

const professionalLayout = (): DashboardLayout =>
  layoutFrom([
    ['pro-kpi-patients', 'S'],
    ['pro-kpi-tir', 'S'],
    ['pro-kpi-gmi', 'S'],
    ['pro-kpi-hypo', 'S'],
    ['pro-kpi-stale', 'S'],
    ['pro-redeem-code', 'M'],
    ['pro-patients-table', 'L'],
    ['pro-tir-by-patient', 'M'],
    ['pro-tir-histogram', 'M'],
    ['pro-risk-scatter', 'M'],
    ['pro-hypo-by-hour', 'M'],
  ]);

const administratorLayout = (): DashboardLayout =>
  layoutFrom([
    ['adm-kpi-accounts', 'S'],
    ['adm-kpi-registrations', 'S'],
    ['adm-kpi-active-patients', 'S'],
    ['adm-kpi-grants', 'S'],
    ['adm-users-role', 'M'],
    ['adm-registrations', 'M'],
    ['adm-active-patients', 'M'],
    ['adm-readings-volume', 'M'],
    ['adm-grants', 'M'],
    ['adm-alerts', 'M'],
    ['adm-users-table', 'L'],
  ]);

const STRATEGIES: Readonly<Record<Role, () => DashboardLayout>> = {
  PATIENT: patientLayout,
  HEALTH_PROFESSIONAL: professionalLayout,
  ADMINISTRATOR: administratorLayout,
};

/** The layout a role gets until it saves its own (LAY-02). Each call returns a fresh value. */
export function defaultLayoutFor(role: Role): DashboardLayout {
  return STRATEGIES[role]();
}
