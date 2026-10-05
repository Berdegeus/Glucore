import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Builds a throwaway `dist/` and runs the real `scripts/*.mjs` against it, so
// the deploy guards are tested through the same entry point `npm run` uses.

const webRoot = resolve(import.meta.dirname, '../..');

export interface FakeDist {
  /** Entry script, the first `<script type="module">` of index.html. */
  entry: string;
  /** `<link rel="modulepreload">` chunks. */
  preload?: string[];
  /** Every file of dist/assets, by name, with its source text. */
  files: Record<string, string>;
}

export function writeFakeDist({ entry, preload = [], files }: FakeDist): string {
  const dist = mkdtempSync(join(tmpdir(), 'glucore-dist-'));
  const links = preload.map((file) => `<link rel="modulepreload" crossorigin href="/assets/${file}">`).join('');
  const html = `<!doctype html><html><head><script type="module" crossorigin src="/assets/${entry}"></script>${links}</head><body></body></html>`;
  writeFileSync(join(dist, 'index.html'), html);
  for (const [name, source] of Object.entries(files)) {
    const path = join(dist, 'assets', name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return dist;
}

export function runScript(script: string, dist: string) {
  const result = spawnSync(process.execPath, [join(webRoot, 'scripts', script), dist], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
