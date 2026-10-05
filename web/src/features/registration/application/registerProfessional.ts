import { AppError } from '../../../shared/domain/appError';
import type { SessionEvents, TokenStore } from '../../../shared/domain/ports';
import type { Session } from '../../auth';
import {
  checkRegistration,
  normalizeRegistration,
  type ProfessionalRegistration,
  type RegistrationRepository,
} from '../domain/registration';

export interface RegisterProfessionalDeps {
  registrations: RegistrationRepository;
  tokenStore: TokenStore;
  sessionEvents: SessionEvents;
  /** Builds the session for the stored token: `/me` gives the role, as at login. */
  resolveSession(token: string): Promise<Session>;
}

export type RegisterProfessional = (registration: ProfessionalRegistration) => Promise<Session>;

/**
 * Opens a professional's account and signs them in (REG-01). The fields are
 * checked first (REG-02, REG-05): an invalid one rejects with a `validation`
 * error carrying the reason and nothing goes out on the network. Then the
 * flow is the login's: store the returned token, read the role in `/me`. A
 * failure after the token is stored removes it again, so a half finished
 * sign-in never leaves a session behind.
 */
export function createRegisterProfessional(deps: RegisterProfessionalDeps): RegisterProfessional {
  return async (input) => {
    const registration = normalizeRegistration(input);
    const problem = checkRegistration(registration);
    if (problem) throw new AppError('validation', { code: problem });

    const { token } = await deps.registrations.registerProfessional(registration);
    deps.tokenStore.save(token);
    try {
      const session = await deps.resolveSession(token);
      // A new sign-in re-arms the expiry notice for the next session (ACC-09).
      deps.sessionEvents.reset();
      return session;
    } catch (error) {
      deps.tokenStore.clear();
      throw error;
    }
  };
}
