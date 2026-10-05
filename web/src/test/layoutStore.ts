import { http, HttpResponse } from 'msw';
import { API_BASE } from './httpClient';
import { server } from './server';

type StoredItem = { id: string; size: 'S' | 'M' | 'L' };

export interface LayoutStore {
  /** What the server holds: `null` until a `PUT`, and again after a `DELETE`. */
  widgets: StoredItem[] | null;
  /** While set, every `PUT` fails with this status and stores nothing. */
  failSaveWith: number | null;
  /** The bodies of the `PUT`s received, in order, whether they were kept or not. */
  puts: StoredItem[][];
  deletes: number;
}

/**
 * `GET`, `PUT` and `DELETE /preferences/dashboard` over MSW with a layout kept
 * in memory, as the gateway keeps it per person. Later than `mockApi()` in a
 * test, it replaces that mock's read-only `GET`. A new app mounted in the same
 * test (a reload) reads what an earlier one saved.
 */
export function mockLayoutStore(initial: StoredItem[] | null = null): LayoutStore {
  const store: LayoutStore = { widgets: initial, failSaveWith: null, puts: [], deletes: 0 };
  const url = `${API_BASE}/preferences/dashboard`;
  server.use(
    http.get(url, () => HttpResponse.json({ widgets: store.widgets })),
    http.put(url, async ({ request }) => {
      const body = (await request.json()) as { widgets: StoredItem[] };
      store.puts.push(body.widgets);
      if (store.failSaveWith !== null) return HttpResponse.json({ error: 'unavailable' }, { status: store.failSaveWith });
      store.widgets = body.widgets;
      return HttpResponse.json(body);
    }),
    http.delete(url, () => {
      store.deletes += 1;
      store.widgets = null;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return store;
}
