/**
 * Vercel serverless entry point for /api/*.
 *
 * Why this file exists at `api/router.js` instead of `api/[...path].js`:
 * Vercel's zero-config `api/` router (non-Next.js projects) maps each file to a
 * literal route. `api/[...path].js` became `/api/[...path]` — catch-all bracket
 * filenames are a Next.js convention, not a plain-Vercel one — so every real
 * `/api/auth/*` call fell through to the platform 404 while the static site in
 * `public/` kept working.
 *
 * `vercel.json` now rewrites `/api/:path*` to `/api/router/:path*`, which keeps
 * the original query string intact. `handleApi` strips the `/api/router` prefix
 * before routing. Body parsing is left to the handler (`server/http.js` reads
 * the raw stream), so canvas/plan documents and avatar uploads pass through
 * byte-for-byte.
 */
import { handleApi } from '../server/index.js';

export default async function handler(req, res) {
  return handleApi(req, res);
}
