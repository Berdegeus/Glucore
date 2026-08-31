import type { RequestHandler } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import type { ServiceRegistry } from '@glucore/shared';

import { UpstreamUnavailableError } from '../clients/errors';

/**
 * One proxy per prefix, each rewriting `/api/v1/<prefix>` to `/<prefix>` on
 * the resolved service — the services themselves know nothing about the
 * `/api/v1` prefix, which exists only at the gateway boundary (phase 9's
 * breaking change is absorbed entirely here).
 *
 * `fixRequestBody` is required because `express.json()` — mounted globally on
 * the composition routes elsewhere in `app.ts` — would otherwise have already
 * consumed the request stream by the time the proxy tries to forward it,
 * silently sending an empty body downstream. These routes must never sit
 * behind a global `express.json()`.
 */
export function createProxyRoute(prefix: string, serviceName: string, registry: ServiceRegistry): RequestHandler {
  return createProxyMiddleware({
    // `registry.resolve` throws a plain Error when discovery has nothing to
    // offer (e.g. Consul shows no passing instances). Recast as
    // `UpstreamUnavailableError` so it lands on `upstreamClassifier` and
    // answers 503, instead of falling through the classifier chain to the
    // generic 500.
    router: async () => {
      try {
        return await registry.resolve(serviceName);
      } catch (error) {
        throw new UpstreamUnavailableError(error instanceof Error ? error.message : String(error));
      }
    },
    changeOrigin: true,
    pathRewrite: { [`^/api/v1/${prefix}`]: `/${prefix}` },
    onProxyReq: fixRequestBody,
  });
}
