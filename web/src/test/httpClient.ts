import { SessionEventBus } from '../shared/infrastructure/events/sessionEventBus';
import { FetchHttpClient } from '../shared/infrastructure/http/fetchHttpClient';
import { SessionTokenStore } from '../shared/infrastructure/storage/sessionTokenStore';

/** Where repository tests mount the API: the composition root appends `/api/v1` to the host. */
export const API_BASE = 'http://api.test/api/v1';

/** A real `FetchHttpClient` aimed at `API_BASE`, for MSW-backed repository tests. */
export function createTestHttpClient(token: string | null = null) {
  const tokenStore = new SessionTokenStore();
  if (token) tokenStore.save(token);
  const sessionEvents = new SessionEventBus();
  const client = new FetchHttpClient({ baseUrl: API_BASE, tokenStore, sessionEvents });
  return { client, tokenStore, sessionEvents };
}

/** Awaits a call expected to fail and returns what it rejected with. */
export async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the call to fail');
    },
    (reason: unknown) => reason,
  );
}
