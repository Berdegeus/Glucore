/**
 * `/alerts` — wiring only. Validation lives in `alertService`, HTTP
 * translation in `alertController`, queries and the enum mapping in
 * `alertRepository` (design.md "Camadas do backend"). Nothing here touches
 * Prisma.
 *
 * Endpoints:
 *   GET    /alerts?before=<epoch ms>&limit=<1..500>  → page, newest first
 *   POST   /alerts/item                              → 201 { id }
 *   PUT    /alerts/item/:id                          → 204 | 404
 *   DELETE /alerts/item/:id                          → 204 | 404
 *   POST   /alerts                                   → 204 (deprecated batch)
 */

import { Router } from 'express';
import type { RequireRoleOptions } from '../middleware/auth';
import { verifyJwt, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { ensurePatient } from '../lib/patient';
import { recordAudit } from '../lib/audit';
import type { AlertPrismaClient } from '../repositories/alertRepository';
import { createAlertRepository } from '../repositories/alertRepository';
import { createAlertService } from '../services/alertService';
import type { AlertController } from '../controllers/alertController';
import { createAlertController } from '../controllers/alertController';

export interface AlertsRouterDeps {
  /** Defaults to the production controller over the Prisma singleton. */
  controller?: AlertController;
  /** Lets a test authorize without a database (see `requireRole`). */
  requireRoleOptions?: RequireRoleOptions;
}

function defaultController(): AlertController {
  return createAlertController(
    createAlertService({
      repository: createAlertRepository(prisma as unknown as AlertPrismaClient),
      ensurePatient,
      recordAudit,
    }),
  );
}

export function createAlertsRouter(deps: AlertsRouterDeps = {}): Router {
  const controller = deps.controller ?? defaultController();
  const router = Router();

  router.use(verifyJwt);
  router.use(requireRole('PATIENT', deps.requireRoleOptions));

  router.get('/', asyncHandler(controller.list));
  router.post('/item', asyncHandler(controller.create));
  router.put('/item/:id', asyncHandler(controller.update));
  router.delete('/item/:id', asyncHandler(controller.remove));
  // Deprecated: replace-all em lote — usar POST /alerts/item, PUT/DELETE /alerts/item/:id.
  router.post('/', asyncHandler(controller.replaceAll));

  return router;
}

export default createAlertsRouter();
