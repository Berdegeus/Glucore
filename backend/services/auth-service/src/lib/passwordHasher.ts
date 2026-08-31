import bcrypt from 'bcryptjs';

/**
 * How a password is turned into something storable, and how a candidate is
 * checked against it.
 *
 * Extracted as a strategy for a specific reason. The code this replaces read
 * `process.env.NODE_ENV === 'test' ? 4 : 12` inline: production code asking what
 * environment it was running in, so that the test suite would not pay ~300 ms
 * per password. That works, but it means the thing under test is not the thing
 * that ships, and the decision sits where nobody looking for it would think to
 * look.
 *
 * With the work factor as a constructor argument, the composition root decides —
 * 12 from configuration in production, 4 injected by the test container — and
 * the algorithm itself no longer knows what a test is.
 */
export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  compare(plaintext: string, hashed: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number) {}

  hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.rounds);
  }

  compare(plaintext: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hashed);
  }
}
