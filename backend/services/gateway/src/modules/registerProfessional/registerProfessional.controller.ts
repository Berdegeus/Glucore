import type { Request, Response } from 'express';

import type { RegisterProfessionalSaga } from './registerProfessional.saga';
import { parseRegisterProfessionalInput } from './registerProfessional.schema';

export class RegisterProfessionalController {
  constructor(private readonly saga: RegisterProfessionalSaga) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = parseRegisterProfessionalInput((req.body ?? {}) as Record<string, unknown>);
    res.status(201).json(await this.saga.run(input));
  };
}
