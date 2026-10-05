// Fails when the first load of dist/ contains Recharts or dnd-kit (DEP-06, ARQ-11).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { lazyLibrariesInInitialLoad } from './bundleGraph.mjs';

const distDir = process.argv[2] ?? 'dist';

if (!existsSync(join(distDir, 'index.html'))) {
  console.error(`chunks: ${join(distDir, 'index.html')} not found; run \`npm run build\` first`);
  process.exit(1);
}

const offenders = lazyLibrariesInInitialLoad(distDir);
if (offenders.length > 0) {
  for (const [file, reason] of offenders) console.error(`chunks: ${file} is in the first load and matches by ${reason}`);
  process.exit(1);
}
console.log('chunks: the first load has no chart or editor library');
