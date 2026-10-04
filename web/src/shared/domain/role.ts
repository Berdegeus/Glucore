/** Same values as the backend's `UserRole` enum; the role always comes from `/me`. */
export const ROLES = ['PATIENT', 'HEALTH_PROFESSIONAL', 'ADMINISTRATOR'] as const;

export type Role = (typeof ROLES)[number];

const HOME_PATHS: Record<Role, string> = {
  PATIENT: '/paciente',
  HEALTH_PROFESSIONAL: '/profissional',
  ADMINISTRATOR: '/admin',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** The page each role lands on after login (ACC-02). */
export function homePathFor(role: Role): string {
  return HOME_PATHS[role];
}
