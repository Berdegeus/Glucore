import type { Role } from '../../../shared/domain/role';

/**
 * Who is signed in, as `GET /me` describes them. The role decides the home
 * page and the dashboard; it never comes from the token (design: "Papel na web").
 */
export interface Account {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: string;
  role: Role;
  /** ISO 8601 instant. */
  createdAt: string;
}
