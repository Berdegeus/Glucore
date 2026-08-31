import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import {
  appErrorClassifier,
  createErrorHandler,
  createHealthRouter,
  httpContractClassifier,
  type HealthCheckable,
} from '@glucore/shared';

import { AccountController } from './modules/account/account.controller';
import { createAccountRouter } from './modules/account/account.routes';
import { createContainer, type Container } from './container';
import { MeController } from './modules/me/me.controller';
import { createMeRouter } from './modules/me/me.routes';
import { RegisterController } from './modules/register/register.controller';
import { createRegisterRouter } from './modules/register/register.routes';
import { createProxyRoute } from './routes/routingTable';
import { upstreamClassifier } from './middleware/upstreamClassifier';

export interface BuildAppOptions {
  /** Allowed CORS origins. Empty means "permissive", for local development. */
  corsOrigins?: string[];
  /** Request logging. Off by default so tests do not write to stdout. */
  requestLogging?: boolean;
  /** Wired dependencies. Defaults to the production composition root. */
  container?: Container;
}

const errorHandler = createErrorHandler([upstreamClassifier, appErrorClassifier, httpContractClassifier]);

/** No database here, so "ready" only ever proves the process itself is up. */
const noopHealthCheck: HealthCheckable = {
  async $queryRawUnsafe<T = unknown>(): Promise<T> {
    return undefined as T;
  },
};

/**
 * Assembles the Express application without binding a port, so supertest can
 * drive it in-process, the same as the other two services.
 *
 * Unlike them, `express.json()` is never mounted globally here: everything
 * under `/api/v1/{auth,readings,carbs,insulin,alerts,settings}` is a pure
 * proxy, and a global body parser would consume the request stream before
 * `http-proxy-middleware` can forward it — silently sending an empty body
 * downstream on every POST. The three composition routers below
 * (`/api/v1/auth/register`, `/api/v1/me`, `/api/v1/account`) each mount their
 * own `express.json()`, scoped to just that router.
 */
export function buildApp(options: BuildAppOptions = {}): Express {
  const { corsOrigins = [], requestLogging = false, container = createContainer() } = options;

  const app = express();
  app.set('trust proxy', 1);

  app.use('/health', createHealthRouter(noopHealthCheck));

  app.use(corsOrigins.length > 0 ? cors({ origin: corsOrigins }) : cors());
  if (requestLogging) app.use(morgan('dev'));

  // Composition, mounted before the generic auth proxy: a router only
  // handles the methods it declares (POST '/' here), so anything else under
  // /api/v1/auth/register falls through to the proxy below unchanged.
  app.use(
    '/api/v1/auth/register',
    createRegisterRouter(new RegisterController(container.registerSaga)),
  );

  // Public: login/forgot-password/reset-password/refresh/status/profile have
  // no internal-token concern — they hit the same public /auth/* routes as
  // before, authenticated by the end-user JWT alone. auth-service remains the
  // sole authority on every one of those responses.
  app.use('/api/v1/auth', createProxyRoute('auth', 'auth', container.registry));

  app.use(
    '/api/v1/me',
    createMeRouter(new MeController(container.authClient, container.glucoseClient), container.authenticate),
  );
  app.use(
    '/api/v1/account',
    createAccountRouter(new AccountController(container.authClient, container.glucoseClient), container.authenticate),
  );

  for (const prefix of ['readings', 'carbs', 'insulin', 'alerts', 'settings']) {
    app.use(
      `/api/v1/${prefix}`,
      container.authenticate,
      createProxyRoute(prefix, 'glucose', container.registry),
    );
  }

  app.use(errorHandler);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${new Date().toISOString()}] Unhandled error: ${err.message}`);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
