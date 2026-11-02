#!/usr/bin/env node
/**
 * Static site builder.
 *
 * Assembles src/pages/*.html into the route tree at the repository root using
 * src/templates/base.html, src/partials/header.html and src/partials/footer.html.
 *
 * Each page declares its own metadata in a small front-matter block:
 *
 *   ---
 *   title: Pricing
 *   description: ...
 *   route: /pricing/
 *   nav: pricing
 *   ---
 *
 * Run with: npm run build
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'src');
const pagesDir = path.join(srcDir, 'pages');

const read = (p) => fs.readFileSync(p, 'utf8');

const templates = {
  base: read(path.join(srcDir, 'templates', 'base.html')),
  standalone: read(path.join(srcDir, 'templates', 'standalone.html'))
};
const header = read(path.join(srcDir, 'partials', 'header.html'));
const footer = read(path.join(srcDir, 'partials', 'footer.html'));

const SITE = 'https://quantalflow.com';

/**
 * Asset URLs get a content hash so a changed file is always re-fetched,
 * even if a browser or proxy cached the previous copy.
 */
const ASSETS = [
  '/assets/css/styles.css',
  '/assets/css/pages.css',
  '/assets/css/project-planning.css',
  '/assets/js/save-state.js',
  '/assets/js/main.js',
  '/assets/js/login.js',
  '/assets/js/dashboard.js',
  '/assets/js/app.js',
  '/assets/js/wbs-tree-diagram.js',
  '/assets/js/project-planning.js',
  '/assets/js/profile.js',
  '/assets/img/logo.png',
  '/assets/img/favicon.ico',
  '/assets/img/favicon.png',
  '/assets/img/favicon-192.png',
  '/assets/img/apple-touch-icon.png'
];

const assetVersions = {};
for (const asset of ASSETS) {
  const file = path.join(root, asset);
  if (!fs.existsSync(file)) continue;
  const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  assetVersions[asset] = hash;
}

function versionAssets(html) {
  let out = html;
  for (const [asset, hash] of Object.entries(assetVersions)) {
    out = out.split(asset).join(`${asset}?v=${hash}`);
  }
  return out;
}

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error('Missing front matter');

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return { meta, body: raw.slice(match[0].length) };
}

/** Mark the current section in the header so it can be styled as active. */
function applyActiveNav(html, nav) {
  if (!nav) return html;
  return html.replace(
    new RegExp(`(<[a-z]+[^>]*data-nav="${nav}"[^>]*)>`),
    '$1 aria-current="page">'
  );
}

function render(page) {
  const { meta, body } = parseFrontMatter(read(path.join(pagesDir, page)));
  const route = meta.route || '/';
  const layout = meta.layout || 'base';

  const template = templates[layout];
  if (!template) throw new Error(`Unknown layout "${layout}" in ${page}`);

  let html = template;

  if (layout === 'base') {
    html = html
      .replace('{{HEADER}}', applyActiveNav(header, meta.nav))
      .replace('{{CONTENT}}', body.trimEnd())
      .replace('{{FOOTER}}', footer);
  } else {
    html = html
      .replace('{{CONTENT}}', body.trimEnd())
      .replace('{{SCRIPTS}}', (meta.scripts || '').split(',').filter(Boolean)
        .map((s) => `<script src="${s.trim()}"></script>`)
        .join('\n  '));
  }

  html = html
    .replace(/\{\{TITLE\}\}/g, meta.title || 'QuantalFlow')
    .replace(/\{\{DESCRIPTION\}\}/g, meta.description || '')
    .replace(/\{\{CANONICAL\}\}/g, SITE + route)
    .replace(/\{\{BODY_CLASS\}\}/g, meta.body_class || '');

    html = versionAssets(html);

    if (/\{\{[A-Z_]+\}\}/.test(html)) {
      const leftover = html.match(/\{\{[A-Z_]+\}\}/g).join(', ');
      throw new Error(`Unreplaced placeholder(s) in ${page}: ${leftover}`);
    }

  return { route, html, meta };
}

/** /pricing/ -> pricing/index.html ; / -> index.html */
function outputPath(route) {
  const clean = route.replace(/^\/+|\/+$/g, '');
  return clean ? path.join(root, clean, 'index.html') : path.join(root, 'index.html');
}

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

const pages = getPageFiles(pagesDir).sort();
const written = [];

for (const page of pages) {
  const { route, html, meta } = render(page);
  const out = outputPath(route);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
  written.push({ route, out: path.relative(root, out), bytes: Buffer.byteLength(html) });
}

// sitemap.xml — the 404 route is served on demand, so it stays out of the index.
const urls = written
  .filter((w) => w.route !== '/404/')
  .map((w) => `  <url><loc>${SITE}${w.route}</loc><changefreq>weekly</changefreq></url>`)
  .join('\n');
fs.writeFileSync(
  path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  'utf8'
);

// robots.txt
fs.writeFileSync(
  path.join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`,
  'utf8'
);

const pad = Math.max(...written.map((w) => w.out.length));
console.log(`Built ${written.length} pages:`);
for (const w of written) {
  console.log(`  ${w.out.padEnd(pad)}  ${String(w.bytes).padStart(7)} bytes  ${w.route}`);
}
