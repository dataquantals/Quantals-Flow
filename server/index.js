import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { purgeExpiredSessions } from './db.js';
import { getSessionUser, getSessionUserWithConvexFallback, extractSessionToken } from './auth.js';
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
// 2) /dashboard/starred, /dashboard/recent, /dashboard/files, /dashboard/team, /dashboard/space/<spaceSlug>
const DASHBOARD_NESTED_ROUTE_RE = /^\/dashboard\/(?:starred|recent|files|team|space\/[a-zA-Z0-9_-]+)\/?$/;
// 3) Dedicated child workspace pages mounted hierarchically under /dashboard/<child>/
const DASHBOARD_CHILD_PAGES = {
  notepad: path.join(config.root, 'notepad', 'index.html'),
  quotation: path.join(config.root, 'quotation', 'index.html'),
  invoice: path.join(config.root, 'invoice', 'index.html'),
  receipt: path.join(config.root, 'receipt', 'index.html'),
  knowledge: path.join(config.root, 'knowledge', 'index.html'),
  documents: path.join(config.root, 'documents', 'index.html'),
  os: path.join(config.root, 'documents', 'index.html'),
  leaf: path.join(config.root, 'leaf', 'index.html'),
  crm: path.join(config.root, 'crm', 'index.html'),
  activity: path.join(config.root, 'activity', 'index.html'),
  people: path.join(config.root, 'people', 'index.html'),
  memory: path.join(config.root, 'memory', 'index.html'),
  templates: path.join(config.root, 'resources', 'templates', 'index.html')
};

// Sweep expired sessions hourly so the table does not grow without bound.
if (!process.env.VERCEL) {
  setInterval(() => {
    purgeExpiredSessions();
    limiter.prune();
  }, 1000 * 60 * 60).unref();
}

/** Reject cross-site state-changing requests. */
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin form posts and curl send no Origin

  try {
    const url = new URL(origin);
    const forwardedHost = String(req.headers['x-forwarded-host'] || '')
      .split(',')[0]
      .trim();
    const directHost = String(req.headers.host || '').trim();
    if ((forwardedHost && url.host === forwardedHost) || (directHost && url.host === directHost)) {
      return true;
    }
    if (config.origin) {
      return origin.replace(/\/+$/, '') === String(config.origin).replace(/\/+$/, '');
    }
    return false;
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

/** Vercel rewrite target: `/api/:path*` -> `/api/router/:path*` (see vercel.json). */
const API_ROUTER_PREFIX = '/api/router';

/** Path captured by a query-based rewrite (`/api/(.*)` -> `/api?__api_path=$1`). */
function rewrittenApiPath(req, urlObj) {
  let raw = req.query && req.query.__api_path;
  if ((raw === undefined || raw === null) && urlObj) {
    raw = urlObj.searchParams.get('__api_path');
  }
  if (raw === undefined || raw === null) return null;
  const value = Array.isArray(raw) ? raw.join('/') : String(raw);
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    /* keep the raw value when it is not valid percent-encoding */
  }
  return decoded.replace(/^\/+/, '');
}

