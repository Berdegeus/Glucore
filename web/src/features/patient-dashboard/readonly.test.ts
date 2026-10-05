/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Readings, carbohydrate, insulin and alerts are recorded by the mobile app.
// The web only reads them (PAC-18), so no module of it may send a write to
// their paths. The check is structural: it reads the source, not a run.

const SRC = join(import.meta.dirname, '../..');

/** A path of clinical data in a string or template literal: `'/readings'`, `` `${base}/carbs/${id}` ``. */
const CLINICAL_PATH = /(?:['"`}])\/(?:readings|carbs|insulin|alerts)(?![\w-])/;
/** A write verb as a string (`method: 'POST'`) or as a call (`http.delete(`, `axios.put(`). */
const WRITE_VERB = /['"`](?:POST|PUT|DELETE|PATCH)['"`]|\.(?:post|put|delete|patch)\s*\(/i;

/** True when one file names a clinical path and also sends a write, so it could be writing to it. */
function writesClinicalData(source: string): boolean {
  return CLINICAL_PATH.test(source) && WRITE_VERB.test(source);
}

const isTestFile = (path: string) => /\.test\.tsx?$/.test(path) || path.split(/[\\/]/).includes('test');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !isTestFile(relative(SRC, path)) ? [path] : [];
  });
}

const files = sourceFiles(SRC).map((path) => ({ path: relative(SRC, path).replaceAll('\\', '/'), source: readFileSync(path, 'utf8') }));

describe('clinical data is read-only on the web (PAC-18)', () => {
  it('has no module of web/src that sends a POST, PUT, DELETE or PATCH to readings, carbs, insulin or alerts', () => {
    expect(files.filter(({ source }) => writesClinicalData(source)).map(({ path }) => path)).toEqual([]);
  });

  it('really reads the source: it sees the diary repository, which names those paths, and the layout one, which writes', () => {
    const named = files.filter(({ source }) => CLINICAL_PATH.test(source)).map(({ path }) => path);
    const writers = files.filter(({ source }) => WRITE_VERB.test(source)).map(({ path }) => path);

    expect(named).toContain('features/patient-dashboard/infrastructure/httpDiaryRepository.ts');
    expect(writers).toContain('features/dashboard-layout/infrastructure/httpLayoutRepository.ts');
    expect(named).not.toContain('features/dashboard-layout/infrastructure/httpLayoutRepository.ts');
  });

  it.each([
    ['a POST in an object literal', "http.request({ method: 'POST', path: '/readings', body })"],
    ['a PUT to an entry of a template path', 'http.request({ method: "PUT", path: `/carbs/${id}` })'],
    ['a DELETE on insulin', "request({ path: '/insulin', method: 'DELETE' })"],
    ['a PATCH on alerts with a base URL', 'fetch(`${base}/alerts`, { method: `PATCH` })'],
    ['a client call with a verb method', "client.post('/readings', body)"],
    ['a path held in a constant and written elsewhere', "const PATH = '/carbs';\nhttp.request({ method: 'POST', path: PATH });"],
  ])('flags %s', (_label, source) => {
    expect(writesClinicalData(source)).toBe(true);
  });

  it.each([
    ['a GET of readings', "http.request({ path: '/readings' })"],
    ['an explicit GET of carbs', "http.request({ method: 'GET', path: '/carbs?limit=500' })"],
    ['the layout write', "http.request({ method: 'PUT', path: '/preferences/dashboard', body })"],
    ['the login', "http.request({ method: 'POST', path: '/auth/login', body })"],
    ['alert thresholds, which are settings and not alerts', "http.request({ method: 'PUT', path: '/settings/alerts', body })"],
    ['a word that only starts like a clinical path', "http.request({ method: 'POST', path: '/readings-export' })"],
  ])('does not flag %s', (_label, source) => {
    expect(writesClinicalData(source)).toBe(false);
  });
});
