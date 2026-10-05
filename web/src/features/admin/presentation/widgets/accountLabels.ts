import type { Role } from '../../../../shared/domain/role';
import type { AccountStatus } from '../../domain/overview';

/** The roles in the words the administrator reads (ADM-02, ADM-04). */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  PATIENT: 'Pacientes',
  HEALTH_PROFESSIONAL: 'Profissionais de saúde',
  ADMINISTRATOR: 'Administradores',
};

/** One role in the singular, for a cell of the account list and for its filter. */
export const ROLE_NAMES: Readonly<Record<Role, string>> = {
  PATIENT: 'Paciente',
  HEALTH_PROFESSIONAL: 'Profissional de saúde',
  ADMINISTRATOR: 'Administrador',
};

export const STATUS_LABELS: Readonly<Record<AccountStatus, string>> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
  BLOCKED: 'Bloqueada',
};

/** A shape per status, so the badge is told apart by more than its hue (RSP-08). */
export const STATUS_ICONS: Readonly<Record<AccountStatus, string>> = {
  ACTIVE: '✓',
  INACTIVE: '–',
  BLOCKED: '✕',
};
