/**
 * `/carbs` — wiring only. Validation lives in `carbService`, HTTP translation
 * in `carbController`, queries in `carbRepository` (design.md "Camadas do
 * backend"). Nothing here touches Prisma.
 *
 * Endpoints:
 *   GET    /carbs?before=<epoch ms>&limit=<1..500>  → page, newest first
 *   POST   /carbs/item                              → 201 { id }
 *   PUT    /carbs/item/:id                          → 204 | 404
 *   DELETE /carbs/item/:id                          → 204 | 404
 *   POST   /carbs                                   → 204 (deprecated batch)
 */

import { Router } from 'express';
import type { RequireRoleOptions } from '../middleware/auth';
import { verifyJwt, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';
import { recordAudit } from '../lib/audit';
import type { CarbPrismaClient } from '../repositories/carbRepository';
import { createCarbRepository } from '../repositories/carbRepository';
import { createCarbService } from '../services/carbService';
import type { CarbController } from '../controllers/carbController';
import { createCarbController } from '../controllers/carbController';

export interface CarbsRouterDeps {
  /** Defaults to the production controller over the Prisma singleton. */
  controller?: CarbController;
  /** Lets a test authorize without a database (see `requireRole`). */
  requireRoleOptions?: RequireRoleOptions;
}

function defaultController(): CarbController {
  return createCarbController(
    createCarbService({
      repository: createCarbRepository(prisma as unknown as CarbPrismaClient),
      ensurePatient,
      recordAudit,
    }),
  );
}

export function createCarbsRouter(deps: CarbsRouterDeps = {}): Router {
  const controller = deps.controller ?? defaultController();
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT', deps.requireRoleOptions));

  router.get('/', asyncHandler(controller.list));
  router.post('/item', asyncHandler(controller.create));
  router.put('/item/:id', asyncHandler(controller.update));
  router.delete('/item/:id', asyncHandler(controller.remove));
  // Deprecated: replace-all em lote — usar POST /carbs/item, PUT/DELETE /carbs/item/:id.
  router.post('/', asyncHandler(controller.replaceAll));

  return router;
}

export default createCarbsRouter();
