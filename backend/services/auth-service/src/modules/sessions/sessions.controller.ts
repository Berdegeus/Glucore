import type { Response } from 'express';
import { auditRequestContext, type AuthRequest } from '@glucore/shared';

import type { SessionsService } from './sessions.service';
import { parseLogin } from './sessions.schema';

export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  login = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.login(parseLogin(req.body ?? {}), auditRequestContext(req)));
  };

  /**
   * Answers from the verified token alone — no database read. It exists so a
   * client can tell whether the token it holds is still good, and after the
   * split there is nothing else to check without one.
   */
  status = (req: AuthRequest, res: Response): void => {
    res.json({ loggedIn: true, userId: req.userId });
  };
}
