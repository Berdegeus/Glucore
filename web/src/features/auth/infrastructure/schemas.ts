import * as z from 'zod';
import { ROLES } from '../../../shared/domain/role';

/** `POST /auth/login` and `POST /auth/refresh` answer `{ token }` (extra fields are ignored). */
export const TokenDtoSchema = z.object({ token: z.string().min(1) });

export type TokenDto = z.infer<typeof TokenDtoSchema>;

/**
 * `GET /me`: the account block, plus a `patient` or `professional` block for
 * the roles that have one. Unknown keys are stripped, so those blocks and any
 * field the API adds later are tolerated; an unknown `role` is not.
 */
export const AccountDtoSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  fullName: z.string(),
  phone: z.string().nullish(),
  status: z.string(),
  role: z.enum(ROLES),
  createdAt: z.string(),
});

export type AccountDto = z.infer<typeof AccountDtoSchema>;
