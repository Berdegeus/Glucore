import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionTokenStore, TOKEN_STORAGE_KEY } from './sessionTokenStore';

const TOKEN = 'header.payload.signature';

const denied = (): Storage => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

/** A sessionStorage whose writes fail, as in a browser with storage blocked. */
const failingWrites = (): Storage => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  });
  return window.sessionStorage;
};

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('SessionTokenStore (ACC-12)', () => {
  it('writes the token to sessionStorage and reads it back', () => {
    const store = new SessionTokenStore();

    store.save(TOKEN);

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe(TOKEN);
    expect(store.read()).toBe(TOKEN);
    expect(store.persistent).toBe(true);
  });

  it('finds the token again after a reload of the same tab', () => {
    new SessionTokenStore().save(TOKEN);

    expect(new SessionTokenStore().read()).toBe(TOKEN);
  });

  it('reads null when no token was saved', () => {
    expect(new SessionTokenStore().read()).toBeNull();
  });

  it('never touches localStorage', () => {
    const localGetter = vi.spyOn(window, 'localStorage', 'get');
    const store = new SessionTokenStore();

    store.save(TOKEN);
    store.read();
    store.clear();

    expect(localGetter).not.toHaveBeenCalled();
    localGetter.mockRestore();
    expect(window.localStorage.length).toBe(0);
  });

  it('clears the token from sessionStorage', () => {
    const store = new SessionTokenStore();
    store.save(TOKEN);

    store.clear();

    expect(window.sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(store.read()).toBeNull();
  });

  it.each([
    ['the sessionStorage accessor throws', denied],
    ['sessionStorage writes throw', failingWrites],
  ])('falls back to memory when %s and reports persistent=false', (_label, storage) => {
    const store = new SessionTokenStore(storage);

    store.save(TOKEN);

    expect(store.persistent).toBe(false);
    expect(store.read()).toBe(TOKEN);
    store.clear();
    expect(store.read()).toBeNull();
  });
});
