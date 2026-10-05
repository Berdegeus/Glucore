import { http, HttpResponse, type JsonBodyType } from 'msw';
import { expect, it } from 'vitest';
import { rejectionOf } from './httpClient';
import { server } from './server';

/** A call of a repository under test: its name for the test title, the URL MSW answers on, and the call itself. */
export type RepositoryCall<R> = [name: string, url: string, call: (repository: R) => Promise<unknown>];

/** A body that breaks the contract of the call: why, the URL, the body and the call. */
export type MalformedCase<R> = [name: string, url: string, body: JsonBodyType, call: (repository: R) => Promise<unknown>];

/** Each call answered `403` with `code` fails with a `forbidden` error that carries the code (ARQ-06). */
export function itMapsForbidden<R>(calls: RepositoryCall<R>[], setup: () => R, code: string) {
  it.each(calls)(`%s: 403 ${code} becomes forbidden with the code`, async (_name, url, call) => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'Forbidden', code }, { status: 403 })));

    expect(await rejectionOf(call(setup()))).toMatchObject({ kind: 'forbidden', code });
  });
}

/** A body outside the contract is an `unknown` error that names the endpoint and never echoes `secret`, a value of the body (ARQ-06). */
export function itRejectsMalformed<R>(cases: MalformedCase<R>[], setup: () => R, secret: string) {
  it.each(cases)('%s: rejects it as an unexpected response, naming the endpoint but not the data', async (_name, url, body, call) => {
    server.use(http.get(url, () => HttpResponse.json(body)));

    const error = await rejectionOf(call(setup()));

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain(`GET ${new URL(url).pathname.replace('/api/v1', '')}`);
    expect((error as Error).message).not.toContain(secret);
  });
}
