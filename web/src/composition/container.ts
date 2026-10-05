import { createLogin, type Login } from '../features/auth/application/login';
import { createLogout, type Logout, type SessionCleaner } from '../features/auth/application/logout';
import { createRefreshSession, type RefreshSession } from '../features/auth/application/refreshSession';
import { createRestoreSession, type RestoreSession } from '../features/auth/application/restoreSession';
import { HttpAccountRepository } from '../features/auth/infrastructure/httpAccountRepository';
import { HttpSessionRepository } from '../features/auth/infrastructure/httpSessionRepository';
import { resolveSession } from '../features/auth/application/resolveSession';
import { createLayoutUseCases, type LayoutUseCases } from '../features/dashboard-layout/application/layoutUseCases';
import { HttpLayoutRepository } from '../features/dashboard-layout/infrastructure/httpLayoutRepository';
import { createLoadDayDetail, type DiaryUseCases } from '../features/patient-dashboard/application/loadDayDetail';
import { createLoadPatientSummary, type SummaryUseCases } from '../features/patient-dashboard/application/loadPatientSummary';
import { HttpDiaryRepository } from '../features/patient-dashboard/infrastructure/httpDiaryRepository';
import { HttpSummaryRepository } from '../features/patient-dashboard/infrastructure/httpSummaryRepository';
import { createProfessionalUseCases, type ProfessionalUseCases } from '../features/professional/application/professionalUseCases';
import { HttpProfessionalRepository } from '../features/professional/infrastructure/httpProfessionalRepository';
import { HttpRedeemRepository } from '../features/professional/infrastructure/httpRedeemRepository';
import { createRegisterProfessional, type RegistrationUseCases } from '../features/registration/application/registerProfessional';
import { HttpRegistrationRepository } from '../features/registration/infrastructure/httpRegistrationRepository';
import { allDefinitions } from '../features/dashboard-layout/presentation/widgetRegistry';
import type { Clock, SessionEvents, TimeZoneProvider, TokenStore, Unsubscribe } from '../shared/domain/ports';
import { JwtExpiryReader } from '../shared/infrastructure/auth/jwtExpiryReader';
import { BrowserTimeZoneProvider, SystemClock } from '../shared/infrastructure/env/browserEnvironment';
import { SessionEventBus } from '../shared/infrastructure/events/sessionEventBus';
import { FetchHttpClient } from '../shared/infrastructure/http/fetchHttpClient';
import { SessionTokenStore } from '../shared/infrastructure/storage/sessionTokenStore';
import type { AppEnv } from './env';

/** Every route the gateway serves lives under this prefix; repositories use paths relative to it. */
const API_PREFIX = '/api/v1';

export interface AuthUseCases {
  login: Login;
  restoreSession: RestoreSession;
  logout: Logout;
  refreshSession: RefreshSession;
}

export interface Container {
  useCases: {
    auth: AuthUseCases;
    registration: RegistrationUseCases;
    professional: ProfessionalUseCases;
    layout: LayoutUseCases;
    summary: SummaryUseCases;
    patientDiary: DiaryUseCases;
  };
  /** The one bus: the HTTP client publishes on it and the UI subscribes to it (ACC-09). */
  sessionEvents: SessionEvents;
  tokenStore: TokenStore;
  clock: Clock;
  timeZone: TimeZoneProvider;
  /** Lets the UI have `logout` clear what it holds in memory, e.g. the query cache (ACC-11). */
  registerSessionCleaner(cleaner: SessionCleaner): Unsubscribe;
}

/**
 * The composition root (ARQ-08): the only module that picks adapters for the
 * ports and hands them to the use cases. Nothing else builds an adapter, and
 * there is no global to look one up from.
 */
export function createContainer(env: AppEnv): Container {
  const clock = new SystemClock();
  const tokenStore = new SessionTokenStore();
  const sessionEvents = new SessionEventBus();
  const baseUrl = `${env.apiUrl.replace(/\/+$/, '')}${API_PREFIX}`;
  const http = new FetchHttpClient({ baseUrl, tokenStore, sessionEvents });

  const sessions = new HttpSessionRepository(http);
  const accounts = new HttpAccountRepository(http);
  const registrations = new HttpRegistrationRepository(http);
  const professionals = new HttpProfessionalRepository(http);
  const redemptions = new HttpRedeemRepository(http);
  const layouts = new HttpLayoutRepository(http);
  const summaries = new HttpSummaryRepository(http);
  const diary = new HttpDiaryRepository(http);
  const timeZone = new BrowserTimeZoneProvider();
  const expiryReader = new JwtExpiryReader();
  const cleaners = new Set<SessionCleaner>();

  return {
    useCases: {
      auth: {
        login: createLogin({ sessions, accounts, tokenStore, sessionEvents, expiryReader }),
        restoreSession: createRestoreSession({ accounts, tokenStore, expiryReader, clock }),
        logout: createLogout({ tokenStore, cleaners }),
        refreshSession: createRefreshSession({ sessions, tokenStore, expiryReader, clock }),
      },
      registration: {
        registerProfessional: createRegisterProfessional({
          registrations,
          tokenStore,
          sessionEvents,
          resolveSession: (token) => resolveSession(token, { accounts, expiryReader }),
        }),
      },
      professional: createProfessionalUseCases({ professionals, redemptions, timeZone }),
      // The registry is read at load time: widgets register when their modules load.
      layout: createLayoutUseCases({ layouts, catalog: allDefinitions }),
      summary: { loadPatientSummary: createLoadPatientSummary({ summaries, timeZone }) },
      patientDiary: { loadDayDetail: createLoadDayDetail({ diary, timeZone }) },
    },
    sessionEvents,
    tokenStore,
    clock,
    timeZone,
    registerSessionCleaner(cleaner) {
      cleaners.add(cleaner);
      return () => {
        cleaners.delete(cleaner);
      };
    },
  };
}
