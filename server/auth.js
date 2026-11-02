import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import { config } from './config.js';
import { syncUserToConvex } from './convex.js';

const scrypt = promisify(crypto.scrypt);

// scrypt parameters. N=16384 keeps a single hash around ~50ms on this machine,
// which is slow enough to make offline guessing expensive without hurting UX.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

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

export function createUser({ email, name, passwordHash, role = 'member' }) {
  const info = db
    .prepare(
      `INSERT INTO users (email, name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(normalizeEmail(email), name, role, passwordHash, Date.now());

  const user = findUserById(Number(info.lastInsertRowid));
  syncUserToConvex(user, passwordHash);
  return user;
}

export function findOrCreateClerkUser({ email, name }) {
  const normalized = normalizeEmail(email);
  const existing = findUserByEmail(normalized);
  if (existing) {
    syncUserToConvex(existing);
    return findUserById(existing.id);
  }
  const placeholderHash = 'scrypt$16384$8$1$' + crypto.randomBytes(16).toString('base64url') + '$' + crypto.randomBytes(64).toString('base64url');
  return createUser({
    email: normalized,
    name: name || normalized.split('@')[0] || 'QuantalFlow User',
    passwordHash: placeholderHash,
    role: 'member'
  });
}

/**
 * Create a session and return its opaque token. The token is a 256-bit
 * random value; only the token is stored in the client cookie.
 */
export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (id, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(token, userId, now, now + config.session.ttlMs);
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.expires_at, u.id, u.email, u.name, u.role, u.title, u.company, u.bio, u.avatar_url, u.avatar_storage_id, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
    .get(token);

  if (!row) return null;

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

export function deleteSession(token) {
  if (!token) return 0;
  return db.prepare('DELETE FROM sessions WHERE id = ?').run(token).changes;
}

export function deleteUserSessions(userId) {
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
