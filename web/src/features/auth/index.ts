// Public API of the auth feature (ARQ-15): what other features and the app shell may import.
export { AuthProvider, SESSION_EXPIRED_MESSAGE, useAuth } from './presentation/authProvider';
export type { AuthServices, AuthState } from './presentation/authProvider';
export { LoginPage } from './presentation/loginPage';
export { RequireRole } from './presentation/requireRole';
export { useSessionRefresh } from './presentation/useSessionRefresh';
