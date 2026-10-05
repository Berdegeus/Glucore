import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Parser of docs/architecture/web-dashboard.md (ARQ-09, ARQ-14, ARQ-18, ARQ-19).
// Every check returns the problems it found, so a test can feed it a broken
// in-memory document and see it rejected.

export interface FileReference {
  path: string;
  line: number;
}

/** A backticked `path/to/file.ext:123`, path relative to the repository root. */
const REFERENCE = /`([^`\s:]+\.[A-Za-z]+):(\d+)`/g;
const SOLID_LETTERS = ['S', 'O', 'L', 'I', 'D'] as const;
export const REQUIRED_PATTERNS = ['Repository', 'Adapter', 'Registry', 'Strategy'] as const;
export const ADR_PARTS = ['Contexto', 'Decisão', 'Alternativas descartadas', 'Consequência'] as const;
export const MIN_ADRS = 6;

export function references(doc: string): FileReference[] {
  return [...doc.matchAll(REFERENCE)].map((match) => ({ path: match[1] ?? '', line: Number(match[2]) }));
}

function lineCount(file: string): number {
  return readFileSync(file, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).length;
}

/** References whose file is missing, or whose line is 0 or past the end of the file. */
export function brokenReferences(doc: string, repoRoot: string): string[] {
  return references(doc).flatMap(({ path, line }) => {
    const file = join(repoRoot, path);
    if (!existsSync(file) || !statSync(file).isFile()) return [`${path}:${line} (no such file)`];
    const lines = lineCount(file);
    return line >= 1 && line <= lines ? [] : [`${path}:${line} (the file has ${lines} lines)`];
  });
}

/** The body of the `## <n>.` section, up to the next `## ` heading; '' when absent. */
export function section(doc: string, number: number): string {
  const lines = doc.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## ${number}.`));
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

function headings(text: string, level: number): string[] {
  const prefix = `${'#'.repeat(level)} `;
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
}

/** Required pattern names that have no `###` heading in the patterns section (3). */
export function missingPatterns(doc: string): string[] {
  const names = headings(section(doc, 3), 3);
  return REQUIRED_PATTERNS.filter((pattern) => !names.some((name) => name.startsWith(pattern)));
}

/** Pattern headings that cite no `arquivo:linha` in their own block. */
export function patternsWithoutReference(doc: string): string[] {
  return blocks(section(doc, 3), 3)
    .filter((block) => references(block.body).length === 0)
    .map((block) => block.title);
}

/** SOLID letters with no `### <letter> —` heading, or whose block cites no `arquivo:linha`. */
export function missingSolidLetters(doc: string): string[] {
  const letters = blocks(section(doc, 4), 3);
  return SOLID_LETTERS.filter((letter) => {
    const block = letters.find((candidate) => candidate.title.startsWith(`${letter} `));
    return !block || references(block.body).length === 0;
  });
}

interface Block {
  title: string;
  body: string;
}

function blocks(text: string, level: number): Block[] {
  const prefix = `${'#'.repeat(level)} `;
  const result: Block[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(prefix)) result.push({ title: line.slice(prefix.length).trim(), body: '' });
    else if (result.length > 0) (result[result.length - 1] as Block).body += `${line}\n`;
  }
  return result;
}

export interface AdrReport {
  count: number;
  /** `ADR title: missing part` for each ADR without one of the four subheadings. */
  incomplete: string[];
}

export function adrs(doc: string): AdrReport {
  const found = blocks(section(doc, 5), 3).filter((block) => block.title.startsWith('ADR'));
  const incomplete = found.flatMap((adr) => {
    const parts = headings(adr.body, 4);
    return ADR_PARTS.filter((part) => !parts.includes(part)).map((part) => `${adr.title}: ${part}`);
  });
  return { count: found.length, incomplete };
}

/** The commit hashes named in the `###` headings of the refactor section (6). */
export function refactorHashes(doc: string): string[] {
  return headings(section(doc, 6), 3).flatMap((title) => {
    const hash = /`([0-9a-f]{7,40})`/.exec(title)?.[1];
    return hash ? [hash] : [];
  });
}

/** `full hash -> subject` of every commit reachable from HEAD. */
export function gitLog(repoRoot: string): Map<string, string> {
  const out = execFileSync('git', ['log', '--format=%H %s'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const log = new Map<string, string>();
  for (const line of out.split('\n')) {
    const space = line.indexOf(' ');
    if (space > 0) log.set(line.slice(0, space), line.slice(space + 1));
  }
  return log;
}

/** Hashes not in the log, or whose commit subject does not start with `refactor`. */
export function badRefactorHashes(hashes: readonly string[], log: ReadonlyMap<string, string>): string[] {
  return hashes.flatMap((hash) => {
    const matches = [...log.entries()].filter(([full]) => full.startsWith(hash));
    if (matches.length !== 1) return [`${hash} (${matches.length === 0 ? 'not in git log' : 'ambiguous'})`];
    const subject = matches[0]?.[1] ?? '';
    return subject.startsWith('refactor') ? [] : [`${hash} (subject "${subject}" is not a refactor)`];
  });
}
