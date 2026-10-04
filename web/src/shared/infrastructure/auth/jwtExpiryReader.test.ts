import { describe, expect, it } from 'vitest';
import { JwtExpiryReader } from './jwtExpiryReader';

const base64Url = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenWith = (payload: unknown) => `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify(payload))}.signature`;

const EXP_SECONDS = 1_790_000_000;
const reader = new JwtExpiryReader();

describe('JwtExpiryReader (ACC-10)', () => {
  it('returns the expiry date of a well-formed token', () => {
    expect(reader.expiresAt(tokenWith({ sub: 'u1', exp: EXP_SECONDS }))).toEqual(new Date(EXP_SECONDS * 1000));
  });

  it('decodes a base64url payload, without padding and with - and _', () => {
    // `sub` is chosen so the encoded payload holds both base64url-only characters.
    const token = tokenWith({ sub: '?>?~>?', exp: EXP_SECONDS });
    expect(token.split('.')[1]).toMatch(/-/);
    expect(token.split('.')[1]).toMatch(/_/);

    expect(reader.expiresAt(token)).toEqual(new Date(EXP_SECONDS * 1000));
  });

  it.each([
    ['without exp', tokenWith({ sub: 'u1' })],
    ['with a non-numeric exp', tokenWith({ sub: 'u1', exp: '1790000000' })],
    ['with a JSON payload that is not an object', tokenWith(42)],
    ['with fewer than three parts', 'header.payload'],
    ['with a payload that is not base64url', 'header.@@@.signature'],
    ['with a payload that is not JSON', `header.${base64Url('not json')}.signature`],
    ['empty', ''],
  ])('returns null for a token %s', (_label, token) => {
    expect(reader.expiresAt(token)).toBeNull();
  });
});
