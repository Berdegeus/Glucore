import { describe, expect, it, vi } from 'vitest';
import { memoryTokenStore } from '../../../test/authFakes';
import { createLogout, type SessionCleaner } from './logout';

describe('createLogout (ACC-11)', () => {
  it('erases the stored token', () => {
    const tokenStore = memoryTokenStore('tok-1');

    createLogout({ tokenStore, cleaners: new Set() })();

    expect(tokenStore.read()).toBeNull();
  });

  it('calls every registered cleaner exactly once, after the token is gone', () => {
    const tokenStore = memoryTokenStore('tok-1');
    const tokenWhenCleaning: Array<string | null> = [];
    const first = vi.fn(() => tokenWhenCleaning.push(tokenStore.read()));
    const second = vi.fn();

    createLogout({ tokenStore, cleaners: new Set<SessionCleaner>([first, second]) })();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(tokenWhenCleaning).toEqual([null]);
  });

  it('runs a cleaner registered after the use case was created', () => {
    const cleaners = new Set<SessionCleaner>();
    const logout = createLogout({ tokenStore: memoryTokenStore('tok-1'), cleaners });
    const late = vi.fn();
    cleaners.add(late);

    logout();

    expect(late).toHaveBeenCalledTimes(1);
  });
});
