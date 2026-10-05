// Public API of the administrator feature (ARQ-15): what the app shell may import.
// Loading the feature registers its widgets, so the layout use cases see them.
import './presentation/widgetCatalog';

export { AdminServicesProvider } from './presentation/adminServices';
