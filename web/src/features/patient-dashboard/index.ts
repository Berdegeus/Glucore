// Public API of the patient-dashboard feature (ARQ-15): what the app shell may import.
// Loading the feature registers its widgets, so the layout use cases see them.
import './presentation/widgetCatalog';

export { DiaryServicesProvider } from './presentation/diaryServices';
export { PatientDashboardPage } from './presentation/patientDashboardPage';
export { SummaryServicesProvider } from './presentation/summaryServices';
