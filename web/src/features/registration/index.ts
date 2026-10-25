// Public API of the registration feature (ARQ-15): what the app shell may import.
export { RegistrationServicesProvider } from './presentation/registrationServices';
// The product's one password rule, for the password-recovery feature (ARQ-15).
export { PASSWORD_POLICY_HINT, validatePassword, WEAK_PASSWORD_CODE } from './domain/passwordPolicy';

/** The page as a module for `React.lazy`: the app loads it with its route, not with the login screen. */
export const loadRegisterProfessionalPage = () =>
  import('./presentation/registerProfessionalPage').then((module) => ({ default: module.RegisterProfessionalPage }));
