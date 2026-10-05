import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { runScript, writeFakeDist, type FakeDist } from './fakeDist';

// DEP-06: the JavaScript of the first load stays within 250 kB gzip.
// `npm run size` (scripts/checkBundleSize.mjs) sums the gzip of each file the
// first load fetches and fails above 250 000 bytes with the total in the message.

const BUDGET = 250_000;

/** Seeded xorshift, so the fixture is the same on every run. */
function noise(length: number): string {
  const bytes = Buffer.alloc(length);
  let state = 2463534242;
  for (let i = 0; i < length; i += 1) {
    state = (state ^ (state << 13)) >>> 0;
    state = (state ^ (state >>> 17)) >>> 0;
    state = (state ^ (state << 5)) >>> 0;
    bytes[i] = 33 + (state % 90);
  }
  return bytes.toString('latin1');
}

/** JavaScript text whose gzip is exactly `target` bytes, so the budget edges are exact. */
function gzipOf(target: number): string {
  let length = Math.round(target * 1.2);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const source = `export const a="${noise(length)}";`;
    const bytes = gzipSync(source).length;
    if (bytes === target) return source;
    length += Math.trunc((target - bytes) * 1.2) || Math.sign(target - bytes);
  }
  throw new Error(`could not build a fixture of ${target} gzip bytes`);
}

const single = (bytes: number, extra: Record<string, string> = {}): FakeDist => ({
  entry: 'index-1.js',
  files: { 'index-1.js': gzipOf(bytes), ...extra },
});
const size = (dist: FakeDist) => runScript('checkBundleSize.mjs', writeFakeDist(dist));

describe('bundle size budget', () => {
  it.each([BUDGET - 1, BUDGET])('passes at %i bytes of gzip', (bytes) => {
    const result = size(single(bytes));
    expect(result.status).toBe(0);
    expect(result.output).toContain(`${bytes} bytes`);
  });

  it('fails one byte above the budget and says the total', () => {
    const result = size(single(BUDGET + 1));
    expect(result.status).toBe(1);
    expect(result.output).toContain('250001 bytes');
    expect(result.output).toContain('250000 byte');
  });

  it('adds the modulepreload chunks to the entry script', () => {
    const result = size({
      entry: 'index-1.js',
      preload: ['shell-1.js'],
      files: { 'index-1.js': gzipOf(150_000), 'shell-1.js': gzipOf(100_001) },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('250001 bytes');
  });

  it('does not count a lazy chunk the first load never fetches', () => {
    const result = size(single(1_000, { 'chartSurface-1.js': gzipOf(BUDGET * 2) }));
    expect(result.status).toBe(0);
    expect(result.output).toContain('1000 bytes');
  });

  it('asks for a build when dist has no index.html', () => {
    const result = runScript('checkBundleSize.mjs', '/nonexistent-dist');
    expect(result.status).toBe(1);
    expect(result.output).toContain('npm run build');
  });
});
