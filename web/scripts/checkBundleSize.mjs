// Sums the gzip size of the JavaScript the first load fetches (entry script,
// modulepreload chunks, their static imports) and fails above the DEP-06
// budget. Lazy chunks are not part of the first load, so they do not count.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { initialChunks } from './bundleGraph.mjs';

/** 250 kB, counted as 250 * 1000 bytes of gzip. */
const BUDGET_BYTES = 250_000;
const distDir = process.argv[2] ?? 'dist';
const indexPath = join(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error(`size: ${indexPath} not found; run \`npm run build\` first`);
  process.exit(1);
}

const gzipBytes = (file) => gzipSync(readFileSync(join(distDir, file))).length;
const total = initialChunks(distDir).reduce((sum, file) => sum + gzipBytes(file), 0);
const kb = (bytes) => (bytes / 1000).toFixed(1);

if (total > BUDGET_BYTES) {
  console.error(
    `size: initial JavaScript is ${total} bytes gzip (${kb(total)} kB), above the ${BUDGET_BYTES} byte (${kb(BUDGET_BYTES)} kB) budget`,
  );
  process.exit(1);
}
console.log(`size: initial JavaScript is ${total} bytes gzip (${kb(total)} kB, budget ${kb(BUDGET_BYTES)} kB)`);
