import { describe, expect, it } from 'vitest';
import { runScript, writeFakeDist } from './fakeDist';

// DEP-06 / ARQ-11: the dashboards and the chart/editor libraries are lazy
// chunks. scripts/checkInitialChunks.mjs fails when the first load of `dist/`
// (entry script, modulepreload chunks and their static imports) holds them.

const RECHARTS_SOURCE = 'const a="recharts-wrapper";export{a as R};';
const DND_SOURCE = 'const a="DndDescribedBy";export{a as D};';
const LAZY_ENTRY = 'import{a}from"./shell-1.js";const page=()=>import("./chartSurface-1.js");export{page};';

const check = (dist: Parameters<typeof writeFakeDist>[0]) => runScript('checkInitialChunks.mjs', writeFakeDist(dist));

describe('initial chunks guard', () => {
  it('passes when Recharts and dnd-kit sit behind a dynamic import', () => {
    const result = check({
      entry: 'index-1.js',
      preload: ['shell-1.js'],
      files: {
        'index-1.js': LAZY_ENTRY,
        'shell-1.js': 'export const a=1;',
        'chartSurface-1.js': RECHARTS_SOURCE,
        'editMode-1.js': DND_SOURCE,
      },
    });
    expect(result.status).toBe(0);
  });

  it('fails when the entry statically imports a chunk with Recharts', () => {
    const result = check({
      entry: 'index-1.js',
      files: { 'index-1.js': 'import{R}from"./chartSurface-1.js";export{R};', 'chartSurface-1.js': RECHARTS_SOURCE },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/chartSurface-1.js');
  });

  it('fails when a modulepreload chunk is named after a library', () => {
    const result = check({
      entry: 'index-1.js',
      preload: ['recharts-1.js'],
      files: { 'index-1.js': 'export const a=1;', 'recharts-1.js': 'export const b=2;' },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/recharts-1.js');
  });

  it('follows static imports of a preloaded chunk down to dnd-kit', () => {
    const result = check({
      entry: 'index-1.js',
      preload: ['shell-1.js'],
      files: {
        'index-1.js': 'export const a=1;',
        'shell-1.js': 'export*from"./editMode-1.js";import"./editMode-1.js";',
        'editMode-1.js': DND_SOURCE,
      },
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain('assets/editMode-1.js');
  });

  it('asks for a build when dist has no index.html', () => {
    const result = runScript('checkInitialChunks.mjs', '/nonexistent-dist');
    expect(result.status).toBe(1);
    expect(result.output).toContain('npm run build');
  });
});
