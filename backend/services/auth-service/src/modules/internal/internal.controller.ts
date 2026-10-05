import type { Request, Response } from 'express';
import { auditRequestContext, type InternalAuthRequest } from '@glucore/shared';

import { parseLookupIds, parseRegister, parseUpdateAccount } from '../accounts/accounts.schema';
import type { AccountsService } from '../accounts/accounts.service';

/**
 * The gateway's only way to reach this service's identity data. Two shapes of
 * route live here: identity-scoped ("me", authorized by the caller's own
 * internal token) and explicit-id (registration and delete, where there is no
 * caller identity yet or the identity check already happened at the gateway).
 */
export class InternalAccountsController {
  constructor(private readonly accounts: AccountsService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = parseRegister(req.body ?? {});
    const { userId, token } = await this.accounts.register(input, auditRequestContext(req));
    res.status(201).json({ userId, token });
  };

  /**
   * The role is the route's, not the body's (REG-06): `parseRegister` only reads
   * the fields it knows, so a `role` in the body never reaches the service.
   */
  registerProfessional = async (req: Request, res: Response): Promise<void> => {
    const input = parseRegister(req.body ?? {});
    const { userId, token } = await this.accounts.registerProfessional(input, auditRequestContext(req));
    res.status(201).json({ userId, token });
  };

  getMe = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    res.json(await this.accounts.getAccount(req.internalUserId as string));
  };

  updateMe = async (req: InternalAuthRequest, res: Response): Promise<void> => {
    const input = parseUpdateAccount(req.body ?? {});
    await this.accounts.updateAccount(req.internalUserId as string, input, auditRequestContext(req));
    res.json({ message: 'Profile updated.' });
  };

  lookup = async (req: Request, res: Response): Promise<void> => {
    const ids = parseLookupIds(req.body ?? {});
    res.json(await this.accounts.lookupNames(ids));
  };

  deleteById = async (req: Request, res: Response): Promise<void> => {
    await this.accounts.deleteAccount(req.params.id);
    res.status(204).send();
  };
}
