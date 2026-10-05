import { http, HttpResponse, type JsonBodyType } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { API_BASE, createTestHttpClient, rejectionOf } from '../../../test/httpClient';
import { layoutOf } from '../../../test/layoutFakes';
import { server } from '../../../test/server';
import { HttpLayoutRepository } from './httpLayoutRepository';

const ENDPOINT = `${API_BASE}/preferences/dashboard`;

const SAVED = [
  { id: 'kpi-tir', size: 'S' },
  { id: 'chart-trend', size: 'L' },
];

function setup(token: string | null = 'tok-1') {
  const { client, tokenStore, sessionEvents } = createTestHttpClient(token);
  return { repository: new HttpLayoutRepository(client), tokenStore, sessionEvents };
}

afterEach(() => window.sessionStorage.clear());

describe('HttpLayoutRepository.load (LAY-08)', () => {
  it('turns a saved list into a layout, in order', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ widgets: SAVED })));

    expect(await setup().repository.load()).toEqual({ widgets: SAVED });
  });

  it('answers null when the person has no saved layout', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ widgets: null })));

    expect(await setup().repository.load()).toBeNull();
  });

  it('keeps an empty saved list as an empty layout, not as "never saved"', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ widgets: [] })));

    expect(await setup().repository.load()).toEqual({ widgets: [] });
  });

  it('sends the bearer token and no user id', async () => {
    let seen: { authorization: string | null; search: string } | undefined;
    server.use(
      http.get(ENDPOINT, ({ request }) => {
        seen = { authorization: request.headers.get('Authorization'), search: new URL(request.url).search };
        return HttpResponse.json({ widgets: null });
      }),
    );

    await setup('tok-1').repository.load();

    expect(seen).toEqual({ authorization: 'Bearer tok-1', search: '' });
  });

  it.each<[string, JsonBodyType]>([
    ['an item without an id', { widgets: [{ size: 'S' }] }],
    ['an empty id', { widgets: [{ id: '', size: 'S' }] }],
    ['an item with a size outside S, M and L', { widgets: [{ id: 'kpi-tir', size: 'XL' }] }],
    ['an item that is not an object', { widgets: ['kpi-tir'] }],
    ['a body without widgets', {}],
    ['widgets that is not a list', { widgets: 'kpi-tir' }],
  ])('turns %s into unknown, naming the endpoint', async (_label, body) => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json(body)));

    const error = await rejectionOf(setup().repository.load());

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain('GET /preferences/dashboard');
  });

  it('turns 503 into unavailable', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ error: 'down' }, { status: 503 })));

    expect(await rejectionOf(setup().repository.load())).toMatchObject({ kind: 'unavailable' });
  });

  it('turns 401 TOKEN_INVALID into unauthenticated and ends the session', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ error: 'Invalid token', code: 'TOKEN_INVALID' }, { status: 401 })));
    const { repository, tokenStore } = setup();

    expect(await rejectionOf(repository.load())).toMatchObject({ kind: 'unauthenticated' });
    expect(tokenStore.read()).toBeNull();
  });
});

describe('HttpLayoutRepository.save (LAY-07, LAY-11, LAY-12)', () => {
  it('sends only id and size of each item as the body and returns the stored layout', async () => {
    let body: unknown;
    let method: string | undefined;
    server.use(
      http.put(ENDPOINT, async ({ request }) => {
        method = request.method;
        body = await request.json();
        return HttpResponse.json({ widgets: SAVED });
      }),
    );
    // An item carrying more than the contract allows must not leak into the body.
    const layout = layoutOf({ id: 'kpi-tir', size: 'S', extra: 'x' } as never, { id: 'chart-trend', size: 'L' });

    const stored = await setup().repository.save(layout);

    expect(method).toBe('PUT');
    expect(body).toEqual({ widgets: SAVED });
    expect(stored).toEqual({ widgets: SAVED });
  });

  it('turns 400 INVALID_LAYOUT into a validation error that carries the code', async () => {
    server.use(http.put(ENDPOINT, () => HttpResponse.json({ error: 'Invalid layout', code: 'INVALID_LAYOUT' }, { status: 400 })));

    expect(await rejectionOf(setup().repository.save(layoutOf({ id: 'x', size: 'S' })))).toMatchObject({
      kind: 'validation',
      code: 'INVALID_LAYOUT',
    });
  });

  it('turns a stored layout with a malformed item into unknown', async () => {
    server.use(http.put(ENDPOINT, () => HttpResponse.json({ widgets: [{ id: 'kpi-tir', size: 'huge' }] })));

    const error = await rejectionOf(setup().repository.save(layoutOf({ id: 'kpi-tir', size: 'S' })));

    expect(error).toMatchObject({ kind: 'unknown' });
    expect((error as Error).message).toContain('PUT /preferences/dashboard');
  });

  it('refuses an answer with null widgets, which only a GET may give', async () => {
    server.use(http.put(ENDPOINT, () => HttpResponse.json({ widgets: null })));

    expect(await rejectionOf(setup().repository.save(layoutOf()))).toMatchObject({ kind: 'unknown' });
  });
});

describe('HttpLayoutRepository.reset (LAY-09)', () => {
  it('sends DELETE and resolves on 204', async () => {
    let method: string | undefined;
    server.use(
      http.delete(ENDPOINT, ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(setup().repository.reset()).resolves.toBeUndefined();

    expect(method).toBe('DELETE');
  });

  it('turns a 503 into unavailable', async () => {
    server.use(http.delete(ENDPOINT, () => HttpResponse.json({ error: 'down' }, { status: 503 })));

    expect(await rejectionOf(setup().repository.reset())).toMatchObject({ kind: 'unavailable' });
  });
});
