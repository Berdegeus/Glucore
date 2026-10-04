import type { ServiceRegistry } from './ServiceRegistry';

/**
 * Resolves service names from a fixed map, typically built from environment
 * variables at boot (`AUTH_SERVICE_URL`, `GLUCOSE_SERVICE_URL`, ...).
 *
 * No caching, no health check, no retry: this is the strategy for local dev
 * and for compose without Consul. A registry that actually discovers
 * instances is phase 5's `ConsulServiceRegistry`, behind the same interface.
 */
export class EnvServiceRegistry implements ServiceRegistry {
  constructor(private readonly urls: Readonly<Record<string, string>>) {}

  async resolve(serviceName: string): Promise<string> {
    const url = this.urls[serviceName];
    if (!url) {
      throw new Error(`No URL configured for service "${serviceName}"`);
    }
    return url;
  }
}
