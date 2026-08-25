import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRouter from './routes/auth';
import readingsRouter from './routes/readings';
import carbsRouter from './routes/carbs';
import insulinRouter from './routes/insulin';
import alertsRouter from './routes/alerts';
import settingsRouter from './routes/settings';
import { prismaErrorHandler } from './middleware/prismaError';

export interface BuildAppOptions {
  /** Allowed CORS origins. Empty means "permissive", for local development. */
  corsOrigins?: string[];
  /** Request logging. Off by default so tests do not write to stdout. */
  requestLogging?: boolean;
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
  const { corsOrigins = [], requestLogging = false } = options;

  const app = express();

  app.use(corsOrigins.length > 0 ? cors({ origin: corsOrigins }) : cors());
  app.use(express.json());
  if (requestLogging) app.use(morgan('dev'));

  app.use('/auth', authRouter);
  app.use('/readings', readingsRouter);
  app.use('/carbs', carbsRouter);
  app.use('/insulin', insulinRouter);
  app.use('/alerts', alertsRouter);
  app.use('/settings', settingsRouter);

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
