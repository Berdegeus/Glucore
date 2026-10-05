import type { Express } from 'express';

import { startFakeDownstream, type FakeDownstream } from './fakeDownstream';
import { buildGatewayApp } from './gatewayApp';

/** Display names the fake auth-service knows; any other id has no account. */
export const MARIA = '3f000000-0000-4000-8000-000000000001';
export const JOAO = '4a000000-0000-4000-8000-000000000002';
export const PATIENT_NAMES: Readonly<Record<string, string>> = {
  [MARIA]: 'Maria da Silva',
  [JOAO]: 'João',
};
/** A patient whose account is gone: the lookup answers without it. */
export const NO_ACCOUNT = '9b000000-0000-4000-8000-000000000003';

export interface PortfolioHarness {
  app: Express;
  authFake: FakeDownstream;
  glucoseFake: FakeDownstream;
  /** What glucose-service answers on the composed path; put back by `reset`. */
  glucose: { status: number; body: unknown };
  /** While `fails` is set the name lookups answer 503; cleared by `reset`. */
  lookup: { fails: boolean };
  /** Every query object glucose-service received on the composed path. */
  queries: Array<Record<string, unknown>>;
  lookupCalls: () => FakeDownstream['requests'];
  reset: () => void;
  close: () => Promise<void>;
}

/**
 * The gateway over a fake auth-service (name lookup) and a fake glucose-service
 * that answers one composed `path`, for the two portfolio compositions.
 */
export async function startPortfolioHarness(path: string, okBody: unknown): Promise<PortfolioHarness> {
  const lookup = { fails: false };
  const glucose = { status: 200, body: okBody };
  const queries: Array<Record<string, unknown>> = [];

  const authFake = await startFakeDownstream((fakeApp) => {
    fakeApp.post('/internal/accounts/lookup', (req, res) => {
      if (lookup.fails) {
        res.status(503).json({ error: 'boom' });
        return;
      }
      const ids = req.body.ids as string[];
      res.json(ids.filter((id) => PATIENT_NAMES[id]).map((id) => ({ id, fullName: PATIENT_NAMES[id] })));
    });
  });
  const glucoseFake = await startFakeDownstream((fakeApp) => {
    fakeApp.get(path, (req, res) => {
      queries.push(req.query);
      res.status(glucose.status).json(glucose.body);
    });
  });

  return {
    app: buildGatewayApp(authFake, glucoseFake),
    authFake,
    glucoseFake,
    glucose,
    lookup,
    queries,
    lookupCalls: () => authFake.requests.filter((r) => r.path === '/internal/accounts/lookup'),
    reset: () => {
      authFake.requests.length = 0;
      glucoseFake.requests.length = 0;
      queries.length = 0;
      lookup.fails = false;
      glucose.status = 200;
      glucose.body = okBody;
    },
    close: async () => {
      await authFake.close();
      await glucoseFake.close();
    },
  };
}
