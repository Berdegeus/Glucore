import { ESLint, type Linter } from 'eslint';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// ARQ-12 / ARQ-16: the readability limits fail `npm run lint`. Each case lints
// a virtual file (nothing is written to disk) through the real eslint.config.js.

const webRoot = resolve(import.meta.dirname, '../..');
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: webRoot });
});

async function lint(code: string, relativePath = 'src/virtual/sample.ts'): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath: join(webRoot, relativePath) });
  if (!result) throw new Error('ESLint returned no result');
  return result.messages;
}

function errorsFor(messages: Linter.LintMessage[], ruleId: string) {
  return messages.filter((m) => m.ruleId === ruleId && m.severity === 2);
}

const fileOfLines = (count: number) =>
  Array.from({ length: count }, (_, i) => `export const value${i} = ${i};`).join('\n') + '\n';

const functionWithBranches = (ifs: number) =>
  [
    'export function pick(n: number): number {',
    ...Array.from({ length: ifs }, (_, i) => `  if (n === ${i}) return ${i};`),
    '  return -1;',
    '}',
    '',
  ].join('\n');

const functionWithDepth = (depth: number) => {
  const open = Array.from({ length: depth }, (_, i) => `${'  '.repeat(i + 1)}if (n > ${i}) {`);
  const close = Array.from({ length: depth }, (_, i) => `${'  '.repeat(depth - i)}}`);
  return ['export function deep(n: number): number {', ...open, `${'  '.repeat(depth + 1)}return n;`, ...close, '  return 0;', '}', ''].join('\n');
};

const functionWithParams = (count: number) => {
  const params = Array.from({ length: count }, (_, i) => `p${i}: number`).join(', ');
  const sum = Array.from({ length: count }, (_, i) => `p${i}`).join(' + ');
  return `export function sum(${params}): number {\n  return ${sum};\n}\n`;
};

describe('max-lines (250, source files only)', () => {
  it('accepts a source file with exactly 250 lines', async () => {
    expect(errorsFor(await lint(fileOfLines(250)), 'max-lines')).toHaveLength(0);
  });

  it('rejects a source file with 251 lines', async () => {
    expect(errorsFor(await lint(fileOfLines(251)), 'max-lines')).toHaveLength(1);
  });

  it('accepts a test file with 300 lines', async () => {
    const messages = await lint(fileOfLines(300), 'src/virtual/sample.test.ts');
    expect(messages).toEqual([]);
  });
});

describe('complexity (10)', () => {
  it('accepts cyclomatic complexity 10', async () => {
    expect(errorsFor(await lint(functionWithBranches(9)), 'complexity')).toHaveLength(0);
  });

  it('rejects cyclomatic complexity 11', async () => {
    expect(errorsFor(await lint(functionWithBranches(10)), 'complexity')).toHaveLength(1);
  });
});

describe('max-depth (3)', () => {
  it('accepts nesting depth 3', async () => {
    expect(errorsFor(await lint(functionWithDepth(3)), 'max-depth')).toHaveLength(0);
  });

  it('rejects nesting depth 4', async () => {
    expect(errorsFor(await lint(functionWithDepth(4)), 'max-depth')).toHaveLength(1);
  });
});

describe('max-params (4)', () => {
  it('accepts 4 parameters', async () => {
    expect(errorsFor(await lint(functionWithParams(4)), 'max-params')).toHaveLength(0);
  });

  it('rejects 5 parameters', async () => {
    expect(errorsFor(await lint(functionWithParams(5)), 'max-params')).toHaveLength(1);
  });
});

describe('safety rules', () => {
  it('rejects dangerouslySetInnerHTML', async () => {
    const code = [
      'export function Raw({ html }: { html: string }) {',
      '  return <div dangerouslySetInnerHTML={{ __html: html }} />;',
      '}',
      '',
    ].join('\n');
    expect(errorsFor(await lint(code, 'src/virtual/Raw.tsx'), 'react/no-danger')).toHaveLength(1);
  });

  it('rejects an explicit any', async () => {
    const code = 'export function id(x: any): unknown {\n  return x;\n}\n';
    expect(errorsFor(await lint(code), '@typescript-eslint/no-explicit-any')).toHaveLength(1);
  });

  it('rejects an eslint-disable comment without a justification', async () => {
    const code = '// eslint-disable-next-line @typescript-eslint/no-explicit-any\nexport const loose: any = 1;\n';
    expect(errorsFor(await lint(code), '@eslint-community/eslint-comments/require-description')).toHaveLength(1);
  });

  it('accepts an eslint-disable comment with a justification', async () => {
    const code =
      '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party payload\nexport const loose: any = 1;\n';
    expect(await lint(code)).toEqual([]);
  });
});

describe('clean file', () => {
  it('passes with no message at all', async () => {
    const code = [
      'export function Greeting({ name }: { name: string }) {',
      '  return <p>Olá, {name}</p>;',
      '}',
      '',
    ].join('\n');
    expect(await lint(code, 'src/virtual/Greeting.tsx')).toEqual([]);
  });
});
