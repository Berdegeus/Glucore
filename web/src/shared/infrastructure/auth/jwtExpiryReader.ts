function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
}

function payloadOf(token: string): unknown {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1])) as unknown;
  } catch {
    return null;
  }
}

/**
 * Reads the `exp` claim so the session can schedule its refresh (ACC-10).
 * It does not check the signature and authorizes nothing: the API decides
 * whether a token is valid.
 */
export class JwtExpiryReader {
  expiresAt(token: string): Date | null {
    const payload = payloadOf(token);
    if (typeof payload !== 'object' || payload === null) return null;
    const { exp } = payload as { exp?: unknown };
    return typeof exp === 'number' && Number.isFinite(exp) ? new Date(exp * 1000) : null;
  }
}
