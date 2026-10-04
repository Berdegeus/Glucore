import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConsulServiceRegistry,
  deregisterService,
  registerService,
  serviceInstanceId,
} from '@glucore/shared';

/**
 * Phase 5's Consul-backed discovery, unit-tested against a stubbed `fetch`
 * rather than a real Consul agent — `dashboard.test.ts` and the manual
 * `docker compose` run already prove the real HTTP contract; this suite is
 * what the coverage gate needs so the module does not regress silently.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ConsulServiceRegistry', () => {
  it('resolves to the address/port of a passing instance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ Service: { Address: 'auth-service', Port: 3002 } }],
      }),
    );

    const registry = new ConsulServiceRegistry('http://consul:8500');
    expect(await registry.resolve('auth')).toBe('http://auth-service:3002');
    expect(fetch).toHaveBeenCalledWith('http://consul:8500/v1/health/service/auth?passing=true');
  });

  it('picks among multiple passing instances', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { Service: { Address: 'glucose-a', Port: 3001 } },
          { Service: { Address: 'glucose-b', Port: 3001 } },
        ],
      }),
    );

    const registry = new ConsulServiceRegistry('http://consul:8500');
    const resolved = await registry.resolve('glucose');
    expect(['http://glucose-a:3001', 'http://glucose-b:3001']).toContain(resolved);
  });

  it('throws when Consul answers with a non-2xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const registry = new ConsulServiceRegistry('http://consul:8500');
    await expect(registry.resolve('auth')).rejects.toThrow(/Consul lookup failed/);
  });

  it('throws when there are no passing instances — this is what the gateway turns into a 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    const registry = new ConsulServiceRegistry('http://consul:8500');
    await expect(registry.resolve('auth')).rejects.toThrow(/No passing instances/);
  });
});

describe('registerService / deregisterService', () => {
  it('registers with an HTTP check pointed at the instance itself, never localhost', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await registerService({
      consulUrl: 'http://consul:8500',
      serviceName: 'auth',
      address: 'auth-service',
      port: 3002,
      healthPath: '/health/ready',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://consul:8500/v1/agent/service/register',
      expect.objectContaining({ method: 'PUT' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      Name: 'auth',
      Address: 'auth-service',
      Port: 3002,
      Check: { HTTP: 'http://auth-service:3002/health/ready' },
    });
    expect(body.ID).toBe(serviceInstanceId('auth'));
  });

  it('throws when Consul rejects the registration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(
      registerService({
        consulUrl: 'http://consul:8500',
        serviceName: 'auth',
        address: 'auth-service',
        port: 3002,
        healthPath: '/health/ready',
      }),
    ).rejects.toThrow(/Consul registration failed/);
  });

  it('deregisters using the same instance id it registered with', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await deregisterService('http://consul:8500', 'auth');

    expect(fetchMock).toHaveBeenCalledWith(
      `http://consul:8500/v1/agent/service/deregister/${serviceInstanceId('auth')}`,
      { method: 'PUT' },
    );
  });

  it('never throws on a failed deregister — best-effort, the health check catches it eventually', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(deregisterService('http://consul:8500', 'auth')).resolves.toBeUndefined();
  });
});

describe('serviceInstanceId', () => {
  it('is stable for the same service name within one process', () => {
    expect(serviceInstanceId('auth')).toBe(serviceInstanceId('auth'));
    expect(serviceInstanceId('auth')).not.toBe(serviceInstanceId('glucose'));
  });
});