export async function handleApi(req, res) {
  const host =
    String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() ||
    req.headers.host ||
    'localhost';
  let rawPathname = req.url;
  let urlObj = null;
  try {
    urlObj = new URL(req.url, `http://${host}`);
    rawPathname = urlObj.pathname;
  } catch {}

  // A rewrite onto a single function hides the real sub-path. Vercel routes
  // /api/boards to /api/router/boards, so drop the router prefix first.
  const forwarded = rewrittenApiPath(req, urlObj);
  if (forwarded !== null) {
    rawPathname = forwarded ? `/api/${forwarded}` : '/api';
  } else if (rawPathname === API_ROUTER_PREFIX || rawPathname.startsWith(`${API_ROUTER_PREFIX}/`)) {
    const tail = rawPathname.slice(API_ROUTER_PREFIX.length).replace(/^\/+/, '');
    rawPathname = tail ? `/api/${tail}` : '/api';
  } else if (!rawPathname.startsWith('/api/')) {
    if (req.query && req.query.path) {
      const parts = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
      rawPathname = '/api/' + parts.join('/');
    } else {
      rawPathname = '/api' + (rawPathname.startsWith('/') ? rawPathname : '/' + rawPathname);
    }
  }
  const pathname = rawPathname.replace(/\/+$/, '');

  for (const [key, value] of Object.entries(securityHeaders())) res.setHeader(key, value);

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
  if (pathname === '/api/ai/status' && req.method === 'GET') return api.aiStatusApi(req, res);
  if (pathname === '/api/admin/users' && req.method === 'GET') return api.adminUsers(req, res);
  if (pathname === '/api/admin/system-stats' && req.method === 'GET') return api.adminSystemStats(req, res);

  if (pathname === '/api/workspace/members' && req.method === 'GET') return api.listWorkspaceMembersApi(req, res);
  if (pathname === '/api/workspace/invitations' && req.method === 'POST') return api.inviteWorkspaceMembersApi(req, res);
  const wsMemberMatch = pathname.match(/^\/api\/workspace\/members\/([^/]+)$/);
  if (wsMemberMatch) {
    const memberId = decodeURIComponent(wsMemberMatch[1]);
    if (req.method === 'PATCH' || req.method === 'PUT') return api.updateWorkspaceMemberApi(req, res, memberId);
    if (req.method === 'DELETE') return api.removeWorkspaceMemberApi(req, res, memberId);
  }

  if (pathname === '/api/boards' && req.method === 'GET') return api.listBoardsApi(req, res);
  if (pathname === '/api/boards' && req.method === 'POST') return api.createBoardApi(req, res);

  const boardMemberItemMatch = pathname.match(/^\/api\/boards\/([^/]+)\/members\/([^/]+)$/);
  if (boardMemberItemMatch) {
    const boardId = decodeURIComponent(boardMemberItemMatch[1]);
    const memberId = decodeURIComponent(boardMemberItemMatch[2]);
    if (req.method === 'PATCH' || req.method === 'PUT') return api.updateBoardMemberApi(req, res, boardId, memberId);
    if (req.method === 'DELETE') return api.removeBoardMemberApi(req, res, boardId, memberId);
  }

  const boardSubMatch = pathname.match(/^\/api\/boards\/([^/]+)\/(members|invitations|access)$/);
  if (boardSubMatch) {
    const boardId = decodeURIComponent(boardSubMatch[1]);
    const sub = boardSubMatch[2];
    if (sub === 'members' && req.method === 'GET') return api.listBoardMembersApi(req, res, boardId);
    if (sub === 'invitations' && req.method === 'POST') return api.inviteBoardMembersApi(req, res, boardId);
    if (sub === 'access' && req.method === 'GET') return api.getBoardAccessApi(req, res, boardId);
  }

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

  if (pathname === '/api/files' && req.method === 'GET') return api.listFilesApi(req, res);
  if (pathname === '/api/files' && req.method === 'POST') return api.saveFileApi(req, res);
  if (pathname === '/api/files/save' && req.method === 'POST') return api.saveFileApi(req, res);
  if (pathname === '/api/files/upload' && req.method === 'POST') return api.uploadFileApi(req, res);
  if (pathname === '/api/files/signature' && req.method === 'POST') return api.fileSignatureApi(req, res);
  if (pathname === '/api/files/order' && req.method === 'GET') return api.getFileOrderApi(req, res);
  if (pathname === '/api/files/order' && req.method === 'PUT') return api.saveFileOrderApi(req, res);
  if (pathname === '/api/quotation' && req.method === 'GET') return api.getQuotationApi(req, res);
  if (pathname === '/api/quotation' && req.method === 'PUT') return api.saveQuotationApi(req, res);
  if (pathname === '/api/quotation/logo' && req.method === 'POST') return api.uploadQuotationLogoApi(req, res);
  if (pathname === '/api/invoice' && req.method === 'GET') return api.getInvoiceApi(req, res);
  if (pathname === '/api/invoice' && req.method === 'PUT') return api.saveInvoiceApi(req, res);
  if (pathname === '/api/invoice/logo' && req.method === 'POST') return api.uploadInvoiceLogoApi(req, res);
  if (pathname === '/api/receipt' && req.method === 'GET') return api.getReceiptApi(req, res);
  if (pathname === '/api/receipt' && req.method === 'PUT') return api.saveReceiptApi(req, res);
  if (pathname === '/api/receipt/logo' && req.method === 'POST') return api.uploadReceiptLogoApi(req, res);
  if (pathname === '/api/notepad' && req.method === 'GET') return api.getNotepadApi(req, res);
  if (pathname === '/api/notepad' && req.method === 'PUT') return api.saveNotepadApi(req, res);
  if (pathname === '/api/knowledge' && req.method === 'GET') return api.getKnowledgeHubApi(req, res);
  if (pathname === '/api/knowledge' && req.method === 'PUT') return api.saveKnowledgeHubApi(req, res);
  if (pathname === '/api/os' && req.method === 'GET') return api.getOsWorkspaceApi(req, res);
  if (pathname === '/api/os' && req.method === 'PUT') return api.saveOsWorkspaceApi(req, res);
  if (pathname === '/api/leaf' && req.method === 'GET') return api.getLeafApi(req, res);
  if (pathname === '/api/leaf' && req.method === 'PUT') return api.saveLeafApi(req, res);
  if (pathname === '/api/leaf/image' && req.method === 'POST') return api.uploadLeafImageApi(req, res);
  if (pathname === '/api/crm' && req.method === 'GET') return api.getCrmApi(req, res);
  if (pathname === '/api/crm' && req.method === 'PUT') return api.saveCrmApi(req, res);
  if (pathname === '/api/redis/status' && req.method === 'GET') return api.redisStatusApi(req, res);
  if (pathname === '/api/redis/search' && req.method === 'GET') return api.redisSearchApi(req, res);
  if (pathname === '/api/activity' && req.method === 'GET') return api.listActivityApi(req, res);
  if (pathname === '/api/activity/export' && req.method === 'GET') return api.exportActivityCsvApi(req, res);
  const activityDetailMatch = pathname.match(/^\/api\/activity\/([^/]+)$/);
  if (activityDetailMatch && req.method === 'GET') {
    return api.getActivityDetailApi(req, res, decodeURIComponent(activityDetailMatch[1]));
  }

  /* ---- Multi-Tenant Clerk Organisations & People & Teams API ---- */
  if (pathname === '/api/orgs' && req.method === 'GET') return api.listOrgsApi(req, res);
  if (pathname === '/api/orgs' && req.method === 'POST') return api.createOrgApi(req, res);
  if (pathname === '/api/orgs/switch' && req.method === 'POST') return api.switchOrgApi(req, res);
  if (pathname === '/api/orgs/current' && req.method === 'PATCH') return api.updateCurrentOrgApi(req, res);
  if (pathname === '/api/orgs/current' && req.method === 'DELETE') return api.deleteCurrentOrgApi(req, res);
  if (pathname === '/api/orgs/current/directory' && req.method === 'GET') return api.getOrgDirectoryApi(req, res);
  if (pathname === '/api/orgs/current/experts' && req.method === 'GET') return api.searchOrgExpertsApi(req, res);
  if (pathname === '/api/orgs/current/departments' && req.method === 'POST') return api.createOrgDepartmentApi(req, res);
  const orgDeptMatch = pathname.match(/^\/api\/orgs\/current\/departments\/([^/]+)$/);
  if (orgDeptMatch && req.method === 'DELETE') return api.deleteOrgDepartmentApi(req, res, decodeURIComponent(orgDeptMatch[1]));
  if (pathname === '/api/orgs/current/teams' && req.method === 'POST') return api.createOrgTeamApi(req, res);
  const orgTeamMatch = pathname.match(/^\/api\/orgs\/current\/teams\/([^/]+)$/);
  if (orgTeamMatch && req.method === 'DELETE') return api.deleteOrgTeamApi(req, res, decodeURIComponent(orgTeamMatch[1]));
  if (pathname === '/api/orgs/current/invitations' && req.method === 'POST') return api.createOrgInvitationApi(req, res);
  const orgMemMatch = pathname.match(/^\/api\/orgs\/current\/members\/([^/]+)$/);
  if (orgMemMatch) {
    const uid = decodeURIComponent(orgMemMatch[1]);
    if (req.method === 'PATCH') return api.updateOrgMemberApi(req, res, uid);
    if (req.method === 'DELETE') return api.removeOrgMemberApi(req, res, uid);
  }
  if (pathname === '/api/orgs/current/memory' && req.method === 'POST') return api.addOrgMemoryApi(req, res);

  /* ---- Organisational Memory Engine API ---- */
  if (pathname === '/api/memory' && req.method === 'GET') return api.listMemoryApi(req, res);
  if (pathname === '/api/memory' && req.method === 'POST') return api.createMemoryApi(req, res);
  if (pathname === '/api/memory/synthesize' && req.method === 'POST') return api.synthesizeMemoryApi(req, res);
  if (pathname === '/api/memory/ask' && req.method === 'POST') return api.askMemoryAssistantApi(req, res);
  if (pathname === '/api/memory/settings' && req.method === 'GET') return api.getMemorySettingsApi(req, res);
  if (pathname === '/api/memory/settings' && req.method === 'PATCH') return api.updateMemorySettingsApi(req, res);
  const memoryItemMatch = pathname.match(/^\/api\/memory\/([^/]+)$/);
  if (memoryItemMatch) {
    const mid = decodeURIComponent(memoryItemMatch[1]);
    if (req.method === 'GET') return api.getMemoryDetailApi(req, res, mid);
    if (req.method === 'PATCH') return api.updateMemoryApi(req, res, mid);
    if (req.method === 'DELETE') return api.deleteMemoryApi(req, res, mid);
  }
  if (pathname === '/api/leads' && req.method === 'POST') return api.createLeadApi(req, res);
  if (pathname === '/api/documents/generate' && req.method === 'POST') return api.generateDocumentApi(req, res);
  if (pathname === '/api/documents/ai-edit' && req.method === 'POST') return api.aiEditDocumentApi(req, res);
  if (pathname === '/api/documents/export' && req.method === 'POST') return api.exportDocumentApi(req, res);
  if (pathname === '/api/preferences' && req.method === 'GET') return api.getPreferencesApi(req, res);
  if (pathname === '/api/preferences' && (req.method === 'PATCH' || req.method === 'PUT')) {
    return api.savePreferencesApi(req, res);
  }

  const fileActionMatch = pathname.match(/^\/api\/files\/([^/]+)\/(content|move|delete)$/);
  if (fileActionMatch) {
    const fileId = decodeURIComponent(fileActionMatch[1]);
    const action = fileActionMatch[2];
    if (action === 'content' && req.method === 'GET') return api.getFileContentApi(req, res, fileId);
    if (action === 'move' && req.method === 'POST') return api.moveFileApi(req, res, fileId);
    if (action === 'delete' && req.method === 'POST') return api.deleteFileApi(req, res, fileId);
  }

  const fileMatch = pathname.match(/^\/api\/files\/([^/]+)$/);
  if (fileMatch) {
    const fileId = decodeURIComponent(fileMatch[1]);
    if (req.method === 'DELETE') return api.deleteFileApi(req, res, fileId);
  }

  if (pathname === '/api/folders' && req.method === 'GET') return api.listFoldersApi(req, res);
  if (pathname === '/api/folders' && req.method === 'POST') return api.saveFolderApi(req, res);

  const folderDeleteMatch = pathname.match(/^\/api\/folders\/([^/]+)\/delete$/);
  if (folderDeleteMatch && req.method === 'POST') {
    return api.deleteFolderApi(req, res, decodeURIComponent(folderDeleteMatch[1]));
  }

  return sendJson(res, 404, { error: 'Not found.' });
}

