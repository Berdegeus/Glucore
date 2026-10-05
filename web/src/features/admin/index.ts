// Public API of the administrator feature (ARQ-15): what the app shell may import.
// Loading the feature registers its widgets, so the layout use cases see them.
import './presentation/widgetCatalog';

export { AdminServicesProvider } from './presentation/adminServices';

/** The page as a module for `React.lazy`: the app loads it with its route, not with the login screen. */
export const loadAdminDashboardPage = () =>
  import('./presentation/adminDashboardPage').then((module) => ({ default: module.AdminDashboardPage }));
