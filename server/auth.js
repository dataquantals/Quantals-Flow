import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import { config } from './config.js';
import { parseCookies } from './http.js';
import {
  syncUserToConvex,
  createConvexSession,
  getConvexSession,
  removeConvexSession,
  removeConvexSessionsByUserId,
  getConvexUserByEmail
} from './convex.js';

const scrypt = promisify(crypto.scrypt);
const revokedTokens = new Set();

// scrypt parameters. N=16384 keeps a single hash around ~50ms on this machine,
// which is slow enough to make offline guessing expensive without hurting UX.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

function signingSecret() {
  return config.convex.syncSecret || 'quantalflow-default-hmac-secret';
}

function signTokenPayload(sid, payload) {
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const data = `${sid}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', signingSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySignedSessionToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [sid, payloadB64, sigB64] = parts;
    if (!sid || !payloadB64 || !sigB64) return null;
    const data = `${sid}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', signingSecret()).update(data).digest();
    const actualSig = Buffer.from(sigB64, 'base64url');
    if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (!payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractSessionToken(req) {
  const cookieToken = parseCookies(req)[config.session.cookie];
  if (cookieToken) return cookieToken;
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const headerToken = req.headers?.['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }
  return null;
}

/**
 * Hash a password with a random per-user salt.
 * Format: scrypt$N$r$p$<salt-b64url>$<hash-b64url>
 */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64url'),
    key.toString('base64url')
  ].join('$');
}

/**
 * Verify a password against a stored hash using a constant-time comparison.
 * Returns false for malformed hashes rather than throwing.
 */
export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');

    const actual = await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem
    });

    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function findUserByEmail(email) {
  return db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(normalizeEmail(email));
}

export function findUserById(id) {
  return db
    .prepare('SELECT id, email, name, role, title, company, bio, avatar_url, avatar_storage_id, created_at FROM users WHERE id = ?')
    .get(id);
}

/**
 * Ensure a user from Convex is present in local SQLite with their canonical ID.
 */
