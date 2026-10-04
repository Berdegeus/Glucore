import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'glucore.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

interface ThemeContextValue {
  /** What the person picked; `system` follows `prefers-color-scheme` (RSP-10). */
  choice: ThemeChoice;
  /** The theme in effect, and the value of `data-theme` on `<html>`. */
  resolved: ResolvedTheme;
  setChoice(choice: ThemeChoice): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function darkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null;
}

function subscribeToSystem(onChange: () => void): () => void {
  const query = darkQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

const systemPrefersDark = (): boolean => darkQuery()?.matches ?? false;

function isChoice(value: unknown): value is ThemeChoice {
  return CHOICES.includes(value as ThemeChoice);
}

/** The stored choice, or `system` when there is none or the browser refuses storage. */
function readStoredChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function storeChoice(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice still applies, only until reload.
  }
}

/** Applies the theme to `<html>` and remembers the choice in the browser (RSP-10). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setStoredChoice] = useState<ThemeChoice>(readStoredChoice);
  const systemDark = useSyncExternalStore(subscribeToSystem, systemPrefersDark, () => false);
  const resolved: ResolvedTheme = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    storeChoice(next);
    setStoredChoice(next);
  }, []);

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
