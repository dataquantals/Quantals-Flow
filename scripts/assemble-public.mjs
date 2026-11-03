#!/usr/bin/env node
/**
 * Assembles the deployable static site into `public/`.
 *
 * `npm run build` writes the route tree to the repository root because that is
 * where the Node server serves it from. Vercel (and most static hosts) expect a
 * single output directory, so this step copies only the public site — never the
 * server, sources, Convex functions or the SQLite database in `data/`.
 *
 * Run with: npm run build:vercel
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public');

/* Top-level entries that are tooling, sources or secrets — never published. */
const EXCLUDED = new Set([
  '.agents', '.git', '.gitignore', 'api',
  'convex', 'data', 'node_modules', 'public', 'scripts', 'server', 'shots', 'src',
  '_verify-pp', 'dashboard-preview-tmp'
]);

const ROOT_FILES = ['index.html', 'robots.txt', 'sitemap.xml'];
const ASSET_DIRS = ['assets'];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else if (entry.isFile()) fs.copyFileSync(src, dest);
  }
}

/** A route folder is any top-level directory holding its own index.html. */
function routeDirs() {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !EXCLUDED.has(e.name))
    .filter((e) => fs.existsSync(path.join(root, e.name, 'index.html')))
    .map((e) => e.name);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const copied = [];

for (const file of ROOT_FILES) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(outDir, file));
  copied.push(file);
}

for (const dir of ASSET_DIRS.concat(routeDirs())) {
  const src = path.join(root, dir);
  if (!fs.existsSync(src)) continue;
  copyDir(src, path.join(outDir, dir));
  copied.push(`${dir}/`);
}

/* Vercel serves `404.html` for unmatched paths. */
const notFound = path.join(outDir, '404', 'index.html');
if (fs.existsSync(notFound)) fs.copyFileSync(notFound, path.join(outDir, '404.html'));

/* Without this file Vercel falls back to a directory-listing style 404. */
console.log(`Assembled public/ with ${copied.length} entries:`);
for (const entry of copied) console.log(`  ${entry}`);