// Signed-in-only routes. The dashboard shell renders nothing without a
// session, so gate it here rather than letting the page flash and bounce.
const protectedRoutes = ['/dashboard', '/profile', '/files', '/quotation', '/invoice', '/receipt', '/notepad', '/knowledge', '/documents', '/os', '/leaf', '/crm', '/activity', '/people', '/memory', '/onboarding'];

function isProtected(pathname) {
  return protectedRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'));
}

const server = http.createServer(async (req, res) => {
  const { pathname: rawPathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  // Pages normalise to a trailing slash (/pricing/), but the API router matches
  // exact paths. Vercel's trailingSlash setting and hand-typed URLs both deliver
  // /api/auth/me/ â€” strip it so that becomes a 401/200 instead of a 404.
  const pathname = (rawPathname === '/api' || rawPathname.startsWith('/api/')) ? rawPathname.replace(/\/+$/, '') : rawPathname;

  for (const [key, value] of Object.entries(securityHeaders())) res.setHeader(key, value);

  try {
    // ---------- API ----------
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return handleApi(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    // ---------- Signed-in-only navigation ----------
    // A 302 keeps the URL honest (deep link survives the round trip via
    // ?next=) and spares unauthenticated visitors the shell-then-bounce flash.
    if (isProtected(pathname)) {
      const user = await getSessionUserWithConvexFallback(extractSessionToken(req));
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
      // Dedicated child modules under /dashboard/<module>/
      const dashChildMatch = isNavigation && pathname.match(/^\/dashboard\/(notepad|quotation|invoice|receipt|knowledge|documents|os|leaf|crm|activity|people|memory|templates)(\/)?$/);
      if (dashChildMatch) {
        const childKey = dashChildMatch[1];
        const childFile = DASHBOARD_CHILD_PAGES[childKey];
        if (childFile && fs.existsSync(childFile)) {
          if (!dashChildMatch[2]) {
            res.writeHead(301, { Location: `/dashboard/${childKey}/` });
            return res.end();
          }
          return sendFile(res, childFile);
        }
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

if (!process.env.VERCEL) {
  server.listen(config.port, config.host, () => {
    const { port } = server.address();
    console.log(`QuantalFlow clone running at http://localhost:${port}`);
    console.log(`  database: ${config.dbFile}`);
    console.log(`  convex:   ${config.convex.cloudUrl}`);
  });
}

export { server };
