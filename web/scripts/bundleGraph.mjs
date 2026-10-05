// Reads dist/index.html and answers "which JavaScript does the first load
// fetch?": the entry script, every modulepreload chunk and whatever those
// import statically. Dynamic `import()` is what React.lazy compiles to, so it
// is deliberately not followed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT_TAG = /<script\b[^>]*\bsrc="\/?([^"]+\.js)"/g;
const PRELOAD_TAG = /<link\b[^>]*\brel="modulepreload"[^>]*\bhref="\/?([^"]+\.js)"/g;
const STATIC_IMPORT = /(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g;

const matches = (text, pattern) => [...text.matchAll(pattern)].map((m) => m[1]);

/** JavaScript files (relative to distDir, `assets/x.js`) loaded on the first paint. */
export function initialChunks(distDir) {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const found = new Set([...matches(html, SCRIPT_TAG), ...matches(html, PRELOAD_TAG)]);
  for (const file of found) {
    const folder = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
    const source = readFileSync(join(distDir, file), 'utf8');
    for (const imported of matches(source, STATIC_IMPORT)) found.add(folder + imported);
  }
  return [...found];
}

// A chart or editor library inside the first load breaks DEP-06. Names catch a
// chunk Vite names after the package; the content markers are strings the
// libraries keep through minification (Recharts class names, dnd-kit's
// accessibility ids).
const FORBIDDEN_NAME = /recharts|dnd-kit/i;
const FORBIDDEN_CONTENT = [/recharts-(?:wrapper|surface)/, /DndDescribedBy/, /DndLiveRegion/];

/** `[file, reason]` pairs for each initial chunk that carries a lazy-only library. */
export function lazyLibrariesInInitialLoad(distDir) {
  const offenders = [];
  for (const file of initialChunks(distDir)) {
    if (FORBIDDEN_NAME.test(file)) offenders.push([file, 'name']);
    else if (FORBIDDEN_CONTENT.some((marker) => marker.test(readFileSync(join(distDir, file), 'utf8')))) {
      offenders.push([file, 'content']);
    }
  }
  return offenders;
}
