#!/usr/bin/env node
/**
 * Link audit.
 *
 * Walks every page source plus the shared partials, resolves each internal
 * href against the route table produced by the front matter, and verifies the
 * `#fragment` too. `npm test` proves that routes resolve over HTTP; this tool
 * also proves the anchors inside those routes exist, which the HTTP test cannot
 * see because the server never looks at the fragment.
 *
 * Run with: npm run audit:links
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'src');
const pagesDir = path.join(srcDir, 'pages');

function getPageFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getPageFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

const pageFiles = getPageFiles(pagesDir);

/** route -> rendered source text (front matter included: ids live in the body). */
const routes = new Map();
for (const file of pageFiles) {
  const raw = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  const meta = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const route = (meta?.[1].match(/^route:\s*(.+)$/m)?.[1] || '/').trim();
  routes.set(route, raw);
}

const ids = new Map();
for (const [route, raw] of routes) {
  ids.set(route, new Set([...raw.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

const sources = [
  ...pageFiles.map((f) => path.join(pagesDir, f)),
  path.join(srcDir, 'partials', 'header.html'),
  path.join(srcDir, 'partials', 'footer.html')
];

const normalize = (route) => (route.endsWith('/') ? route : `${route}/`);

const problems = [];
let checked = 0;

for (const file of sources) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    // External, mail, phone and pure-fragment links are out of scope.
    if (/^(https?:|mailto:|tel:|#|\/assets\/)/.test(href)) continue;

    const [rawPathWithQuery, fragment] = href.split('#');
    const rawPath = rawPathWithQuery.split('?')[0];
    if (!rawPath.startsWith('/')) continue;

    const route = normalize(rawPath);
    checked += 1;

    const where = `${path.basename(file)} -> ${href}`;
    if (!routes.has(route)) {
      problems.push(`missing route: ${where}`);
      continue;
    }
    if (fragment && !ids.get(route).has(fragment)) {
      problems.push(`missing anchor: ${where}`);
    }
  }
}

if (problems.length) {
  console.error(`Link audit failed (${checked} internal links):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(`Link audit passed: ${checked} internal links, ${routes.size} routes, 0 missing targets.`);
