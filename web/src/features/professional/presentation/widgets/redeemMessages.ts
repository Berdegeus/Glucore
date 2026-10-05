import { isAppError } from '../../../../shared/domain/appError';
import { INVALID_INVITE_CODE } from '../../application/professionalUseCases';

export const EMPTY_CODE_MESSAGE = 'Informe o código que o paciente gerou no aplicativo';
export const INVALID_INVITE_MESSAGE = 'Código inválido ou expirado';
export const RATE_LIMITED_MESSAGE = 'Muitas tentativas. Tente novamente em alguns minutos.';
export const UNAVAILABLE_MESSAGE = 'Serviço indisponível. Tente novamente em instantes.';
export const REDEEM_FAILED_MESSAGE = 'Não foi possível vincular o paciente. Tente novamente.';
/** The server does not say whether the patient was already linked (`201` against `200`), so a success is just this (PRO-02). */
export const LINKED_MESSAGE = 'Paciente vinculado';

function rateLimitedMessage(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined) return RATE_LIMITED_MESSAGE;
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Muitas tentativas. Tente novamente em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`;
}

/** The sentence for what the redeem call rejected with (CON-05): the same one for every bad code. */
export function redeemErrorMessage(error: unknown): string {
  if (!isAppError(error)) return REDEEM_FAILED_MESSAGE;
  if (error.kind === 'validation' && error.code === INVALID_INVITE_CODE) return INVALID_INVITE_MESSAGE;
  if (error.kind === 'rate-limited') return rateLimitedMessage(error.retryAfterSeconds);
  if (error.kind === 'unavailable') return UNAVAILABLE_MESSAGE;
  return REDEEM_FAILED_MESSAGE;
}
