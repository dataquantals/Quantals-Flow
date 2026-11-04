/**
 * Idempotently ensure the requested accounts exist with their credentials.
 */
import { config } from './config.js';
import { db } from './db.js';
import { hashPassword, findUserByEmail, normalizeEmail, findUserById } from './auth.js';
import { syncUserToConvex } from './convex.js';

const accounts = [
  {
    email: 'dataquantals@gmail.com',
    name: 'Owner',
    role: 'owner',
    password: '12345678'
  },
  {
    email: 'dataqauntals@gmail.com',
    name: 'Data Quantals',
    role: 'owner',
    password: '12345678'
  },
  {
    email: 'mumbarich@gmail.com',
    name: 'Mumbarich',
    role: 'member',
    password: '12345678'
  }
];

for (const acc of accounts) {
  const normalized = normalizeEmail(acc.email);
  const passwordHash = await hashPassword(acc.password);
  const existing = findUserByEmail(normalized);

  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(
      passwordHash,
      acc.role,
      existing.id
    );
    const updated = findUserById(existing.id);
    await syncUserToConvex(updated, passwordHash);
    console.log(`Seed: updated ${normalized} (id ${existing.id}, role ${acc.role}) with password.`);
  } else {
    const info = db
      .prepare(
        `INSERT INTO users (email, name, role, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(normalized, acc.name, acc.role, passwordHash, Date.now());

    const created = findUserById(Number(info.lastInsertRowid));
    await syncUserToConvex(created, passwordHash);
    console.log(`Seed: created ${normalized} (id ${info.lastInsertRowid}, role ${acc.role}).`);
  }
}

const total = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
console.log(`Seed: ${total} user(s) in ${config.dbFile}`);
