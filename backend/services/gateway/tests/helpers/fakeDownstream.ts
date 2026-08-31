import type { AddressInfo } from 'node:net';

import express, { type Express } from 'express';

export interface FakeDownstream {
  app: Express;
  url: string;
  close: () => Promise<void>;
  requests: { method: string; path: string; body: unknown; headers: Record<string, string | string[] | undefined> }[];
}

/**
 * A real HTTP server on an ephemeral port, standing in for auth-service or
 * glucose-service. `http-proxy-middleware` opens a real TCP connection to its
 * target, so nothing short of an actual listening server can play that role —
 * an in-memory Express app driven only by supertest cannot.
 */
export async function startFakeDownstream(): Promise<FakeDownstream> {
  const app = express();
  app.use(express.json());

  const requests: FakeDownstream['requests'] = [];
  app.use((req, _res, next) => {
    requests.push({ method: req.method, path: req.path, body: req.body, headers: req.headers });
    next();
  });

  app.all('*', (req, res) => {
    res.status(200).json({ echoedPath: req.path, echoedBody: req.body });
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    app,
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
