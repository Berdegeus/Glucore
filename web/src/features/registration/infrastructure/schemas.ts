import * as z from 'zod';

/** `POST /auth/register/professional` answers `201 { userId, token }` (REG-01); extra fields are ignored. */
export const RegistrationDtoSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(1),
});

export type RegistrationDto = z.infer<typeof RegistrationDtoSchema>;
