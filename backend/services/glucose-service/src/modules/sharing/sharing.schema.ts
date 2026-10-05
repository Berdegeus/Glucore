import { BadRequestError } from '@glucore/shared';

/**
 * The code a professional typed. Only its type is checked here: whether it is
 * well formed, known, fresh and unused is one question with one answer
 * (`INVALID_INVITE`), decided by the service, so a malformed code cannot be told
 * apart from a wrong one by its error.
 */
export function parseRedeemBody(body: unknown): string {
  const { code } = (body ?? {}) as { code?: unknown };
  if (typeof code !== 'string') throw new BadRequestError('Invalid input');
  return code;
}
