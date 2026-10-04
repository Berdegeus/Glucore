/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read from disk: Vitest turns a `?raw` CSS import into an empty string.
const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

type Theme = 'light' | 'dark';
type Tokens = Record<string, string>;

const TEXT_MIN = 4.5;
const GRAPHIC_MIN = 3;
const ZONES = ['target', 'low', 'urgent-low', 'high', 'urgent-high'] as const;

/** Body of the first rule whose selector is exactly `selector`. */
function blockOf(selector: string, source = css): string {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
}

function declarations(block: string): Tokens {
  const tokens: Tokens = {};
  for (const match of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) tokens[match[1] as string] = (match[2] as string).trim();
  return tokens;
}

const light = declarations(blockOf(':root'));
const dark = { ...light, ...declarations(blockOf(":root[data-theme='dark']")) };
const themes: Record<Theme, Tokens> = { light, dark };

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

function ratio(theme: Theme, foreground: string, background: string): number {
  const tokens = themes[theme];
  const fg = tokens[`--${foreground}`];
  const bg = tokens[`--${background}`];
  if (!fg || !bg) throw new Error(`missing token ${foreground} or ${background}`);
  return contrast(fg, bg);
}

/** [foreground, background] pairs a person has to read. */
const TEXT_PAIRS: [string, string][] = [
  ['color-text', 'color-canvas'],
  ['color-text', 'color-surface'],
  ['color-text', 'color-surface-sunken'],
  ['color-text-muted', 'color-canvas'],
  ['color-text-muted', 'color-surface'],
  ['color-text-muted', 'color-surface-sunken'],
  ['color-brand', 'color-canvas'],
  ['color-on-brand', 'color-brand'],
  ['color-danger', 'color-canvas'],
  ['color-danger', 'color-surface'],
  ...ZONES.map((zone): [string, string] => [`zone-${zone}-ink`, `zone-${zone}-soft`]),
];

/** Parts of a control or chart that carry meaning without text. */
const GRAPHIC_PAIRS: [string, string][] = [
  ['color-border', 'color-canvas'],
  ['color-border', 'color-surface'],
  ['color-focus', 'color-canvas'],
  ['color-focus', 'color-surface'],
  ['color-brand', 'color-canvas'],
  ...ZONES.flatMap((zone): [string, string][] => [
    [`zone-${zone}`, 'color-canvas'],
    [`zone-${zone}`, 'color-surface'],
  ]),
];

describe('contrast helper', () => {
  it('measures the extremes and the 4.5:1 boundary', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(TEXT_MIN);
  });
});

describe.each<Theme>(['light', 'dark'])('%s theme contrast (RSP-08)', (theme) => {
  it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (foreground, background) => {
    expect(ratio(theme, foreground, background)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each(GRAPHIC_PAIRS)('graphic %s on %s is at least 3:1', (foreground, background) => {
    expect(ratio(theme, foreground, background)).toBeGreaterThanOrEqual(GRAPHIC_MIN);
  });
});

describe('theme completeness (RSP-10)', () => {
  it('overrides every color token in the dark theme', () => {
    const colorTokens = Object.keys(light).filter((name) => /^--(color|zone)-/.test(name));
    const overridden = Object.keys(declarations(blockOf(":root[data-theme='dark']")));
    expect(overridden.sort()).toEqual(colorTokens.sort());
  });

  it('keeps all color tokens as hex values', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const [name, value] of Object.entries(themes[theme])) {
        if (/^--(color|zone)-/.test(name)) expect(value, `${theme} ${name}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe('touch targets (RSP-04)', () => {
  const small = blockOf('@media (max-width: 1023px)');

  it('sets the control size to 44px below 1024px and keeps it smaller above', () => {
    expect(declarations(blockOf(':root', small))['--control-min-size']).toBe('44px');
    expect(parseInt(light['--control-min-size'] ?? '', 10)).toBeLessThan(44);
  });

  it('applies the control size as min-height and min-width on interactive elements', () => {
    const rule = css.slice(css.indexOf('button,'));
    const body = blockOf("[role='menuitem']", rule);
    expect(body).toContain('min-height: var(--control-min-size)');
    expect(body).toContain('min-width: var(--control-min-size)');
  });
});

describe('focus ring (RSP-06)', () => {
  it('draws a visible outline on keyboard focus', () => {
    const body = blockOf(':focus-visible');
    expect(body).toMatch(/outline:\s*var\(--focus-width\) solid var\(--color-focus\)/);
    expect(parseInt(light['--focus-width'] ?? '', 10)).toBeGreaterThanOrEqual(2);
  });
});
