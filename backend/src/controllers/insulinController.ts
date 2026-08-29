/**
 * HTTP translation for `/insulin`: reads the request, calls the service, maps
 * the result to a status and a body. No Prisma, no business rule.
 */

import type { Response } from 'express';
import { auditRequestContext } from '../lib/audit';
import type { AuthRequest } from '../middleware/auth';
import type { InsulinService } from '../services/insulinService';
import type { RequestContext } from '../services/requestContext';
import { sendFailure } from './httpFailure';

export interface InsulinController {
  list(req: AuthRequest, res: Response): Promise<void>;
  create(req: AuthRequest, res: Response): Promise<void>;
  update(req: AuthRequest, res: Response): Promise<void>;
  remove(req: AuthRequest, res: Response): Promise<void>;
  replaceAll(req: AuthRequest, res: Response): Promise<void>;
}

function contextOf(req: AuthRequest): RequestContext {
  return { userId: req.userId!, ...auditRequestContext(req) };
}

export function createInsulinController(service: InsulinService): InsulinController {
  return {
    async list(req, res) {
      const result = await service.list(req.userId!, req.query);
      if (!result.ok) {
        sendFailure(res, result.failure);
        return;
      }
      res.json(result.value);
    },

    async create(req, res) {
      const result = await service.create(contextOf(req), req.body);
      if (!result.ok) {
        sendFailure(res, result.failure);
        return;
      }
      res.status(201).json(result.value);
    },

    async update(req, res) {
      const result = await service.update(contextOf(req), req.params.id, req.body);
      if (!result.ok) {
        sendFailure(res, result.failure);
        return;
      }
      res.status(204).send();
    },

    async remove(req, res) {
      const result = await service.remove(contextOf(req), req.params.id);
      if (!result.ok) {
        sendFailure(res, result.failure);
        return;
      }
      res.status(204).send();
    },

    async replaceAll(req, res) {
      const result = await service.replaceAll(contextOf(req), req.body);
      if (!result.ok) {
        sendFailure(res, result.failure);
        return;
      }
      res.status(204).send();
    },
  };
}
