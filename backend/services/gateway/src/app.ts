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

import { createContainer, type Container } from './container';
import { createProxyRoute } from './routes/routingTable';

export interface BuildAppOptions {
  /** Allowed CORS origins. Empty means "permissive", for local development. */
  corsOrigins?: string[];
  /** Request logging. Off by default so tests do not write to stdout. */
  requestLogging?: boolean;
  /** Wired dependencies. Defaults to the production composition root. */
  container?: Container;
}

const errorHandler = createErrorHandler([appErrorClassifier, httpContractClassifier]);

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
 * downstream on every POST. Phase 4.3's composition routes (`/me`,
 * `/account`, the registration saga) mount their own `express.json()`
 * locally, scoped to just those routers.
 */
export function buildApp(options: BuildAppOptions = {}): Express {
  const { corsOrigins = [], requestLogging = false, container = createContainer() } = options;

  const app = express();
  app.set('trust proxy', 1);

  app.use('/health', createHealthRouter(noopHealthCheck));

  app.use(corsOrigins.length > 0 ? cors({ origin: corsOrigins }) : cors());
  if (requestLogging) app.use(morgan('dev'));

  // Public: register/login/forgot-password/reset-password/refresh have no
  // Bearer token yet, or (refresh) verify it themselves downstream. The
  // gateway's own `authenticate` is not on this path at all — auth-service is
  // the authority on every /auth/* response.
  app.use('/api/v1/auth', createProxyRoute('auth', 'auth', container.registry));

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
