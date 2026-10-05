import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { loadAdminDashboardPage } from '../features/admin';
import { LoginPage, RequireRole } from '../features/auth';
import { loadPatientDashboardPage } from '../features/patient-dashboard';
import { loadPatientDetailPage, loadProfessionalDashboardPage, RevokedAccessProvider } from '../features/professional';
import { loadRegisterProfessionalPage } from '../features/registration';
import type { Role } from '../shared/domain/role';
import { Skeleton } from '../shared/presentation/ui/states';
import { AppShell } from './appShell';
import { NotFoundPage } from './notFoundPage';

// Each page is its own chunk: the login page does not download the charts.
const PatientDashboardPage = lazy(loadPatientDashboardPage);
const ProfessionalDashboardPage = lazy(loadProfessionalDashboardPage);
const PatientDetailPage = lazy(loadPatientDetailPage);
const AdminDashboardPage = lazy(loadAdminDashboardPage);
const RegisterProfessionalPage = lazy(loadRegisterProfessionalPage);

/** A page that loads on demand, with a skeleton until its chunk arrives. */
const lazyPage = (page: ReactNode) => <Suspense fallback={<Skeleton height="12rem" />}>{page}</Suspense>;

/** A page below an `AppRoute`'s own path: it shares the route's role guard, shell and provider. */
export interface AppSubpage {
  /** Relative to the route's `path`, e.g. `pacientes/:id`. */
  path: string;
  page: ReactNode;
}

export interface AppRoute {
  path: string;
  /** Only a signed-in person with this role sees the page; anyone else is redirected (ACC-03, ACC-04). */
  requiredRole: Role;
  page: ReactNode;
  subpages?: readonly AppSubpage[];
  /** State the route's pages share, held inside the guard and around the shell so it outlives a move between them. */
  Provider?: ComponentType<{ children: ReactNode }>;
}

/**
 * The routes inside the app shell, one entry per role home: a signed-in person
 * with another role is redirected to the home of their own.
 */
export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/paciente', requiredRole: 'PATIENT', page: lazyPage(<PatientDashboardPage />) },
  {
    path: '/profissional',
    requiredRole: 'HEALTH_PROFESSIONAL',
    page: lazyPage(<ProfessionalDashboardPage />),
    subpages: [{ path: 'pacientes/:id', page: lazyPage(<PatientDetailPage />) }],
    Provider: RevokedAccessProvider,
  },
  { path: '/admin', requiredRole: 'ADMINISTRATOR', page: lazyPage(<AdminDashboardPage />) },
];

function protectedRoute({ path, requiredRole, page, subpages = [], Provider }: AppRoute) {
  const shell = Provider ? (
    <Provider>
      <AppShell />
    </Provider>
  ) : (
    <AppShell />
  );
  return (
    <Route key={path} path={path} element={<RequireRole requiredRole={requiredRole}>{shell}</RequireRole>}>
      <Route index element={page} />
      {subpages.map((subpage) => (
        <Route key={subpage.path} path={subpage.path} element={subpage.page} />
      ))}
    </Route>
  );
}

/**
 * `/login` and `/cadastro-profissional` are public. `/` goes to the login, which
 * sends someone already signed in on to the home of their role (ACC-02). Anything
 * else is not found.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro-profissional" element={lazyPage(<RegisterProfessionalPage />)} />
      {APP_ROUTES.map(protectedRoute)}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
