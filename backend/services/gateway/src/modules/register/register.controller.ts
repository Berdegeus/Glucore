import type { Request, Response } from 'express';

import type { RegisterSaga } from './register.saga';
import { parseRegisterSagaInput } from './register.schema';

export class RegisterController {
  constructor(private readonly saga: RegisterSaga) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = parseRegisterSagaInput((req.body ?? {}) as Record<string, unknown>);
    res.status(201).json(await this.saga.run(input));
  };
}
