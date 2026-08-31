import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createHealthRouter, type HealthCheckable } from '@glucore/shared';

import { createContainer, type Container } from './container';
import { prismaErrorHandler } from './middleware/prismaError';
import { prisma as defaultPrisma } from './lib/prisma';

export interface BuildAppOptions {
  /** Allowed CORS origins. Empty means "permissive", for local development. */
  corsOrigins?: string[];
  /** Request logging. Off by default so tests do not write to stdout. */
  requestLogging?: boolean;
  /**
   * Wired dependencies. Defaults to the production composition root, so an
   * integration test can call `buildApp()` with no arguments while a unit test
   * passes in-memory repositories or a cheaper password hasher.
   */
  container?: Container;
  /** Backs `/health/ready`. Defaults to the production Prisma singleton. */
  prisma?: HealthCheckable;
}

/**
 * Assembles the Express application without binding a port, so supertest can
 * drive the real routing and middleware stack in-process.
 */
export function buildApp(options: BuildAppOptions = {}): Express {
  const {
    corsOrigins = [],
    requestLogging = false,
    container = createContainer(),
    prisma = defaultPrisma,
  } = options;

  const app = express();
  app.set('trust proxy', 1);

  app.use('/health', createHealthRouter(prisma));

  app.use(corsOrigins.length > 0 ? cors({ origin: corsOrigins }) : cors());
  app.use(express.json());
  if (requestLogging) app.use(morgan('dev'));

  app.use('/auth', container.authRouter);
  app.use('/internal', container.internalRouter);

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
