import { Router } from 'express';

/**
 * Composition root: the one place that knows which implementation satisfies
 * which interface.
 *
 * Wired by hand rather than through a container library, matching
 * glucose-service. At this size the explicit wiring is shorter than the
 * decorators and reflection metadata a library would need, and it stays
 * greppable — every dependency of every service is visible in one file.
 *
 * Scaffolding only in this commit: the router is empty until the auth routes
 * are ported into modules. What it already establishes is the shape — `buildApp`
 * takes a container, so a test can hand it in-memory repositories or a cheaper
 * password hasher without the application knowing a test exists.
 */
export interface Container {
  authRouter: Router;
}

export function createContainer(): Container {
  return { authRouter: Router() };
}
