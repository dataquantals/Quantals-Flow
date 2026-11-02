import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { purgeExpiredSessions } from './db.js';
import { getSessionUser } from './auth.js';
import { createApi } from './routes.js';
import {
  sendJson,
  sendFile,
  resolveStaticPath,
  createRateLimiter,
  getClientIp,
  parseCookies
} from './http.js';

const limiter = createRateLimiter(config.rateLimit);
const api = createApi(limiter);

// Branded 404 rendered by the static build (src/pages/404.html).
const notFoundPage = path.join(config.root, '404', 'index.html');
const appShellPage = path.join(config.root, 'app', 'index.html');
const dashboardShellPage = path.join(config.root, 'dashboard', 'index.html');

// Hierarchical SPA sub-route patterns:
// 1) /app/<boardSlug>/<boardCode>[/<template>] or /app/<boardId>[/<template>]
const APP_NESTED_ROUTE_RE = /^\/app\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+){0,2}\/?$/;
// 2) /dashboard/starred, /dashboard/recent, /dashboard/space/<spaceSlug>
const DASHBOARD_NESTED_ROUTE_RE = /^\/dashboard\/(?:starred|recent|space\/[a-zA-Z0-9_-]+)\/?$/;

// Sweep expired sessions hourly so the table does not grow without bound.
setInterval(() => {
  purgeExpiredSessions();
  limiter.prune();
}, 1000 * 60 * 60).unref();

/** Reject cross-site state-changing requests. */
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin form posts and curl send no Origin

  if (config.origin) return origin === config.origin;

  try {
    const url = new URL(origin);
    const host = req.headers.host;
    return url.host === host;
  } catch {
    return false;
  }
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

// Signed-in-only routes. The dashboard shell renders nothing without a
// session, so gate it here rather than letting the page flash and bounce.
const protectedRoutes = ['/dashboard', '/profile'];

function isProtected(pathname) {
  return protectedRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  for (const [key, value] of Object.entries(securityHeaders())) res.setHeader(key, value);

  try {
    // ---------- API ----------
    if (pathname.startsWith('/api/')) {
      if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && !originAllowed(req)) {
        return sendJson(res, 403, { error: 'Cross-origin request blocked.' });
      }

      if (pathname === '/api/auth/register' && req.method === 'POST') return api.register(req, res);
      if (pathname === '/api/auth/login' && req.method === 'POST') return api.login(req, res);
      if (pathname === '/api/auth/logout' && req.method === 'POST') return api.logout(req, res);
      if (pathname === '/api/auth/me' && req.method === 'GET') return api.me(req, res);
      if (pathname === '/api/auth/me' && req.method === 'PATCH') return api.updateMe(req, res);
      if (pathname === '/api/profile/avatar' && req.method === 'POST') return api.uploadAvatar(req, res);
      if (pathname === '/api/profile/avatar' && req.method === 'DELETE') return api.removeAvatar(req, res);
      if (pathname === '/api/profile/avatar-upload-url' && req.method === 'POST') return api.avatarUploadUrl(req, res);
      if (pathname === '/api/auth/change-password' && req.method === 'POST') return api.changePassword(req, res);
      if (pathname === '/api/auth/config' && req.method === 'GET') return api.authConfig(req, res);
      if (pathname === '/api/auth/clerk-sync' && req.method === 'POST') return api.clerkSync(req, res);
      if (pathname === '/api/convex/status' && req.method === 'GET') return api.convexStatus(req, res);
      if (pathname === '/api/ai/generate' && req.method === 'POST') return api.generateAi(req, res);

      if (pathname === '/api/boards' && req.method === 'GET') return api.listBoardsApi(req, res);
      if (pathname === '/api/boards' && req.method === 'POST') return api.createBoardApi(req, res);

      const boardMatch = pathname.match(/^\/api\/boards\/([^/]+)$/);
      if (boardMatch) {
        const boardId = decodeURIComponent(boardMatch[1]);
        if (req.method === 'GET') return api.getBoardApi(req, res, boardId);
        if (req.method === 'PUT') return api.updateBoardApi(req, res, boardId);
        if (req.method === 'DELETE') return api.deleteBoardApi(req, res, boardId);
      }

      const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch) {
        const boardId = decodeURIComponent(projectMatch[1]);
        if (req.method === 'GET') return api.getProjectPlanApi(req, res, boardId);
        if (req.method === 'PUT') return api.saveProjectPlanApi(req, res, boardId);
        if (req.method === 'DELETE') return api.deleteProjectPlanApi(req, res, boardId);
      }

      return sendJson(res, 404, { error: 'Not found.' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    // ---------- Signed-in-only navigation ----------
    // A 302 keeps the URL honest (deep link survives the round trip via
    // ?next=) and spares unauthenticated visitors the shell-then-bounce flash.
    if (isProtected(pathname)) {
      const user = getSessionUser(parseCookies(req)[config.session.cookie]);
      if (!user) {
        const next = pathname.endsWith('/') ? pathname : pathname + '/';
        res.writeHead(302, {
          Location: `/login/?next=${encodeURIComponent(next)}`,
          'Cache-Control': 'no-store'
        });
        return res.end();
      }
    }

    // ---------- Static ----------
    let target = resolveStaticPath(pathname);
    if (!target) return sendJson(res, 400, { error: 'Bad request.' });

    const isDir = fs.existsSync(target) && fs.statSync(target).isDirectory();

    // Canonicalise directory routes to a trailing slash so relative links resolve.
    if (isDir && !pathname.endsWith('/')) {
      res.writeHead(301, { Location: pathname + '/' });
      return res.end();
    }

    if (isDir) target = path.join(target, 'index.html');

    // Never serve the database or server/build source through the static handler.
    const blocked = [
      config.dataDir,
      path.join(config.root, 'server'),
      path.join(config.root, 'src'),
      path.join(config.root, 'convex'),
      path.join(config.root, '.clerk')
    ];
    if (blocked.some((dir) => target === dir || target.startsWith(dir + path.sep))) {
      return sendJson(res, 404, { error: 'Not found.' });
    }

    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      // Hierarchical nested routes for /app/... and /dashboard/...
      const isNavigation = !path.extname(pathname);
      if (isNavigation && APP_NESTED_ROUTE_RE.test(pathname) && fs.existsSync(appShellPage)) {
        return sendFile(res, appShellPage);
      }
      if (isNavigation && DASHBOARD_NESTED_ROUTE_RE.test(pathname) && fs.existsSync(dashboardShellPage)) {
        return sendFile(res, dashboardShellPage);
      }

      // Unknown route: for navigations serve the branded 404 page with a real
      // 404 status, so deep links never dead-end on a JSON error. Asset paths
      // (anything with an extension) keep the plain JSON response.
      if (isNavigation && fs.existsSync(notFoundPage)) {
        const body = fs.readFileSync(notFoundPage);
        res.writeHead(404, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': body.length,
          'Cache-Control': 'no-store'
        });
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      return sendJson(res, 404, { error: 'Not found.' });
    }

    // Conditional GET: if the client's copy is current, skip the body.
    const stat = fs.statSync(target);
    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
      return res.end();
    }

    return sendFile(res, target);
  } catch (err) {
    console.error('[error]', req.method, pathname, '-', err.message);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: 'Internal server error.' });
    else res.end();
  }
});

server.listen(config.port, config.host, () => {
  const { port } = server.address();
  console.log(`QuantalFlow clone running at http://localhost:${port}`);
  console.log(`  database: ${config.dbFile}`);
  console.log(`  convex:   ${config.convex.cloudUrl}`);
});

export { server };
