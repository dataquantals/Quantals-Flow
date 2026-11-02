import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const MAX_BODY_BYTES = 16 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB limit for profile images

/** Read a raw request body buffer, rejecting anything exceeding maxBytes. */
export function readBuffer(req, maxBytes = MAX_IMAGE_BYTES) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > maxBytes) {
      req.resume();
      return reject(Object.assign(new Error('File size exceeds the 5MB limit. Please upload an image 5MB or below.'), { status: 413 }));
    }

    let size = 0;
    let exceeded = false;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        exceeded = true;
        req.resume();
        return;
      }
      if (!exceeded) {
        chunks.push(chunk);
      }
    });

    req.on('end', () => {
      if (exceeded) {
        return reject(Object.assign(new Error('File size exceeds the 5MB limit. Please upload an image 5MB or below.'), { status: 413 }));
      }
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

/** Read and JSON-parse a request body, rejecting anything oversized. */
export function readJson(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(Object.assign(new Error('Expected a JSON object'), { status: 400 }));
        }
        resolve(parsed);
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });

    req.on('error', reject);
  });
}

export function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;

  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function buildSessionCookie(token) {
  const maxAge = Math.floor(config.session.ttlMs / 1000);
  const parts = [
    `${config.session.cookie}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`
  ];
  if (config.isProduction) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie() {
  return `${config.session.cookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

/**
 * Resolve a URL path to a file inside publicDir.
 * Returns null when the path escapes the root or is not a regular file.
 */
export function resolveStaticPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }

  // Reject NUL bytes and anything that tries to walk up the tree.
  if (decoded.includes('\0')) return null;

  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(config.publicDir, relative);
  const rootWithSep = config.publicDir.endsWith(path.sep)
    ? config.publicDir
    : config.publicDir + path.sep;

  if (candidate !== config.publicDir && !candidate.startsWith(rootWithSep)) return null;

  return candidate;
}

export function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);

  // A weak ETag derived from size and mtime. Enough to detect edits without
  // hashing the file on every request.
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;

  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', stat.mtime.toUTCString());
  // Revalidate every time: cheap 304s, and edits always show up.
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', stat.size);

  res.writeHead(200);
  fs.createReadStream(filePath).pipe(res);
}

export function getClientIp(req) {
  return req.socket?.remoteAddress || 'unknown';
}

/** Simple in-memory fixed-window rate limiter. */
export function createRateLimiter({ windowMs, maxAttempts }) {
  const hits = new Map();

  return {
    check(key) {
      const now = Date.now();
      const entry = hits.get(key);

      if (!entry || now > entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
      }

      if (entry.count >= maxAttempts) {
        return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
      }

      entry.count += 1;
      return { allowed: true, remaining: maxAttempts - entry.count, retryAfterMs: 0 };
    },
    reset(key) {
      hits.delete(key);
    },
    prune(now = Date.now()) {
      for (const [key, entry] of hits) {
        if (now > entry.resetAt) hits.delete(key);
      }
    }
  };
}
