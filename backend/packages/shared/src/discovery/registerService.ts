/**
 * Self-registration against Consul's agent API. A service calls
 * `registerService` once at boot and `deregisterService` from its shutdown
 * handler, using the same service ID both times.
 *
 * Registering the container's own hostname (`address`), never `localhost`, is
 * the detail that matters: Consul runs the HTTP health check from the agent
 * container, so a `localhost` address makes it check itself instead of the
 * service, and everything ends up "critical".
 */

export interface RegisterServiceOptions {
  consulUrl: string;
  /** Logical name other services resolve, e.g. "auth" or "glucose". */
  serviceName: string;
  /** Hostname other containers reach this instance at (compose service name). */
  address: string;
  port: number;
  /** Path checked over HTTP, relative to `http://<address>:<port>`. */
  healthPath: string;
}

export function serviceInstanceId(serviceName: string): string {
  return `${serviceName}-${process.pid}`;
}

export async function registerService(options: RegisterServiceOptions): Promise<void> {
  const { consulUrl, serviceName, address, port, healthPath } = options;
  const id = serviceInstanceId(serviceName);

  const response = await fetch(`${consulUrl}/v1/agent/service/register`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ID: id,
      Name: serviceName,
      Address: address,
      Port: port,
      Check: {
        HTTP: `http://${address}:${port}${healthPath}`,
        Interval: '10s',
        DeregisterCriticalServiceAfter: '1m',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Consul registration failed for "${serviceName}": ${response.status}`);
  }
}

export async function deregisterService(consulUrl: string, serviceName: string): Promise<void> {
  const id = serviceInstanceId(serviceName);
  await fetch(`${consulUrl}/v1/agent/service/deregister/${id}`, { method: 'PUT' }).catch(
    (error: unknown) => {
      // Best-effort: a failed deregister just leaves Consul to catch it via
      // the health check's DeregisterCriticalServiceAfter instead.
      console.error(`[consul] deregister failed for "${serviceName}": ${String(error)}`);
    },
  );
}
