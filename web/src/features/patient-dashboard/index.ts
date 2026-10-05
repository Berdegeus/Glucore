// Public API of the patient-dashboard feature (ARQ-15): what the app shell may import.
// Loading the feature registers its widgets, so the layout use cases see them.
import './presentation/widgetCatalog';

export { DiaryServicesProvider } from './presentation/diaryServices';
export { SummaryServicesProvider } from './presentation/summaryServices';

/** The page as a module for `React.lazy`: the app loads it with its route, not with the login screen. */
export const loadPatientDashboardPage = () =>
  import('./presentation/patientDashboardPage').then((module) => ({ default: module.PatientDashboardPage }));

// What a page that shows a linked patient's summary reuses (the professional's patient detail, PRO-08):
// the period filter and its provider, the scope that points the widgets at a patient, and the summary query.
export { PeriodFilter } from './presentation/periodFilter';
export { PeriodProvider } from './presentation/periodContext';
export { SummaryScopeProvider } from './presentation/summaryScope';
export { todayInBrowserZone } from './presentation/today';
export { useSummary } from './presentation/useSummary';
export { DEFAULT_PRESET, toRange } from './domain/period';
export type { DateRange } from './domain/period';

// Labels of the patient's summary that the administrator's charts speak in as well: alert types and calendar days.
export { alertLabel } from './presentation/widgets/alertLabels';
export { fullDay, shortDay } from './presentation/widgets/dayLabel';
