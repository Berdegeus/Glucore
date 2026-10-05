import type { Account } from '../domain/account';
import type { AccountDto, TokenDto } from './schemas';

/** The access token the session is built on; the role is read separately from `/me`. */
export function toAccessToken(dto: TokenDto): string {
  return dto.token;
}

export function toAccount(dto: AccountDto): Account {
  return {
    id: dto.id,
    email: dto.email,
    fullName: dto.fullName,
    phone: dto.phone ?? null,
    status: dto.status,
    role: dto.role,
    createdAt: dto.createdAt,
  };
}
