import { describe, expect, it } from 'vitest';

import { recordAudit, sanitizeMetadata, type AuditClient } from '../../src/lib/audit';

/**
 * Spec: TCC-13 — spec.md "P3: Trilha de auditoria persistida" AC2, AC4 and AC5.
 */

function captureConsoleError(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  return { lines, restore: () => (console.error = original) };
}

function recordingClient(): { client: AuditClient; writes: Record<string, unknown>[] } {
  const writes: Record<string, unknown>[] = [];
  return {
    writes,
    client: {
      auditLog: {
        create: async (args) => {
          writes.push(args.data);
          return args.data;
        },
      },
    },
  };
}

describe('sanitizeMetadata — never records a secret (AC4)', () => {
  it('drops every named sensitive key at the top level', () => {
    const sanitized = sanitizeMetadata({
      email: 'p@example.com',
      password: 'Senha123!',
      newPassword: 'Senha456!',
      currentPassword: 'Senha123!',
      passwordHash: '$2a$12$abc',
      token: 'a7c1-reset',
    });
    expect(sanitized).toEqual({ email: 'p@example.com' });
  });

  it('drops sensitive keys nested two levels deep', () => {
    const sanitized = sanitizeMetadata({
      user: { id: 'u1', credential: { passwordHash: '$2a$12$abc', lastLoginAt: '2026-08-16' } },
    });
    expect(sanitized).toEqual({ user: { id: 'u1', credential: { lastLoginAt: '2026-08-16' } } });
  });

  it('drops sensitive keys inside arrays of objects', () => {
    const sanitized = sanitizeMetadata({
      items: [
        { id: 'a', token: 'secret-a' },
        { id: 'b', currentPassword: 'secret-b' },
      ],
    });
    expect(sanitized).toEqual({ items: [{ id: 'a' }, { id: 'b' }] });
  });

  it('keeps non-sensitive values untouched', () => {
    const sanitized = sanitizeMetadata({ count: 3, ok: true, label: 'REPLACE', missing: null });
    expect(sanitized).toEqual({ count: 3, ok: true, label: 'REPLACE', missing: null });
  });
});

describe('recordAudit — what gets persisted (AC2)', () => {
  it('writes the entity, action, user and request context', async () => {
    const { client, writes } = recordingClient();
    await recordAudit(
      {
        userId: 'user-1',
        entity: 'InsulinEvent',
        action: 'REPLACE',
        entityId: 'patient-1',
        ipAddress: '10.0.0.7',
        userAgent: 'Glucore/1.1.0',
      },
      client,
    );
    expect(writes.length).toBe(1);
    expect(writes[0]).toEqual({
      userId: 'user-1',
      entity: 'InsulinEvent',
      action: 'REPLACE',
      entityId: 'patient-1',
      ipAddress: '10.0.0.7',
      userAgent: 'Glucore/1.1.0',
    });
  });

  it('persists metadata already sanitized', async () => {
    const { client, writes } = recordingClient();
    await recordAudit(
      {
        userId: 'user-1',
        entity: 'User',
        action: 'RESET_PASSWORD',
        metadata: { email: 'p@example.com', token: 'a7c1-reset', password: 'Senha123!' },
      },
      client,
    );
    expect(writes[0].metadata).toEqual({ email: 'p@example.com' });
  });

  it('defaults an absent user and request context to null', async () => {
    const { client, writes } = recordingClient();
    await recordAudit({ entity: 'User', action: 'FORGOT_PASSWORD' }, client);
    expect(writes[0].userId).toBe(null);
    expect(writes[0].entityId).toBe(null);
    expect(writes[0].ipAddress).toBe(null);
    expect(writes[0].userAgent).toBe(null);
    expect('metadata' in writes[0]).toBe(false);
  });
});

describe('recordAudit — a failed write never breaks the request (AC5)', () => {
  it('swallows a rejected write and logs the reason', async () => {
    const failing: AuditClient = {
      auditLog: {
        create: async () => {
          throw new Error('relation "AuditLog" does not exist');
        },
      },
    };
    const console = captureConsoleError();
    try {
      await expect(
        recordAudit({ userId: 'user-1', entity: 'CarbEvent', action: 'REPLACE' }, failing),
      ).resolves.toBeUndefined();
    } finally {
      console.restore();
    }
    expect(console.lines.some(
        (line) =>
          line.includes('CarbEvent/REPLACE') &&
          line.includes('relation "AuditLog" does not exist'),
      )).toBe(true);
  });

  it('swallows a synchronous throw from the client', async () => {
    const failing = {
      auditLog: {
        create: () => {
          throw new Error('client unavailable');
        },
      },
    } as unknown as AuditClient;
    const console = captureConsoleError();
    try {
      await expect(
        recordAudit({ entity: 'AlertThresholdConfig', action: 'UPDATE' }, failing),
      ).resolves.toBeUndefined();
    } finally {
      console.restore();
    }
    expect(console.lines.length).toBe(1);
  });
});
