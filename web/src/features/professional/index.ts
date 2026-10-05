// Public API of the professional feature (ARQ-15): what the app shell may import.
// Loading the feature registers its widgets, so the layout use cases see them.
import './presentation/widgetCatalog';

export { ProfessionalServicesProvider } from './presentation/professionalServices';

/** The page as a module for `React.lazy`: the app loads it with its route, not with the login screen. */
export const loadProfessionalDashboardPage = () =>
  import('./presentation/professionalDashboardPage').then((module) => ({ default: module.ProfessionalDashboardPage }));

/** The linked patient's page, for `React.lazy` as well. */
export const loadPatientDetailPage = () =>
  import('./presentation/patientDetailPage').then((module) => ({ default: module.PatientDetailPage }));

// The notice of a revoked link is shared by the portfolio and the patient detail, so the routes hold it above both.
export { RevokedAccessProvider } from './presentation/revokedAccess';
