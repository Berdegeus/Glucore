// Public API of the password-recovery feature (ARQ-15): what the app shell may import.
export { PasswordRecoveryServicesProvider } from './presentation/passwordRecoveryServices';

/** The pages as modules for `React.lazy`: they load with their routes, not with the login screen. */
export const loadForgotPasswordPage = () =>
  import('./presentation/forgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage }));
export const loadResetPasswordPage = () =>
  import('./presentation/resetPasswordPage').then((module) => ({ default: module.ResetPasswordPage }));
