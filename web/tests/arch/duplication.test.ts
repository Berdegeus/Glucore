import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ARQ-17: duplication in web/src above 3 % (jscpd) fails `npm run dup` and CI.

const webRoot = resolve(import.meta.dirname, '../..');
const jscpdBin = join(webRoot, 'node_modules/jscpd/run-jscpd.js');

function runJscpd(path: string) {
  return spawnSync(process.execPath, [jscpdBin, '--config', '.jscpd.json', path], {
    cwd: webRoot,
    encoding: 'utf8',
  });
}

describe('duplication limit (jscpd)', () => {
  it('caps duplication at 3 %', () => {
    const config = JSON.parse(readFileSync(join(webRoot, '.jscpd.json'), 'utf8')) as { threshold: number };
    expect(config.threshold).toBe(3);
  });

  it('fails on two duplicated files', () => {
    const result = runJscpd('tests/arch/fixtures/duplication/src');
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('over threshold (3.0%)');
  });

  it('passes on src', () => {
    const result = runJscpd('src');
    expect(result.status).toBe(0);
  });
});
