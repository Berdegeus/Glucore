/**
 * Resolves a logical service name to a base URL the gateway can proxy to or
 * call directly.
 *
 * One interface, two implementations: `EnvServiceRegistry` (fixed URLs from
 * environment variables, used until phase 5) and later a Consul-backed one
 * with the same shape, so nothing above this boundary changes when discovery
 * gets real.
 */
export interface ServiceRegistry {
  /** Base URL of the service, with no trailing slash, e.g. "http://localhost:3002". */
  resolve(serviceName: string): Promise<string>;
}
