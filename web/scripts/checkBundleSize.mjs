// Sums the gzip size of the JavaScript the entry HTML loads and fails above
// the DEP-06 budget. Lazy chunks are not referenced by index.html, so they
// do not count.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_BYTES = 250 * 1000;
const distDir = process.argv[2] ?? 'dist';
const indexPath = join(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error(`size: ${indexPath} not found; run \`npm run build\` first`);
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
const scripts = [...html.matchAll(/(?:src|href)="\/?([^"]+\.js)"/g)].map((m) => m[1]);
const total = scripts.reduce((sum, file) => sum + gzipSync(readFileSync(join(distDir, file))).length, 0);
const kb = (total / 1000).toFixed(1);

if (total > BUDGET_BYTES) {
  console.error(`size: initial JavaScript is ${kb} kB gzip, above the ${BUDGET_BYTES / 1000} kB budget`);
  process.exit(1);
}
console.log(`size: initial JavaScript is ${kb} kB gzip (budget ${BUDGET_BYTES / 1000} kB)`);
