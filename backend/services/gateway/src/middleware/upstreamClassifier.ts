import type { ErrorClassifier } from '@glucore/shared';

import { UpstreamHttpError, UpstreamUnavailableError } from '../clients/errors';

/**
 * This service's link in the error-classifier chain (see `errorHandler.ts`'s
 * own comment: "the gateway plugs in its own upstream classifier instead").
 * Where `prismaClassifier` translates a database failure, this translates a
 * downstream HTTP failure — the gateway has no database of its own.
 */
export const upstreamClassifier: ErrorClassifier = (error) => {
  if (error instanceof UpstreamHttpError) {
    return { status: error.status, code: error.code, error: error.message };
  }
  if (error instanceof UpstreamUnavailableError) {
    return { status: 503, code: 'UPSTREAM_UNAVAILABLE', error: 'Upstream service unavailable' };
  }
  return undefined;
};
