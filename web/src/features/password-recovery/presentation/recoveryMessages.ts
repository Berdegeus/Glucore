import { isAppError } from '../../../shared/domain/appError';
import { TOO_MANY_ATTEMPTS_MESSAGE, UNAVAILABLE_MESSAGE } from '../../auth';
import { PASSWORD_POLICY_HINT, WEAK_PASSWORD_CODE } from '../../registration';

export const INVALID_EMAIL_MESSAGE = 'Informe um e-mail válido';
export const REQUEST_SENT_MESSAGE = 'Se o e-mail estiver cadastrado, enviamos as instruções para redefinir a senha. Confira também o spam.';
export const INVALID_TOKEN_MESSAGE = 'Link inválido ou expirado. Peça um novo e-mail de recuperação.';
export const RECOVERY_FAILED_MESSAGE = 'Não foi possível concluir. Tente novamente.';

function common(error: unknown): string | null {
  if (!isAppError(error)) return RECOVERY_FAILED_MESSAGE;
  if (error.kind === 'rate-limited') return TOO_MANY_ATTEMPTS_MESSAGE;
  if (error.kind === 'unavailable') return UNAVAILABLE_MESSAGE;
  return null;
}

export function requestFailureMessage(error: unknown): string {
  const message = common(error);
  if (message) return message;
  return isAppError(error) && error.kind === 'validation' && error.code === 'INVALID_EMAIL' ? INVALID_EMAIL_MESSAGE : RECOVERY_FAILED_MESSAGE;
}

/** A refused token is the API's `400` without a code; a weak password carries its own. */
export function resetFailureMessage(error: unknown): string {
  const message = common(error);
  if (message) return message;
  if (!isAppError(error) || error.kind !== 'validation') return RECOVERY_FAILED_MESSAGE;
  return error.code === WEAK_PASSWORD_CODE ? PASSWORD_POLICY_HINT : INVALID_TOKEN_MESSAGE;
}
