#!/usr/bin/env node
/**
 * Reliable Convex CLI wrapper for QuantalFlow (`dev:agreeable-starfish-202`).
 *
 * Root causes this solves:
 * 1. Fresh checkouts have no gitignored `.env.local` / `.env.convex-dev`, causing
 *    `npx convex dev` / `npm run convex:push` to fail with missing file or
 *    `No CONVEX_DEPLOYMENT set`.
 * 2. If `CONVEX_DEPLOY_KEY` is present in the environment, `convex dev` refuses
 *    to run ("Use `npx convex deploy`..."). Stripping `CONVEX_DEPLOY_KEY` for
 *    `dev` runs lets a single `.env.local` serve both the Node server and Convex CLI.
 * 3. Invoking `convex/bin/main.js` directly via `process.execPath` avoids Windows
 *    `.cmd` / Node 24 `--env-file` flag collisions.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DEPLOYMENT = 'dev:agreeable-starfish-202';

for (const envName of ['.env.local', '.env', '.env.convex-dev']) {
  const envPath = path.join(root, envName);
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* ignore malformed env file */
    }
  }
}

const env = { ...process.env };
// `convex dev` rejects preview/prod deploy keys; strip for dev sync/watch commands.
delete env.CONVEX_DEPLOY_KEY;
if (!env.CONVEX_DEPLOYMENT) {
  env.CONVEX_DEPLOYMENT = DEFAULT_DEPLOYMENT;
}
// Keep Convex CLI temp dir on the same drive (`G:`) as `convex/_generated` to
// prevent cross-filesystem (`C:` <-> `G:`) atomic rename / watcher failures.
if (!env.CONVEX_TMPDIR) {
  const sameDriveTmp = path.join(root, 'node_modules', '.cache', 'convex-tmp');
  fs.mkdirSync(sameDriveTmp, { recursive: true });
  env.CONVEX_TMPDIR = sameDriveTmp;
}

const rawArgs = process.argv.slice(2);
const watchMode = rawArgs.includes('--watch');
const passthrough = rawArgs.filter((a) => a !== '--watch');
const convexBin = path.join(root, 'node_modules', 'convex', 'bin', 'main.js');

if (!fs.existsSync(convexBin)) {
  console.error('[convex] Missing node_modules/convex/bin/main.js — run `npm install` first.');
  process.exit(1);
}

const cliArgs = watchMode
  ? [convexBin, 'dev', ...passthrough]
  : [convexBin, 'dev', '--once', ...passthrough];

console.log(`[convex] Target deployment: ${env.CONVEX_DEPLOYMENT}`);
const result = spawnSync(process.execPath, cliArgs, {
  cwd: root,
  env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
