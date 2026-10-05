import { cruise, type ICruiseResult, type IConfiguration } from 'dependency-cruiser';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';

// Runs the real .dependency-cruiser.cjs over a fixture folder and returns the
// violations as `rule: from -> to`, so a test can assert exactly which rule fired.

const webRoot = resolve(import.meta.dirname, '../..');
const config = createRequire(import.meta.url)(join(webRoot, '.dependency-cruiser.cjs')) as IConfiguration;

export interface Violation {
  rule: string;
  from: string;
  to: string;
}

export async function violationsIn(fixture: string): Promise<Violation[]> {
  const target = relative(webRoot, join(import.meta.dirname, 'fixtures', fixture)).replaceAll('\\', '/');
  const { output } = await cruise([target], {
    ...config.options,
    ruleSet: { forbidden: config.forbidden ?? [] },
    validate: true,
    baseDir: webRoot,
  });
  const { violations } = (output as ICruiseResult).summary;
  return violations.map((v) => ({
    rule: v.rule.name,
    from: v.from.slice(target.length + 1),
    to: v.to.startsWith(target) ? v.to.slice(target.length + 1) : packageName(v.to),
  }));
}

/** `node_modules/@scope/pkg/dist/x.js` -> `@scope/pkg`; anything else unchanged. */
function packageName(path: string): string {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(path);
  return match?.[1] ?? path;
}
