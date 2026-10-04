import type { TokenDto } from './schemas';

/** The access token the session is built on; the role is read separately from `/me`. */
export function toAccessToken(dto: TokenDto): string {
  return dto.token;
}
