import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import {
  syncBoardToConvex,
  deleteBoardFromConvex,
  syncProjectPlanToConvex,
  deleteProjectPlanFromConvex
} from './convex.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(config.dbFile);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'member',
    password_hash TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );
`);

// Add profile extension columns if not already present
try { db.exec("ALTER TABLE users ADD COLUMN title TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN company TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN avatar_storage_id TEXT DEFAULT ''"); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)');

db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title      TEXT    NOT NULL DEFAULT 'Untitled Board',
    category   TEXT    NOT NULL DEFAULT 'Strategy & Planning',
    starred    INTEGER NOT NULL DEFAULT 0,
    state_json TEXT    NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_boards_updated ON boards(updated_at DESC)');

/**
 * Project Planning plans.
 *
 * The plan is stored here (not only in the browser) so a different device or a
 * cleared localStorage still finds the work, and so it can be mirrored row by
 * row into Convex `projectPlans` + the nine section tables. `plan_json` is the
 * authoritative snapshot; the Convex tables are the queryable projection.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS project_plans (
    board_id   TEXT PRIMARY KEY,
    plan_json  TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_project_plans_updated ON project_plans(updated_at DESC)');

// Row-level ownership. Every board and plan belongs to exactly one user; every
// read, write and delete below is scoped by that user id. `ALTER TABLE` throws
// when the column already exists, which is the idempotent path.
try { db.exec('ALTER TABLE project_plans ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE'); } catch {}
db.exec('CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_project_plans_user ON project_plans(user_id)');

const DEFAULT_BOARDS = [
  {
    id: 'q4-intelligent-canvas',
    title: 'Q4 Intelligent Canvas & Architecture',
    category: 'AI & Product Strategy',
    starred: 1
  },
  {
    id: 'product-roadmap-q4',
    title: 'Product Roadmap Q4',
    category: 'Engineering & Delivery',
    starred: 1
  },
  {
    id: 'research-synthesis',
    title: 'Customer Research Synthesis',
    category: 'UX & Discovery',
    starred: 0
  },
  {
    id: 'customer-journey-map',
    title: 'End-to-End Customer Journey Map',
    category: 'Growth & Design',
    starred: 0
  }
];

(function seedDefaultBoards() {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM boards').get().cnt;
  if (count > 0) return;
  const now = Date.now();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, '{}', ?, ?)
  `);
  DEFAULT_BOARDS.forEach((b, idx) => {
    insert.run(b.id, b.title, b.category, b.starred, now - idx * 3600000, now - idx * 1800000);
  });
})();

/**
 * Canonical blank Project Planning workspace.
 *
 * The dashboard sidebar shortcut must always open a clean plan. Previously it
 * followed whichever project-planning board happened to be newest, which meant
 * it could land on a board whose browser-local plan still held the old demo
 * template. This dedicated row gives the shortcut a stable, deliberately empty
 * home. It is created once (INSERT OR IGNORE) and never rewritten, so a plan a
 * user builds there is never clobbered on restart.
 */
export const BLANK_PROJECT_PLANNING_BOARD_ID = 'project-planning-workspace';

/**
 * Recognises the shipped demo templates ("Data Quantals Plan" / "Enterprise
 * Release") by code and title. Mirrors isDemoFingerprint() in
 * assets/js/project-planning.js so the server and the client agree on what may
 * not be stored in the blank workspace.
 */
export function isDemoPlanFingerprint(plan) {
  if (!plan || typeof plan !== 'object') return false;
  const code = String(plan.projectCode || '');
  if (code === 'WBS-2026' || code === 'PRJ-2026-Q4') return true;
  const name = String(plan.projectName || '');
  return /Construction of a House/i.test(name) || /Enterprise Release/i.test(name);
}

/**
 * The blank Project Planning workspace has one fixed public id so the dashboard
 * shortcut can always open it. Board ids are global primary keys, so to keep it
 * private per user the stored row id is namespaced as `<id>~<userId>`. Callers
 * and the browser only ever see the public id.
 */
const USER_SCOPED_BOARD_IDS = new Set([BLANK_PROJECT_PLANNING_BOARD_ID]);

export function scopeBoardId(id, userId) {
  const raw = String(id || '');
  return USER_SCOPED_BOARD_IDS.has(raw) ? `${raw}~${userId}` : raw;
}

export function publicBoardId(id) {
  return String(id || '').split('~')[0];
}

function forbidden(message = 'Forbidden') {
  const err = new Error(message);
  err.status = 403;
  return err;
}

function ownsRow(row, userId) {
  return Boolean(row) && row.user_id != null && Number(row.user_id) === Number(userId);
}

