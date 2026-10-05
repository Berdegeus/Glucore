// Public API of the patient-dashboard feature (ARQ-15): what the app shell may import.
// Loading the feature registers its widgets, so the layout use cases see them.
import './presentation/widgetCatalog';

export { DiaryServicesProvider } from './presentation/diaryServices';
export { SummaryServicesProvider } from './presentation/summaryServices';

/** The page as a module for `React.lazy`: the app loads it with its route, not with the login screen. */
export const loadPatientDashboardPage = () =>
  import('./presentation/patientDashboardPage').then((module) => ({ default: module.PatientDashboardPage }));
