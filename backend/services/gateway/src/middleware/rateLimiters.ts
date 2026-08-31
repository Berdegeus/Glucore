import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

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
