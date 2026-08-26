import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRouter from './routes/auth';
import { createAlertsRouter } from './modules/alerts/alerts.routes';
import { createCarbsRouter } from './modules/carbs/carbs.routes';
import { createInsulinRouter } from './modules/insulin/insulin.routes';
import { createReadingsRouter } from './modules/readings/readings.routes';
import { createSettingsRouter } from './modules/settings/settings.routes';
import { prismaErrorHandler } from './middleware/prismaError';
import { createContainer, type Container } from './container';

export interface BuildAppOptions {
  /** Allowed CORS origins. Empty means "permissive", for local development. */
  corsOrigins?: string[];
  /** Request logging. Off by default so tests do not write to stdout. */
  requestLogging?: boolean;
  /**
   * Wired dependencies. Defaults to the production composition root, so an
   * integration test can keep calling `buildApp()` while a unit test passes
   * in-memory repositories.
   */
  container?: Container;
}

/**
 * Assembles the Express application without binding a port.
 *
 * Separating this from `index.ts` is what lets supertest drive the real routing
 * and middleware stack in-process: `request(buildApp())` exercises the same
 * pipeline the server runs, with no listening socket and no port collisions
 * between parallel test files.
 */
export function buildApp(options: BuildAppOptions = {}): Express {
  const { corsOrigins = [], requestLogging = false, container = createContainer() } = options;

  const app = express();

  app.use(corsOrigins.length > 0 ? cors({ origin: corsOrigins }) : cors());
  app.use(express.json());
  if (requestLogging) app.use(morgan('dev'));

  app.use('/auth', authRouter);
  app.use('/readings', createReadingsRouter(container.readings));
  app.use('/carbs', createCarbsRouter(container.carbs));
  app.use('/insulin', createInsulinRouter(container.insulin));
  app.use('/alerts', createAlertsRouter(container.alerts));
  app.use('/settings', createSettingsRouter(container.settings));

  // Classifies known failures into `{ error, code }`; the handler below is the
  // last-resort net for anything it delegates (response already started).
  app.use(prismaErrorHandler);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`[${new Date().toISOString()}] Unhandled error: ${err.message}`);
    if (process.env.NODE_ENV !== 'production') console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
