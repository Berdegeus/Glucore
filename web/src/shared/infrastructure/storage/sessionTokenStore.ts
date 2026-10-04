import type { TokenStore } from '../../domain/ports';

export const TOKEN_STORAGE_KEY = 'glucore.accessToken';

/** Stands in for `sessionStorage` when the browser refuses it. */
class MemoryStorage {
  private value: string | null = null;
  getItem(): string | null {
    return this.value;
  }
  setItem(_key: string, value: string): void {
    this.value = value;
  }
  removeItem(): void {
    this.value = null;
  }
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Getting `window.sessionStorage` itself can throw (blocked site data). */
const browserSessionStorage = (): Storage => window.sessionStorage;

function probe(openStorage: () => Storage): KeyValueStorage | null {
  try {
    const storage = openStorage();
    storage.setItem(`${TOKEN_STORAGE_KEY}.probe`, '1');
    storage.removeItem(`${TOKEN_STORAGE_KEY}.probe`);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Keeps the access token in `sessionStorage` only: never `localStorage`, a
 * cookie or the URL (ACC-12). It dies with the tab and survives a reload.
 * When the browser refuses `sessionStorage` the token lives in memory and
 * `persistent` turns false, so the UI can warn that a reload signs out.
 */
export class SessionTokenStore implements TokenStore {
  readonly persistent: boolean;
  private readonly storage: KeyValueStorage;

  constructor(openStorage: () => Storage = browserSessionStorage) {
    const storage = probe(openStorage);
    this.persistent = storage !== null;
    this.storage = storage ?? new MemoryStorage();
  }

  read(): string | null {
    return this.storage.getItem(TOKEN_STORAGE_KEY);
  }

  save(token: string): void {
    this.storage.setItem(TOKEN_STORAGE_KEY, token);
  }

  clear(): void {
    this.storage.removeItem(TOKEN_STORAGE_KEY);
  }
}
