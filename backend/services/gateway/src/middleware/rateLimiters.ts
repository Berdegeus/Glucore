import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import type { AuthRequest } from '@glucore/shared';

/**
 * Moved here from auth-service (phase 4.4): `req.ip` downstream is the
 * gateway's own address, so a limiter there would count all traffic as one
 * client. Here it is the real one — `trust proxy` (set in `app.ts`) is what
 * makes `req.ip` the actual client address behind Azure's ingress too.
 */
export function strictAuthLimiter(): RateLimitRequestHandler {
  // Credential-sensitive endpoints: login and both halves of the reset flow.
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export function registerLimiter(): RateLimitRequestHandler {
  // Looser: account creation is not a credential guess.
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

/**
 * Invite redemption (CON-06): 10 attempts per user per 15 minutes, so a code
 * cannot be guessed by brute force. Keyed by the authenticated user, not the
 * IP: many professionals behind one clinic network must not starve each other,
 * and one user must not dodge the limit by changing address. It therefore has
 * to be mounted after `authenticate`, which is what sets `req.userId`; without
 * one it falls back to the IP, through the library's helper so an IPv6 client
 * cannot rotate through its /64.
 */
export function redeemLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthRequest).userId ?? ipKeyGenerator(req.ip ?? ''),
    message: { error: 'Too many requests', code: 'RATE_LIMITED' },
  });
}
