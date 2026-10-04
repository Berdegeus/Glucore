import { Router } from 'express';

/**
 * Duck-typed slice of `PrismaClient` — declared here instead of importing
 * `@prisma/client` so this package stays free of a Prisma dependency, the same
 * boundary `errorHandler.ts` draws for its classifiers.
 */
export interface HealthCheckable {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * `/live` never touches I/O — it only proves the process is scheduling
 * requests, which is what an orchestrator's liveness probe wants. `/ready`
 * proves the database is reachable, for a readiness probe deciding whether to
 * route traffic here. Failures are answered directly, never handed to the
 * app's error handler: this is infrastructure plumbing, not a business error.
 */
export function createHealthRouter(db: HealthCheckable): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get('/ready', async (_req, res) => {
    try {
      await db.$queryRawUnsafe('SELECT 1');
      res.status(200).json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', error: 'Database unavailable' });
    }
  });

  return router;
}
