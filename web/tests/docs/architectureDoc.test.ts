import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MIN_ADRS,
  adrs,
  badRefactorHashes,
  brokenReferences,
  gitLog,
  missingPatterns,
  missingSolidLetters,
  patternsWithoutReference,
  refactorHashes,
  references,
} from './architectureDoc';

// The architecture document is evidence (ARQ-09, ARQ-14, ARQ-18, ARQ-19), so CI checks it:
// every `arquivo:linha` must point inside a real file, the sections must be complete and
// the refactor commits must exist. The last block feeds broken documents to the same parser.

const repoRoot = resolve(import.meta.dirname, '../../..');
const doc = readFileSync(join(repoRoot, 'docs/architecture/web-dashboard.md'), 'utf8');

function isShallow(): boolean {
  return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repoRoot, encoding: 'utf8' }).trim() === 'true';
}

describe('docs/architecture/web-dashboard.md', () => {
  it('cites files by line, and every reference points inside an existing file', () => {
    expect(references(doc).length).toBeGreaterThanOrEqual(20);
    expect(brokenReferences(doc, repoRoot)).toEqual([]);
  });

  it('names Repository, Adapter, Registry and Strategy, each with a file and line (ARQ-09)', () => {
    expect(missingPatterns(doc)).toEqual([]);
    expect(patternsWithoutReference(doc)).toEqual([]);
  });

  it('has one cited occurrence of each SOLID letter (ARQ-14)', () => {
    expect(missingSolidLetters(doc)).toEqual([]);
  });

  it(`records at least ${MIN_ADRS} ADRs, each with context, decision, rejected alternatives and consequence (ARQ-18)`, () => {
    const report = adrs(doc);

    expect(report.count).toBeGreaterThanOrEqual(MIN_ADRS);
    expect(report.incomplete).toEqual([]);
  });

  it('logs at least two refactors whose commits exist and are `refactor` commits (ARQ-19)', () => {
    const hashes = refactorHashes(doc);
    // A shallow checkout (actions/checkout's default depth 1) cannot see the commits.
    expect(isShallow(), 'shallow clone: the CI checkout needs fetch-depth: 0').toBe(false);

    expect(hashes.length).toBeGreaterThanOrEqual(2);
    expect(badRefactorHashes(hashes, gitLog(repoRoot))).toEqual([]);
  });
});

describe('the parser rejects a broken document', () => {
  const broken = [
    '## 3. Padrões aplicados',
    '### Repository',
    'Em `web/src/does/not/exist.ts:3` e `web/package.json:99999`.',
    '### Adapter',
    'Sem referência.',
    '## 4. SOLID',
    '### S — Responsabilidade única',
    '`web/package.json:1`',
    '### O — Aberto/fechado',
    '`web/package.json:1`',
    '## 5. Decisões de arquitetura',
    '### ADR-1 — Camadas',
    '#### Contexto',
    '#### Decisão',
    '#### Consequência',
    '## 6. Refatorações',
    '### `0000000` — `refactor(web): nothing`',
    '### `abc1234` — `docs: not a refactor`',
  ].join('\n');

  it('flags a missing file and a line past the end of the file', () => {
    expect(brokenReferences(broken, repoRoot)).toEqual([
      'web/src/does/not/exist.ts:3 (no such file)',
      expect.stringMatching(/^web\/package\.json:99999 \(the file has \d+ lines\)$/),
    ]);
  });

  it('flags missing patterns and a pattern without a reference', () => {
    expect(missingPatterns(broken)).toEqual(['Registry', 'Strategy']);
    expect(patternsWithoutReference(broken)).toEqual(['Adapter']);
  });

  it('flags the missing SOLID letters', () => {
    expect(missingSolidLetters(broken)).toEqual(['L', 'I', 'D']);
  });

  it('counts too few ADRs and flags one without its rejected alternatives', () => {
    expect(adrs(broken)).toEqual({ count: 1, incomplete: ['ADR-1 — Camadas: Alternativas descartadas'] });
  });

  it('flags a hash not in the log and a commit that is not a refactor', () => {
    const log = new Map([['abc1234ffffffffffffffffffffffffffffffff', 'docs: not a refactor']]);

    expect(badRefactorHashes(refactorHashes(broken), log)).toEqual([
      '0000000 (not in git log)',
      'abc1234 (subject "docs: not a refactor" is not a refactor)',
    ]);
  });
});
