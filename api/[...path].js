/**
 * Vercel serverless proxy for /api/*.
 *
 * Vercel serves the built site as static files, so the Node API in `server/`
 * is not part of that deployment. This function forwards every /api/* request
 * to the API host named by `API_ORIGIN`, which keeps the browser on one origin
 * (so the HttpOnly session cookie still applies) and keeps the client code
 * unchanged — it still calls relative /api/... URLs.
 *
 * If `API_ORIGIN` is unset the function answers 503 with an explicit message
 * instead of letting the request fall through to a static 404.
 *
 * Only raw Node response methods are used (no framework helpers), so the same
 * handler runs under Vercel and under a plain http server when testing locally.
 * Body parsing is disabled so canvas/plan documents and avatar uploads stream
 * through byte-for-byte.
 */
export const config = {
  api: { bodyParser: false }
};

const TIMEOUT_MS = 55_000;
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
  'accept-encoding',
  'host'
]);

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/** Rebuild the upstream path from the catch-all segment + original query. */
function upstreamUrl(origin, req) {
  const queryAt = req.url.indexOf('?');
  const query = queryAt === -1 ? '' : req.url.slice(queryAt);
  const pathname = queryAt === -1 ? req.url : req.url.slice(0, queryAt);

  const raw = req.query && req.query.path;
  let segments;

  if (Array.isArray(raw)) {
    segments = raw.map(String);
  } else if (typeof raw === 'string' && raw) {
    segments = raw.split('/');
  } else {
    // Invoked outside Vercel (no req.query): strip the /api prefix ourselves.
    segments = pathname.split('/').filter(Boolean).map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
    if (segments[0] === 'api') segments = segments.slice(1);
  }

  // A trailing slash is a page convention, not an API one: `/api/auth/me/`
  // would miss the upstream router's exact match and surface as a 404.
  const path = segments.filter(Boolean).join('/').replace(/\/+$/, '');
  return `${origin}/api/${path}${query}`;
}

export default async function handler(req, res) {
  const origin = String(process.env.API_ORIGIN || '').trim().replace(/\/+$/, '');

  if (!origin) {
    sendJson(res, 503, {
      error: 'The API is not configured for this deployment. Set API_ORIGIN to the URL of the QuantalFlow Node server.'
    });
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || HOP_BY_HOP.has(key)) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    else headers.set(key, value);
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  const originalHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (originalHost) headers.set('x-forwarded-host', originalHost);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const init = {
      method: req.method,
      headers,
      redirect: 'manual',
      signal: controller.signal
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = req;
      init.duplex = 'half';
    }

    const upstream = await fetch(upstreamUrl(origin, req), init);
    const body = Buffer.from(await upstream.arrayBuffer());

    const outHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key) || key === 'set-cookie') return;
      outHeaders[key] = value;
    });

    const cookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];
    if (cookies.length) outHeaders['set-cookie'] = cookies;

    res.writeHead(upstream.status, outHeaders);
    res.end(body);
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    console.error('[api-proxy]', timedOut ? 'timeout' : 'failed', req.method, req.url, err && err.message);
    sendJson(res, timedOut ? 504 : 502, {
      error: timedOut
        ? 'The API took too long to respond. Please try again.'
        : 'The API is unreachable. Check API_ORIGIN.'
    });
  } finally {
    clearTimeout(timer);
  }
}
