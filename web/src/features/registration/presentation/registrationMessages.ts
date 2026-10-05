import { isAppError } from '../../../shared/domain/appError';
import { TOO_MANY_ATTEMPTS_MESSAGE, UNAVAILABLE_MESSAGE } from '../../auth';
import { PASSWORD_POLICY_HINT, WEAK_PASSWORD_CODE } from '../domain/passwordPolicy';
import type { RegistrationProblem } from '../domain/registration';

export const EMAIL_TAKEN_MESSAGE = 'Este e-mail já está cadastrado';
export const REGISTRATION_FAILED_MESSAGE = 'Não foi possível criar a conta. Tente novamente.';
export const REVIEW_FIELDS_MESSAGE = 'Confira os dados informados.';

export type RegistrationField = 'fullName' | 'email' | 'password' | 'licenseNumber' | 'specialty';

/** The reason each refused field is shown with, and the field it belongs to. */
const PROBLEMS: Record<RegistrationProblem, { field: RegistrationField; message: string }> = {
  INVALID_FULL_NAME: { field: 'fullName', message: 'Informe o nome completo' },
  INVALID_EMAIL: { field: 'email', message: 'Informe um e-mail válido' },
  [WEAK_PASSWORD_CODE]: { field: 'password', message: PASSWORD_POLICY_HINT },
  INVALID_LICENSE_NUMBER: { field: 'licenseNumber', message: 'Informe o número de registro, com até 40 caracteres' },
  INVALID_SPECIALTY: { field: 'specialty', message: 'Informe a especialidade, com até 80 caracteres' },
};

export interface RegistrationFailure {
  message: string;
  /** The field to flag, when the refusal names one. */
  field?: RegistrationField;
}

function isProblem(code: string | undefined): code is RegistrationProblem {
  return code !== undefined && Object.hasOwn(PROBLEMS, code);
}

/** Maps what the registration rejected with onto the message of the contract (REG-02, REG-03, REG-07). */
export function registrationFailure(error: unknown): RegistrationFailure {
  if (!isAppError(error)) return { message: REGISTRATION_FAILED_MESSAGE };
  switch (error.kind) {
    case 'conflict':
      return { message: EMAIL_TAKEN_MESSAGE, field: 'email' };
    case 'rate-limited':
      return { message: TOO_MANY_ATTEMPTS_MESSAGE };
    case 'unavailable':
      return { message: UNAVAILABLE_MESSAGE };
    case 'validation':
      return isProblem(error.code) ? PROBLEMS[error.code] : { message: REVIEW_FIELDS_MESSAGE };
    default:
      return { message: REGISTRATION_FAILED_MESSAGE };
  }
}
