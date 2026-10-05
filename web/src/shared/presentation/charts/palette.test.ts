import { describe, expect, it } from 'vitest';
import { blockOf, contrast, declarations, themes, type Theme } from '../../../test/cssTokens';
import { SERIES_COLORS, SERIES_MARKERS, ZONE_COLORS, seriesColor, seriesMarker } from './palette';

const GRAPHIC_MIN = 3;
const BACKGROUNDS = ['--color-canvas', '--color-surface'] as const;

/** `var(--series-1)` to `--series-1`. */
const tokenOf = (cssVar: string): string => /^var\((--[\w-]+)\)$/.exec(cssVar)?.[1] ?? '';

describe('series palette', () => {
  it('refers to CSS variables only, one distinct variable per series', () => {
    const names = SERIES_COLORS.map(tokenOf);
    expect(names.every((name) => name.startsWith('--series-'))).toBe(true);
    expect(new Set(names).size).toBe(SERIES_COLORS.length);
  });

  it('defines every series variable in the light theme and overrides it in the dark theme', () => {
    const dark = declarations(blockOf(":root[data-theme='dark']"));
    for (const name of SERIES_COLORS.map(tokenOf)) {
      expect(themes.light[name], name).toMatch(/^#[0-9a-f]{6}$/);
      expect(dark[name], name).toMatch(/^#[0-9a-f]{6}$/);
      expect(dark[name], name).not.toBe(themes.light[name]);
    }
  });

  describe.each<Theme>(['light', 'dark'])('%s theme (RSP-08)', (theme) => {
    const cases = SERIES_COLORS.flatMap((color) => BACKGROUNDS.map((background) => [color, background] as const));

    it.each(cases)('%s is at least 3:1 against %s', (color, background) => {
      const foreground = themes[theme][tokenOf(color)] as string;
      expect(contrast(foreground, themes[theme][background] as string)).toBeGreaterThanOrEqual(GRAPHIC_MIN);
    });
  });

  it('backs up the 3:1 rule: a color just under it would be caught', () => {
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(GRAPHIC_MIN);
    expect(contrast('#bbbbbb', '#ffffff')).toBeLessThan(GRAPHIC_MIN);
  });
});

describe('series markers (RSP-08)', () => {
  it('gives each series color its own marker shape, so color is not the only cue', () => {
    expect(SERIES_MARKERS.length).toBeGreaterThanOrEqual(SERIES_COLORS.length);
    expect(new Set(SERIES_MARKERS).size).toBe(SERIES_MARKERS.length);
  });

  it('pairs the nth color with the nth marker and starts over past the palette', () => {
    expect(seriesColor(0)).toBe('var(--series-1)');
    expect(seriesMarker(0)).toBe('circle');
    expect(seriesColor(SERIES_COLORS.length)).toBe(seriesColor(0));
    expect(seriesMarker(SERIES_MARKERS.length + 1)).toBe(seriesMarker(1));
  });
});

describe('zone colors', () => {
  it('lists the five zones from urgent low to urgent high, each defined in both themes', () => {
    expect(ZONE_COLORS.map(tokenOf)).toEqual([
      '--zone-urgent-low',
      '--zone-low',
      '--zone-target',
      '--zone-high',
      '--zone-urgent-high',
    ]);
    for (const name of ZONE_COLORS.map(tokenOf)) {
      expect(themes.light[name]).toBeDefined();
      expect(themes.dark[name]).toBeDefined();
    }
  });
});