export function upsertLocalUserFromConvex(remoteUser, fallbackPasswordHash) {
  if (!remoteUser || !remoteUser.email) return null;
  const normalizedEmail = normalizeEmail(remoteUser.email);
  const existingByEmail = findUserByEmail(normalizedEmail);
  const preferredId = Number(remoteUser.externalId || remoteUser.userId);
  const passwordHash =
    remoteUser.passwordHash ||
    existingByEmail?.password_hash ||
    fallbackPasswordHash ||
    'scrypt$16384$8$1$AAAA$AAAA';

  if (existingByEmail) {
    db.prepare(`
      UPDATE users
      SET name = ?, role = ?, title = ?, company = ?, bio = ?, avatar_url = ?, avatar_storage_id = ?, password_hash = ?
      WHERE id = ?
    `).run(
      remoteUser.name || existingByEmail.name || normalizedEmail.split('@')[0],
      remoteUser.role || existingByEmail.role || 'member',
      remoteUser.title ?? existingByEmail.title ?? '',
      remoteUser.company ?? existingByEmail.company ?? '',
      remoteUser.bio ?? existingByEmail.bio ?? '',
      remoteUser.avatarUrl ?? remoteUser.avatar_url ?? existingByEmail.avatar_url ?? '',
      remoteUser.avatarStorageId ?? remoteUser.avatar_storage_id ?? existingByEmail.avatar_storage_id ?? '',
      passwordHash,
      existingByEmail.id
    );
    return findUserById(existingByEmail.id);
  }

  try {
    if (Number.isFinite(preferredId) && preferredId > 0) {
      const idTaken = findUserById(preferredId);
      if (!idTaken) {
        db.prepare(`
          INSERT INTO users (id, email, name, role, title, company, bio, avatar_url, avatar_storage_id, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          preferredId,
          normalizedEmail,
          remoteUser.name || normalizedEmail.split('@')[0] || 'QuantalFlow User',
          remoteUser.role || 'member',
          remoteUser.title || '',
          remoteUser.company || '',
          remoteUser.bio || '',
          remoteUser.avatarUrl || remoteUser.avatar_url || '',
          remoteUser.avatarStorageId || remoteUser.avatar_storage_id || '',
          passwordHash,
          remoteUser.createdAt || Date.now()
        );
        return findUserById(preferredId);
      }
    }

    const info = db.prepare(`
      INSERT INTO users (email, name, role, title, company, bio, avatar_url, avatar_storage_id, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalizedEmail,
      remoteUser.name || normalizedEmail.split('@')[0] || 'QuantalFlow User',
      remoteUser.role || 'member',
      remoteUser.title || '',
      remoteUser.company || '',
      remoteUser.bio || '',
      remoteUser.avatarUrl || remoteUser.avatar_url || '',
      remoteUser.avatarStorageId || remoteUser.avatar_storage_id || '',
      passwordHash,
      remoteUser.createdAt || Date.now()
    );
    return findUserById(Number(info.lastInsertRowid));
  } catch {
    return findUserByEmail(normalizedEmail);
  }
}

export function createUser({ email, name, passwordHash, role = 'member' }) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const info = db
      .prepare(
        `INSERT OR REPLACE INTO users (email, name, role, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(normalizedEmail, name, role, passwordHash, Date.now());

    const user = findUserById(Number(info.lastInsertRowid) || db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail).id);
    const syncPromise = syncUserToConvex(user, passwordHash);
    if (user && syncPromise) {
      Object.defineProperty(user, '_convexSyncPromise', {
        value: syncPromise,
        enumerable: false
      });
    }
    return user;
  } catch (err) {
    const existing = findUserByEmail(normalizedEmail);
    if (existing) return existing;
    throw err;
  }
}

export async function findOrCreateClerkUser({ email, name }) {
  const normalized = normalizeEmail(email);
  let existing = findUserByEmail(normalized);
  if (!existing && !config.isTest) {
    try {
      const remote = await getConvexUserByEmail(normalized);
      if (remote) existing = upsertLocalUserFromConvex(remote);
    } catch {}
  }
  if (existing) {
    await syncUserToConvex(existing);
    return findUserById(existing.id);
  }
  const placeholderHash = 'scrypt$16384$8$1$' + crypto.randomBytes(16).toString('base64url') + '$' + crypto.randomBytes(64).toString('base64url');
  const created = createUser({
    email: normalized,
    name: name || normalized.split('@')[0] || 'QuantalFlow User',
    passwordHash: placeholderHash,
    role: 'member'
  });
  if (created?._convexSyncPromise) await created._convexSyncPromise;
  return created;
}

/**
 * Create a session and return its token synchronously (for test helpers),
 * while also exposing `createSessionAsync` to await Convex session persistence
 * in serverless functions before the HTTP response is sent.
 */
export function createSession(userId, userDetails = null) {
  const sid = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  const expiresAt = now + config.session.ttlMs;
  const u = userDetails || findUserById(userId) || { id: userId, email: '', name: '', role: 'member' };

  const token = signTokenPayload(sid, {
    uid: Number(u.id || userId),
    email: u.email || '',
    name: u.name || '',
    role: u.role || 'member',
    exp: expiresAt
  });

  revokedTokens.delete(token);
  db.prepare(
    `INSERT OR REPLACE INTO sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(token, u.id || userId, now, expiresAt);

  if (u && u.email) {
    createConvexSession({
      token,
      userId: String(u.id || userId),
      email: u.email,
      name: u.name,
      role: u.role || 'member',
      title: u.title || '',
      company: u.company || '',
      bio: u.bio || '',
      avatarUrl: u.avatar_url || '',
      avatarStorageId: u.avatar_storage_id || '',
      expiresAt
    }).catch(() => {});
  }

  return token;
}

export async function createSessionAsync(userId, userDetails = null) {
  const sid = crypto.randomBytes(24).toString('base64url');
  const now = Date.now();
  const expiresAt = now + config.session.ttlMs;
  const u = userDetails || findUserById(userId) || { id: userId, email: '', name: '', role: 'member' };

  const token = signTokenPayload(sid, {
    uid: Number(u.id || userId),
    email: u.email || '',
    name: u.name || '',
    role: u.role || 'member',
    exp: expiresAt
  });

  revokedTokens.delete(token);
  db.prepare(
    `INSERT OR REPLACE INTO sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(token, u.id || userId, now, expiresAt);

  if (u && u.email) {
    await createConvexSession({
      token,
      userId: String(u.id || userId),
      email: u.email,
      name: u.name,
      role: u.role || 'member',
      title: u.title || '',
      company: u.company || '',
      bio: u.bio || '',
      avatarUrl: u.avatar_url || '',
      avatarStorageId: u.avatar_storage_id || '',
      expiresAt
    }).catch(() => {});
  }

  return token;
}

export function getSessionUser(token) {
  if (!token || revokedTokens.has(token)) return null;

  const row = db
    .prepare(
      `SELECT s.expires_at, u.id, u.email, u.name, u.role, u.title, u.company, u.bio, u.avatar_url, u.avatar_storage_id, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
    .get(token);

  if (row) {
    if (row.expires_at <= Date.now()) {
      deleteSession(token);
      return null;
    }
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      title: row.title || '',
      company: row.company || '',
      bio: row.bio || '',
      avatar_url: row.avatar_url || '',
      avatar_storage_id: row.avatar_storage_id || '',
      created_at: row.created_at
    };
  }

  return null;
}

/**
 * Async session lookup that checks local SQLite, then Convex Auth (`sessions` + `users`),
 * and finally verifies HMAC-signed stateless session payloads on cold serverless starts.
 */
export async function getSessionUserWithConvexFallback(token) {
  if (!token || revokedTokens.has(token)) return null;

  const local = getSessionUser(token);
  if (local) return local;

  if (config.isTest) return null;

  // 1. Check Convex Auth sessions table
  try {
    const convexSession = await getConvexSession(token);
    if (convexSession && convexSession.expiresAt > Date.now()) {
      let localUser = upsertLocalUserFromConvex({
        email: convexSession.email,
        name: convexSession.name,
        role: convexSession.role,
        externalId: convexSession.userId,
        title: convexSession.title,
        company: convexSession.company,
        bio: convexSession.bio,
        avatarUrl: convexSession.avatarUrl,
        avatarStorageId: convexSession.avatarStorageId
      });

      if (localUser) {
        db.prepare(
          `INSERT OR REPLACE INTO sessions (id, user_id, created_at, expires_at)
           VALUES (?, ?, ?, ?)`
        ).run(token, localUser.id, convexSession.createdAt || Date.now(), convexSession.expiresAt);
        return publicUser(localUser);
      }
    }
  } catch (err) {
    console.warn('[auth] convex session lookup failed:', err.message);
  }

  // 2. Fallback to HMAC-signed token verification if serverless instance cold-started
  const signedPayload = verifySignedSessionToken(token);
  if (signedPayload && signedPayload.email) {
    let localUser = upsertLocalUserFromConvex({
      email: signedPayload.email,
      name: signedPayload.name,
      role: signedPayload.role,
      externalId: String(signedPayload.uid || '')
    });
    if (localUser) {
      db.prepare(
        `INSERT OR REPLACE INTO sessions (id, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`
      ).run(token, localUser.id, Date.now(), signedPayload.exp);
      return publicUser(localUser);
    }
  }

  return null;
}

export function deleteSession(token) {
  if (!token) return 0;
  revokedTokens.add(token);
  removeConvexSession(token).catch(() => {});
  return db.prepare('DELETE FROM sessions WHERE id = ?').run(token).changes;
}

export async function deleteSessionAsync(token) {
  if (!token) return 0;
  revokedTokens.add(token);
  const changes = db.prepare('DELETE FROM sessions WHERE id = ?').run(token).changes;
  await removeConvexSession(token).catch(() => {});
  return changes;
}

export function deleteUserSessions(userId) {
  if (!userId) return 0;
  removeConvexSessionsByUserId(userId).catch(() => {});
  return db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId).changes;
}

/** Public shape of a user — never leaks the password hash. */
export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    title: user.title || '',
    company: user.company || '',
    bio: user.bio || '',
    avatar_url: user.avatar_url || '',
    avatar_storage_id: user.avatar_storage_id || '',
    created_at: user.created_at
  };
}
