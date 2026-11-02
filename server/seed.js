/**
 * Idempotently ensure the owner account exists.
 *
 * Running this repeatedly will not create duplicates. The password is only
 * (re)set when the account is first created, so a password you change later
 * is not silently reverted by re-running the seed.
 */
import { config } from './config.js';
import { db } from './db.js';
import { hashPassword, findUserByEmail, normalizeEmail } from './auth.js';

const { email, password, name, role } = config.seed;
const normalized = normalizeEmail(email);

const existing = findUserByEmail(normalized);

if (existing) {
  console.log(`Seed: ${normalized} already exists (id ${existing.id}, role ${existing.role}). No changes made.`);
} else {
  const passwordHash = await hashPassword(password);
  const info = db
    .prepare(
      `INSERT INTO users (email, name, role, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(normalized, name, role, passwordHash, Date.now());

  console.log(`Seed: created ${normalized} (id ${info.lastInsertRowid}, role ${role}).`);
}

const total = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
console.log(`Seed: ${total} user(s) in ${config.dbFile}`);
