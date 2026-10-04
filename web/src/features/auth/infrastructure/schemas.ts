import * as z from 'zod';

/** `POST /auth/login` and `POST /auth/refresh` answer `{ token }` (extra fields are ignored). */
export const TokenDtoSchema = z.object({ token: z.string().min(1) });

export type TokenDto = z.infer<typeof TokenDtoSchema>;
