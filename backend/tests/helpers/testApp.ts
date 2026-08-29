/**
 * Builds a throwaway Express app around one router, plus tokens signed with the
 * same secret the middleware will verify.
 *
 * Importing this module sets `JWT_SECRET`. `src/lib/env.ts` aborts the process
 * when the variable is missing, and static imports run before the test body, so
 * setting it here guarantees it is in place before any `src/` module loads.
 */

import express from 'express';
import type { Express, Router } from 'express';
import jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'test-secret-for-unit-tests';

process.env.JWT_SECRET = TEST_JWT_SECRET;

export function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

export function buildApp(mountPath: string, router: Router): Express {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  return app;
}
