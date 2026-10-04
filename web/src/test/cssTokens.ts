/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read from disk: Vitest turns a `?raw` CSS import into an empty string.
export const tokensCss = readFileSync(
  join(import.meta.dirname, '..', 'shared', 'presentation', 'theme', 'tokens.css'),
  'utf8',
);

export type Theme = 'light' | 'dark';
export type Tokens = Record<string, string>;

/** Body of the first rule whose selector is exactly `selector`. */
export function blockOf(selector: string, source = tokensCss): string {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
}

export function declarations(block: string): Tokens {
  const tokens: Tokens = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) tokens[match[1] as string] = (match[2] as string).trim();
  return tokens;
}

const light = declarations(blockOf(':root'));
const dark = { ...light, ...declarations(blockOf(":root[data-theme='dark']")) };
export const themes: Record<Theme, Tokens> = { light, dark };

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG contrast ratio between two `#rrggbb` colors. */
export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Contrast of two tokens (names without the `--`) in one theme. */
export function ratio(theme: Theme, foreground: string, background: string): number {
  const tokens = themes[theme];
  const fg = tokens[`--${foreground}`];
  const bg = tokens[`--${background}`];
  if (!fg || !bg) throw new Error(`missing token ${foreground} or ${background}`);
  return contrast(fg, bg);
}
