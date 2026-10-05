import crypto from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  hashInviteCode,
  normalizeInviteCode,
} from '../../src/modules/sharing/inviteCode';

/** CON-02: 8 characters from a 32-symbol alphabet without 0, O, 1, I, from a CSPRNG. */

/** `randomInt` is overloaded, so a stub that always answers `n` needs a cast. */
const fixedRandom = (n: number) => (() => n) as unknown as typeof crypto.randomInt;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('INVITE_ALPHABET', () => {
  it('has exactly 32 distinct symbols', () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    expect(new Set(INVITE_ALPHABET).size).toBe(32);
  });

  it.each(['0', 'O', '1', 'I'])('does not contain the ambiguous symbol %s', (symbol) => {
    expect(INVITE_ALPHABET).not.toContain(symbol);
  });
});

describe('generateInviteCode', () => {
  it('produces 8 characters, all from the alphabet, over 1000 codes', () => {
    expect(INVITE_CODE_LENGTH).toBe(8);
    for (let i = 0; i < 1000; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
      for (const char of code) expect(INVITE_ALPHABET).toContain(char);
    }
  });

  it('uses crypto.randomInt, once per character, bounded by the alphabet size', () => {
    const spy = vi.spyOn(crypto, 'randomInt').mockImplementation(fixedRandom(0));

    expect(generateInviteCode()).toBe('AAAAAAAA');
    expect(spy).toHaveBeenCalledTimes(8);
    expect(spy).toHaveBeenCalledWith(32);
  });

  it('maps the extremes of the random range to the first and last symbol', () => {
    vi.spyOn(crypto, 'randomInt').mockImplementation(fixedRandom(31));
    expect(generateInviteCode()).toBe('9'.repeat(8));
  });

  it('does not repeat across 1000 draws (the space is 32^8)', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateInviteCode()));
    expect(codes.size).toBe(1000);
  });
});

describe('normalizeInviteCode', () => {
  it.each([
    ['ABCD2345', 'ABCD2345'],
    ['abcd2345', 'ABCD2345'],
    ['  ABCD2345  ', 'ABCD2345'],
    ['ABCD 2345', 'ABCD2345'],
    ['abcd-2345', 'ABCD2345'],
    [' a b-c d - 2 3 4 5 ', 'ABCD2345'],
    ['\tABCD\n2345', 'ABCD2345'],
    ['', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });
});

describe('hashInviteCode', () => {
  it('is the sha256 hex of the normalized code', () => {
    // Known vector: `printf ABCD2345 | sha256sum`.
    expect(hashInviteCode('ABCD2345')).toBe(
      'a00d76646eba91b057841554d5c8334f498dc592ed744bce404f21fe271cd36e',
    );
  });

  it('is stable across calls', () => {
    expect(hashInviteCode('ABCD2345')).toBe(hashInviteCode('ABCD2345'));
  });

  it('ignores case, spaces and hyphens in the typed code', () => {
    expect(hashInviteCode(' abcd-2345 ')).toBe(hashInviteCode('ABCD2345'));
  });

  it('differs for different codes', () => {
    expect(hashInviteCode('ABCD2345')).not.toBe(hashInviteCode('ABCD2346'));
  });

  it('does not contain the plain code', () => {
    expect(hashInviteCode('ABCD2345').toUpperCase()).not.toContain('ABCD2345');
  });
});
