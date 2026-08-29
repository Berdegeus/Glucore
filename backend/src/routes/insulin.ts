/**
 * `/insulin` — wiring only. Validation lives in `insulinService`, HTTP
 * translation in `insulinController`, queries in `insulinRepository`
 * (design.md "Camadas do backend"). Nothing here touches Prisma.
 *
 * Endpoints:
 *   GET    /insulin?before=<epoch ms>&limit=<1..500>  → page, newest first
 *   POST   /insulin/item                              → 201 { id }
 *   PUT    /insulin/item/:id                          → 204 | 404
 *   DELETE /insulin/item/:id                          → 204 | 404
 *   POST   /insulin                                   → 204 (deprecated batch)
 */

import { Router } from 'express';
import type { RequireRoleOptions } from '../middleware/auth';
import { verifyJwt, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';
import { recordAudit } from '../lib/audit';
import type { InsulinPrismaClient } from '../repositories/insulinRepository';
import { createInsulinRepository } from '../repositories/insulinRepository';
import { createInsulinService } from '../services/insulinService';
import type { InsulinController } from '../controllers/insulinController';
import { createInsulinController } from '../controllers/insulinController';

export interface InsulinRouterDeps {
  /** Defaults to the production controller over the Prisma singleton. */
  controller?: InsulinController;
  /** Lets a test authorize without a database (see `requireRole`). */
  requireRoleOptions?: RequireRoleOptions;
}

function defaultController(): InsulinController {
  return createInsulinController(
    createInsulinService({
      repository: createInsulinRepository(prisma as unknown as InsulinPrismaClient),
      ensurePatient,
      recordAudit,
    }),
  );
}

export function createInsulinRouter(deps: InsulinRouterDeps = {}): Router {
  const controller = deps.controller ?? defaultController();
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT', deps.requireRoleOptions));

  router.get('/', asyncHandler(controller.list));
  router.post('/item', asyncHandler(controller.create));
  router.put('/item/:id', asyncHandler(controller.update));
  router.delete('/item/:id', asyncHandler(controller.remove));
  // Deprecated: replace-all em lote — usar POST /insulin/item, PUT/DELETE /insulin/item/:id.
  router.post('/', asyncHandler(controller.replaceAll));

  return router;
}

export default createInsulinRouter();
