import { randomUUID } from 'node:crypto';

import type { NextFunction, Response } from 'express';
import { createVerifyJwt, type AuthRequest } from '@glucore/shared';

export interface GatewayRequest extends AuthRequest {
  requestId?: string;
}

/**
 * Verifies the end-user Bearer token and stamps a request id, used for log
 * correlation across the hop to whichever service handles the request.
 *
 * This is the gateway's own copy rather than a bare `createVerifyJwt` call:
 * once phase 4.2 lands, this is also where the internal token gets minted
 * from the claims this middleware already verified.
 */
export function createAuthenticate(getSecret: () => string) {
  const verifyJwt = createVerifyJwt(getSecret);

  return function authenticate(req: GatewayRequest, res: Response, next: NextFunction): void {
    req.requestId = randomUUID();
    verifyJwt(req, res, next);
  };
}
