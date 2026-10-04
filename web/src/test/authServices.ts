import { vi } from 'vitest';
import { createLogout, type SessionCleaner } from '../features/auth/application/logout';
import type { Session } from '../features/auth/domain/session';
import type { AuthServices } from '../features/auth/presentation/authProvider';
import type { Role } from '../shared/domain/role';
import { accountOf, memoryTokenStore, sessionEventBus } from './authFakes';

export function sessionOf(role: Role = 'PATIENT', fullName = 'Ana Souza'): Session {
  return { account: { ...accountOf(role), fullName }, expiresAt: null };
}

/**
 * Real event bus and real `createLogout`; the network use cases are fakes the
 * test can override. Nobody is signed in at first, and `login` signs in as `loginRole`.
 */
export function makeAuthServices(overrides: Partial<AuthServices> = {}, loginRole: Role = 'PATIENT') {
  const tokenStore = memoryTokenStore('token-1');
  const sessionEvents = sessionEventBus();
  const cleaners = new Set<SessionCleaner>();
  const logout = vi.fn(createLogout({ tokenStore, cleaners }));
  const services: AuthServices = {
    restoreSession: vi.fn().mockResolvedValue(null),
    login: vi.fn().mockImplementation(async () => {
      sessionEvents.reset();
      return sessionOf(loginRole);
    }),
    logout,
    sessionEvents,
    registerSessionCleaner(cleaner) {
      cleaners.add(cleaner);
      return () => cleaners.delete(cleaner);
    },
    ...overrides,
  };
  return { services, tokenStore, sessionEvents, logout };
}

/** Services whose restore finds a person already signed in as `role`. */
export function signedInAs(role: Role, fullName?: string) {
  return makeAuthServices({ restoreSession: vi.fn().mockResolvedValue(sessionOf(role, fullName)) });
}
