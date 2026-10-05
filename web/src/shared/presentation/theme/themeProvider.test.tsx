import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from './themeProvider';

/** A controllable `prefers-color-scheme` source. */
function mockSystemTheme(initiallyDark: boolean) {
  let dark = initiallyDark;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn(
    () =>
      ({
        get matches() {
          return dark;
        },
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList,
  );
  return {
    set(next: boolean) {
      dark = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

function Probe() {
  const { choice, resolved, setChoice } = useTheme();
  return (
    <div>
      <span data-testid="state">{`${choice}/${resolved}`}</span>
      <button onClick={() => setChoice('dark')}>escuro</button>
      <button onClick={() => setChoice('light')}>claro</button>
      <button onClick={() => setChoice('system')}>sistema</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );

const htmlTheme = () => document.documentElement.dataset.theme;
const state = () => screen.getByTestId('state').textContent;
const click = (name: string) => act(() => screen.getByRole('button', { name }).click());

describe('ThemeProvider (RSP-10)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error jsdom has no matchMedia; remove what the test installed.
    delete window.matchMedia;
  });

  it.each([
    [true, 'dark'],
    [false, 'light'],
  ])('follows the system by default (dark system: %s)', (systemDark, expected) => {
    mockSystemTheme(systemDark);
    renderProvider();
    expect(state()).toBe(`system/${expected}`);
    expect(htmlTheme()).toBe(expected);
  });

  it('follows the system when it changes while the choice is system', () => {
    const system = mockSystemTheme(false);
    renderProvider();
    system.set(true);
    expect(htmlTheme()).toBe('dark');
  });

  it('applies a choice at once and ignores the system afterwards', () => {
    const system = mockSystemTheme(false);
    renderProvider();
    click('escuro');
    expect(htmlTheme()).toBe('dark');
    system.set(false);
    system.set(true);
    click('claro');
    expect(htmlTheme()).toBe('light');
    expect(state()).toBe('light/light');
  });

  it('remembers the choice across a remount', () => {
    mockSystemTheme(false);
    const first = renderProvider();
    click('escuro');
    first.unmount();
    delete document.documentElement.dataset.theme;

    renderProvider();
    expect(state()).toBe('dark/dark');
    expect(htmlTheme()).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('falls back to the system for a stored value it does not know', () => {
    mockSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    renderProvider();
    expect(state()).toBe('system/dark');
  });

  it('works when localStorage throws', () => {
    mockSystemTheme(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderProvider();
    expect(state()).toBe('system/light');
    click('escuro');
    expect(state()).toBe('dark/dark');
    expect(htmlTheme()).toBe('dark');
  });

  it('uses light when the browser has no matchMedia', () => {
    renderProvider();
    expect(state()).toBe('system/light');
  });
});
