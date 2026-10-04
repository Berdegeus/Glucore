import bcrypt from 'bcryptjs';
import { describe, expect, it, vi, afterEach } from 'vitest';

import { createMailer, ConsoleMailer, SmtpMailer } from '../../src/lib/mailer';
import { BcryptPasswordHasher } from '../../src/lib/passwordHasher';

/**
 * The two strategies the split introduced. Both replaced a decision that used
 * to be made inline — one by asking what environment the process was in, the
 * other by catching a failure — so what is worth testing is that the decision
 * now comes from configuration.
 */

describe('BcryptPasswordHasher', () => {
  // 4 is bcrypt's minimum and what the test container injects; a realistic
  // factor costs ~300 ms per call and would dominate the suite.
  const hasher = new BcryptPasswordHasher(4);

  it('round-trips a password', async () => {
    const hash = await hasher.hash('Senha123!');
    expect(await hasher.compare('Senha123!', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('Senha123!');
    expect(await hasher.compare('Errada123!', hash)).toBe(false);
  });

  it('never stores the plaintext', async () => {
    const hash = await hasher.hash('Senha123!');
    expect(hash).not.toContain('Senha123!');
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([hasher.hash('Senha123!'), hasher.hash('Senha123!')]);
    expect(a).not.toBe(b);
    expect(await hasher.compare('Senha123!', b)).toBe(true);
  });

  it('applies the work factor it was constructed with', async () => {
    // The point of the strategy: the cost is an argument, not a question about
    // NODE_ENV asked from inside production code.
    expect(bcrypt.getRounds(await new BcryptPasswordHasher(4).hash('x'))).toBe(4);
    expect(bcrypt.getRounds(await new BcryptPasswordHasher(6).hash('x'))).toBe(6);
  });

  it('verifies a hash made at a different work factor', async () => {
    // Raising the factor must not lock out accounts hashed under the old one.
    const old = await new BcryptPasswordHasher(4).hash('Senha123!');
    expect(await new BcryptPasswordHasher(6).compare('Senha123!', old)).toBe(true);
  });
});

describe('createMailer', () => {
  it('builds an SMTP mailer when a host is configured', () => {
    const mailer = createMailer({ host: 'smtp.example.com', port: 587, user: 'u', pass: 'p' });
    expect(mailer).toBeInstanceOf(SmtpMailer);
  });

  it('builds the console mailer when there is no SMTP configuration', () => {
    // Deliberate, not a fallback from a caught error: with a host set, a send
    // failure stays a failure instead of looking like "not configured".
    expect(createMailer(null)).toBeInstanceOf(ConsoleMailer);
  });
});

describe('ConsoleMailer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the token so a developer can complete the flow', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await new ConsoleMailer().sendPasswordReset('dev@example.com', 'the-token');

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0].join(' ');
    expect(line).toContain('dev@example.com');
    expect(line).toContain('the-token');
    // Says why it is doing this, so nobody reads a reset token in a production
    // log and assumes it is normal.
    expect(line).toContain('no SMTP configured');
  });
});
