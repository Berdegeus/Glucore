import crypto from 'node:crypto';

/**
 * Thirty-two symbols: the uppercase letters and digits minus `0`, `O`, `1` and
 * `I`, the four a patient reading a code off a phone to a professional mistakes
 * for each other (CON-02). `randomInt(32)` is already unbiased, so every symbol
 * is equally likely.
 */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/**
 * A fresh single-use code. `crypto.randomInt` is the CSPRNG: the code is the
 * only secret protecting a patient's data until it is redeemed, so `Math.random`
 * is not an option.
 */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/** What a human typed, reduced to what was generated: no spaces, no hyphens, uppercase. */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * sha256 of the normalized code. Only this is stored: the plain code is shown
 * once to the patient and never persisted or audited.
 */
export function hashInviteCode(code: string): string {
  return crypto.createHash('sha256').update(normalizeInviteCode(code), 'utf8').digest('hex');
}
