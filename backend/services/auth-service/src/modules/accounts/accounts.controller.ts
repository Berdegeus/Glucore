import type { Response } from 'express';
import { auditRequestContext } from '@glucore/shared';

import type { AuthRequest } from '../../middleware/auth';

import type { AccountsService } from './accounts.service';
import { parseRegister, parseUpdateAccount } from './accounts.schema';

/** Reads the request, calls the service, picks the status. No Prisma, no rules. */
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  register = async (req: AuthRequest, res: Response): Promise<void> => {
    const input = parseRegister(req.body ?? {});
    const { token } = await this.service.register(input, auditRequestContext(req));
    res.status(201).json({ token });
  };

  getAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    res.json(await this.service.getAccount(req.userId as string));
  };

  updateAccount = async (req: AuthRequest, res: Response): Promise<void> => {
    const input = parseUpdateAccount(req.body ?? {});
    await this.service.updateAccount(req.userId as string, input, auditRequestContext(req));
    res.json({ message: 'Profile updated.' });
  };
}
