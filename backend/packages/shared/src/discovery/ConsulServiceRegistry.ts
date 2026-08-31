import type { ServiceRegistry } from './ServiceRegistry';

interface ConsulHealthServiceEntry {
  Service: {
    Address: string;
    Port: number;
  };
}

/**
 * Resolves a service name via Consul's health API instead of a fixed URL map.
 *
 * MVP scope, deliberately: one HTTP call per `resolve`, no caching, no
 * round-robin state, no last-known-good fallback. A random pick among the
 * currently-passing instances is enough to prove real discovery (multiple
 * instances, health-driven removal) without the resilience machinery a
 * production rollout would add later.
 */
export class ConsulServiceRegistry implements ServiceRegistry {
  constructor(private readonly consulUrl: string) {}

  async resolve(serviceName: string): Promise<string> {
    const url = `${this.consulUrl}/v1/health/service/${serviceName}?passing=true`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Consul lookup failed for "${serviceName}": ${response.status}`);
    }

    const entries = (await response.json()) as ConsulHealthServiceEntry[];
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error(`No passing instances registered in Consul for "${serviceName}"`);
    }

    const { Address, Port } = entries[Math.floor(Math.random() * entries.length)].Service;
    return `http://${Address}:${Port}`;
  }
}
