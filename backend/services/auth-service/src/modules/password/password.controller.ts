import type { Response } from 'express';
import { auditRequestContext, type AuthRequest } from '@glucore/shared';

import type { PasswordService } from './password.service';
import { parseForgotPassword, parseResetPassword } from './password.schema';

export class PasswordController {
  constructor(private readonly service: PasswordService) {}

  forgotPassword = async (req: AuthRequest, res: Response): Promise<void> => {
    const email = parseForgotPassword(req.body ?? {});
    res.json(await this.service.forgotPassword(email, auditRequestContext(req)));
  };

  resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
    const input = parseResetPassword(req.body ?? {});
    res.json(await this.service.resetPassword(input, auditRequestContext(req)));
  };
}
