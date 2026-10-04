import type { Account } from '../features/auth/domain/account';
import type { Role } from '../shared/domain/role';
import type { TokenStore } from '../shared/domain/ports';

/** In-memory `TokenStore` that records nothing but its own value. */
export function memoryTokenStore(initial: string | null = null): TokenStore {
  let token = initial;
  return {
    persistent: true,
    read: () => token,
    save: (value) => {
      token = value;
    },
    clear: () => {
      token = null;
    },
  };
}

export function accountOf(role: Role = 'PATIENT'): Account {
  return {
    id: 'u1',
    email: 'ana@example.com',
    fullName: 'Ana Souza',
    phone: null,
    status: 'ACTIVE',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}