/** Create the caller's own blank planning workspace once (never rewritten). */
function ensureUserBlankBoard(userId) {
  const internalId = scopeBoardId(BLANK_PROJECT_PLANNING_BOARD_ID, userId);
  const now = Date.now();
  db.prepare(`
    INSERT OR IGNORE INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, '{}', ?, ?)
  `).run(internalId, userId, 'New Project Planning Workspace', 'AI & Product Strategy', now, now);

  // The board opens the planning suite (not a blank canvas) via its
  // `workspaceMode` marker. It is merged in, never replaced, so a canvas save
  // (which writes `{version, items, paths}` and knows nothing about the marker)
  // can no longer strip it and drop the user on an empty canvas.
  const row = db.prepare('SELECT state_json FROM boards WHERE id = ? AND user_id = ?').get(internalId, userId);
  const state = parseStateJson(row && row.state_json);
  if (row && state.workspaceMode !== 'project-planning') {
    state.workspaceMode = 'project-planning';
    db.prepare('UPDATE boards SET state_json = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(state), internalId, userId);
  }
  const board = getBoardById(BLANK_PROJECT_PLANNING_BOARD_ID, userId);
  if (board) syncBoardToConvex(board, userId, internalId);
}

/**
 * Rows created before ownership existed have no owner and would be invisible to
 * everyone. Hand them to the owner account once. Idempotent: it only touches
 * rows that still have no user, so it is a no-op on every later boot.
 */
(function claimLegacyRows() {
  const owner =
    db.prepare("SELECT id FROM users WHERE email = 'dataquantals@gmail.com'").get() ||
    db.prepare("SELECT id FROM users WHERE role = 'owner' ORDER BY id LIMIT 1").get();
  if (!owner) return;

  const blank = BLANK_PROJECT_PLANNING_BOARD_ID;
  const scoped = `${blank}~${owner.id}`;
  const hasScoped = db.prepare('SELECT 1 AS ok FROM boards WHERE id = ?').get(scoped);
  if (!hasScoped) {
    db.prepare('UPDATE boards SET id = ? WHERE id = ?').run(scoped, blank);
    db.prepare('UPDATE project_plans SET board_id = ? WHERE board_id = ?').run(scoped, blank);
  }

  db.prepare('UPDATE boards SET user_id = ? WHERE user_id IS NULL').run(owner.id);
  db.prepare(`
    UPDATE project_plans
       SET user_id = COALESCE((SELECT b.user_id FROM boards b WHERE b.id = project_plans.board_id), ?)
     WHERE user_id IS NULL
  `).run(owner.id);
})();

/** The caller's boards only. `userId` is required: there is no unscoped listing. */
export function listBoards({ query = '', starredOnly = false, userId } = {}) {
  if (userId == null) throw forbidden();
  ensureUserBlankBoard(userId);

  let sql = 'SELECT id, user_id, title, category, starred, state_json, created_at, updated_at FROM boards';
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (starredOnly) {
    clauses.push('starred = 1');
  }
  if (query) {
    clauses.push('(title LIKE ? OR category LIKE ?)');
    params.push(`%${query}%`, `%${query}%`);
  }
  sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY updated_at DESC';
  return db.prepare(sql).all(...params).map(row => ({
    id: publicBoardId(row.id),
    title: row.title,
    category: row.category,
    starred: Boolean(row.starred),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasSavedState: Boolean(row.state_json && row.state_json !== '{}')
  }));
}

/** A board the caller owns, or null. Someone else's board looks like a missing one. */
export function getBoardById(id, userId) {
  if (userId == null) return null;
  const row = db.prepare('SELECT * FROM boards WHERE id = ?').get(scopeBoardId(id, userId));
  if (!ownsRow(row, userId)) return null;
  let state = null;
  try {
    state = row.state_json ? JSON.parse(row.state_json) : null;
    if (state && Object.keys(state).length === 0) state = null;
  } catch {
    state = null;
  }
  return {
    id: publicBoardId(row.id),
    title: row.title,
    category: row.category,
    starred: Boolean(row.starred),
    state,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** URL-safe form of a board title, e.g. "Data Quantals Plan" -> "data-quantals-plan". */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Resolve a pretty URL slug back to the board it belongs to. Titles are the
 * human-readable identity, so the newest / starred board wins a tie.
 */
export function findBoardBySlug(slug, userId) {
  const target = slugify(slug);
  if (!target || userId == null) return null;
  ensureUserBlankBoard(userId);
  const row = db
    .prepare('SELECT id, title FROM boards WHERE user_id = ? ORDER BY starred DESC, updated_at DESC')
    .all(userId)
    .find((candidate) => slugify(candidate.title) === target);
  return row ? getBoardById(publicBoardId(row.id), userId) : null;
}

/**
 * Boards that own a saved plan must reopen in the planning suite.
 *
 * The canvas autosave writes `{ version, items, paths }` with no `workspaceMode`,
 * so a canvas save on a planning board used to strip the marker and drop the user
 * on an empty canvas even though the plan was still stored. Re-adding the marker
 * here keeps the board and its plan joined at the hip.
 */
function stateJsonFor(id, value) {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  if (!obj.workspaceMode) {
    const row = db.prepare('SELECT state_json FROM boards WHERE id = ?').get(String(id || ''));
    const previous = row ? parseStateJson(row.state_json) : {};
    if (previous.workspaceMode === 'project-planning') obj.workspaceMode = 'project-planning';
  }
  if (hasProjectPlan(id)) obj.workspaceMode = 'project-planning';
  return JSON.stringify(obj);
}

function parseStateJson(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Create or update a board the caller owns. `userId` is mandatory and always
 * comes from the authenticated session, never from request input. Touching a
 * board that belongs to someone else is a 403, not a silent overwrite.
 */
export function upsertBoard({ id, userId, title, category, starred, state }) {
  if (userId == null) throw forbidden();
  const now = Date.now();
  const internalId = scopeBoardId(id, userId);
  const existing = db.prepare('SELECT * FROM boards WHERE id = ?').get(internalId);
  if (existing && !ownsRow(existing, userId)) throw forbidden();
  if (!existing) {
    const stateStr = stateJsonFor(internalId, state);
    db.prepare(`
      INSERT INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      internalId,
      userId,
      title || 'Untitled Board',
      category || 'Strategy & Planning',
      starred ? 1 : 0,
      stateStr,
      now,
      now
    );
  } else {
    const nextTitle = title !== undefined ? title : existing.title;
    const nextCategory = category !== undefined ? category : existing.category;
    const nextStarred = starred !== undefined ? (starred ? 1 : 0) : existing.starred;
    const nextStateStr = state !== undefined
      ? stateJsonFor(internalId, state)
      : stateJsonFor(internalId, parseStateJson(existing.state_json));
    db.prepare(`
      UPDATE boards
      SET title = ?, category = ?, starred = ?, state_json = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(nextTitle, nextCategory, nextStarred, nextStateStr, now, internalId, userId);
  }
  const saved = getBoardById(id, userId);
  syncBoardToConvex(saved, userId, internalId);
  return saved;
}

export async function removeBoard(id, userId) {
  if (userId == null) throw forbidden();
  const internalId = scopeBoardId(id, userId);
  const removed = db.prepare('DELETE FROM boards WHERE id = ? AND user_id = ?').run(internalId, userId).changes > 0;
  if (!removed) return { removed: false, convex: false };

  db.prepare('DELETE FROM project_plans WHERE board_id = ? AND user_id = ?').run(internalId, userId);
  // Await the mirror so the caller can report, rather than a delete that looks
  // complete while Convex still holds the rows.
  const boardGone = await deleteBoardFromConvex(internalId, userId);
  const planGone = await deleteProjectPlanFromConvex(internalId, userId);
  return { removed: true, convex: Boolean(boardGone && planGone) };
}

/* --------------------------- project plans --------------------------- */

/** Sanity ceiling so a runaway client cannot fill the disk / hit Convex limits. */
const PLAN_MAX_BYTES = 4 * 1024 * 1024;

export function getProjectPlan(boardId, userId) {
  if (userId == null) return null;
  const row = db
    .prepare('SELECT plan_json FROM project_plans WHERE board_id = ? AND user_id = ?')
    .get(scopeBoardId(boardId, userId), userId);
  if (!row || !row.plan_json) return null;
  try {
    const plan = JSON.parse(row.plan_json);
    return plan && typeof plan === 'object' ? plan : null;
  } catch {
    return null;
  }
}

/** Takes the stored (internal) board id, as used by stateJsonFor. */
export function hasProjectPlan(boardId) {
  return db.prepare('SELECT 1 AS ok FROM project_plans WHERE board_id = ?').get(String(boardId || ''))?.ok === 1;
}

/**
 * Persist a Project Planning plan owned by `userId`.
 *
 * SQLite is the source of truth for local reads; Convex is mirrored right away
 * (awaited so a schema/function mismatch surfaces in the request log instead of
 * disappearing). A Convex hiccup never blocks the save: the local write already
 * happened and the next save retries.
 */
export async function saveProjectPlan(boardId, plan, userId) {
  if (userId == null) throw forbidden();
  if (!boardId || !plan || typeof plan !== 'object') {
    const err = new Error('A plan object is required.');
    err.status = 400;
    throw err;
  }

  const internalId = scopeBoardId(boardId, userId);

  // Never write over a plan or board that belongs to someone else.
  const existingPlan = db.prepare('SELECT user_id FROM project_plans WHERE board_id = ?').get(internalId);
  if (existingPlan && !ownsRow(existingPlan, userId)) throw forbidden();
  const existingBoard = db.prepare('SELECT user_id FROM boards WHERE id = ?').get(internalId);
  if (existingBoard && !ownsRow(existingBoard, userId)) throw forbidden();

  // The canonical blank workspace must stay blank: an older client (or a tab
  // opened before the demo purge) can replay a sample snapshot here, which then
  // gets hydrated back into every new visit. Reject it at the door.
  if (String(boardId) === BLANK_PROJECT_PLANNING_BOARD_ID && isDemoPlanFingerprint(plan)) {
    const err = new Error('Refusing to store a demo plan in the blank workspace.');
    err.status = 409;
    throw err;
  }

  const planJson = JSON.stringify(plan);
  if (planJson.length > PLAN_MAX_BYTES) {
    const err = new Error('Plan is too large to save.');
    err.status = 413;
    throw err;
  }

  const now = Date.now();
  db.prepare(`
    INSERT INTO project_plans (board_id, user_id, plan_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(board_id) DO UPDATE SET plan_json = excluded.plan_json, updated_at = excluded.updated_at
  `).run(internalId, userId, planJson, now, now);

  // Saving a plan is activity on the board: keep it at the top of the dashboard.
  db.prepare('UPDATE boards SET updated_at = ? WHERE id = ? AND user_id = ?').run(now, internalId, userId);
  // A board that owns a plan must reopen in the planning suite. Merge the marker
  // into whatever the board already holds instead of only touching `{}` rows, so
  // a canvas autosave can no longer strand a saved plan behind a blank canvas.
  const boardRow = db.prepare('SELECT state_json FROM boards WHERE id = ? AND user_id = ?').get(internalId, userId);
  if (boardRow) {
    const boardState = parseStateJson(boardRow.state_json);
    if (boardState.workspaceMode !== 'project-planning') {
      boardState.workspaceMode = 'project-planning';
      db.prepare('UPDATE boards SET state_json = ? WHERE id = ? AND user_id = ?')
        .run(JSON.stringify(boardState), internalId, userId);
    }
  }

  const convex = await syncProjectPlanToConvex(internalId, plan, userId);
  return { savedAt: now, bytes: planJson.length, convex };
}

export async function removeProjectPlan(boardId, userId) {
  if (userId == null) throw forbidden();
  const id = scopeBoardId(boardId, userId);
  const existing = db.prepare('SELECT user_id FROM project_plans WHERE board_id = ?').get(id);
  if (existing && !ownsRow(existing, userId)) throw forbidden();
  const removed = db.prepare('DELETE FROM project_plans WHERE board_id = ? AND user_id = ?').run(id, userId).changes > 0;
  if (!removed) return { removed: false, convex: false };
  const convex = await deleteProjectPlanFromConvex(id, userId);
  return { removed: true, convex: Boolean(convex) };
}

export function updateUser(id, { name, title, company, bio, avatarUrl, avatarStorageId } = {}) {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return null;
  const nextName = name !== undefined ? String(name).trim() : existing.name;
  const nextTitle = title !== undefined ? String(title).trim() : (existing.title || '');
  const nextCompany = company !== undefined ? String(company).trim() : (existing.company || '');
  const nextBio = bio !== undefined ? String(bio).trim() : (existing.bio || '');
  const nextAvatarUrl = avatarUrl !== undefined ? String(avatarUrl).trim() : (existing.avatar_url || '');
  const nextAvatarStorageId = avatarStorageId !== undefined ? String(avatarStorageId).trim() : (existing.avatar_storage_id || '');

  db.prepare(`
    UPDATE users
    SET name = ?, title = ?, company = ?, bio = ?, avatar_url = ?, avatar_storage_id = ?
    WHERE id = ?
  `).run(nextName, nextTitle, nextCompany, nextBio, nextAvatarUrl, nextAvatarStorageId, id);

  return db.prepare('SELECT id, email, name, role, title, company, bio, avatar_url, avatar_storage_id, created_at FROM users WHERE id = ?').get(id);
}

export function updateUserAvatar(id, avatarUrl = '', avatarStorageId = '') {
  return updateUser(id, { avatarUrl, avatarStorageId });
}

export function updateUserPassword(id, passwordHash) {
  return db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id).changes > 0;
}

export function purgeExpiredSessions(now = Date.now()) {
  return db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now).changes;
}
