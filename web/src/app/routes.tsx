import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { LoginPage, RequireRole } from '../features/auth';
import { loadPatientDashboardPage } from '../features/patient-dashboard';
import type { Role } from '../shared/domain/role';
import { Skeleton } from '../shared/presentation/ui/states';
import { AppShell } from './appShell';
import { NotFoundPage } from './notFoundPage';

// The dashboard is its own chunk: the login page does not download the charts.
const PatientDashboardPage = lazy(loadPatientDashboardPage);

export interface AppRoute {
  path: string;
  /** Only a signed-in person with this role sees the page; anyone else is redirected (ACC-03, ACC-04). */
  requiredRole: Role;
  page: ReactNode;
}

/**
 * The routes inside the app shell. A later phase adds `/profissional` and
 * `/admin` here, one entry each; until then a signed-in professional or
 * administrator is redirected to a path that shows the not-found page.
 */
export const APP_ROUTES: readonly AppRoute[] = [
  {
    path: '/paciente',
    requiredRole: 'PATIENT',
    page: (
      <Suspense fallback={<Skeleton height="12rem" />}>
        <PatientDashboardPage />
      </Suspense>
    ),
  },
];

/**
 * `/login` is public. `/` goes to the login, which sends someone already
 * signed in on to the home of their role (ACC-02). Anything else is not found.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {APP_ROUTES.map(({ path, requiredRole, page }) => (
        <Route
          key={path}
          path={path}
          element={
            <RequireRole requiredRole={requiredRole}>
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={page} />
        </Route>
      ))}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
