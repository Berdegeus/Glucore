import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/env';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
}

export function verifyJwt(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
}

/** Resolves the role of an authenticated user, or `null` when there is no such user. */
export type RoleResolver = (userId: string) => Promise<string | null>;

export interface RequireRoleOptions {
  /** Overridable for unit tests; defaults to reading the role from the database. */
  resolveRole?: RoleResolver;
}

async function resolveRoleFromDatabase(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role ?? null;
}

/**
 * Authorizes the request against the allowed roles. Must run after `verifyJwt`.
 *
 * The role is read from the database on every request instead of from a JWT
 * claim (design AD-4): demoting a user takes effect immediately, without
 * waiting out the 30 d token TTL.
 */
export function requireRole(
  roles: string | readonly string[],
  options: RequireRoleOptions = {},
) {
  const allowed = typeof roles === 'string' ? [roles] : [...roles];
  const resolveRole = options.resolveRole ?? resolveRoleFromDatabase;

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', code: 'TOKEN_INVALID' });
      return;
    }
    resolveRole(userId)
      .then((role) => {
        if (role === null) {
          res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
          return;
        }
        if (!allowed.includes(role)) {
          res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' });
          return;
        }
        next();
      })
      .catch(next);
  };
}
