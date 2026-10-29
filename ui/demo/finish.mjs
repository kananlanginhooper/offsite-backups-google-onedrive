// GitHub Pages demo: copies the demo build to ../docs. Run by `npm run build:demo`.
// No back end: the demo build swaps in DemoData (mock data in the browser).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, '..', 'dist', 'demo', 'browser');
const docs = join(here, '..', '..', 'docs');
if (!existsSync(join(build, 'index.html'))) throw new Error(`no demo build at ${build}`);

// replace the previous demo, but keep docs/ folders that aren't the demo (docs/refactor: screenshots)
const KEEP = new Set(['refactor', 'gate-diff.md']);
mkdirSync(docs, { recursive: true });
for (const name of readdirSync(docs)) if (!KEEP.has(name)) rmSync(join(docs, name), { recursive: true, force: true });
cpSync(build, docs, { recursive: true });
// Pages has no SPA fallback: a deep link like /copies serves 404.html, which is the app itself
writeFileSync(join(docs, '404.html'), readFileSync(join(docs, 'index.html')));
writeFileSync(join(docs, '.nojekyll'), '');
console.log(`demo written to ${docs}`);
