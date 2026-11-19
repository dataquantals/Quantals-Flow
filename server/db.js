import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import {
  syncBoardToConvex,
  fetchBoardsFromConvex,
  fetchBoardFromConvex,
  deleteBoardFromConvex,
  syncProjectPlanToConvex,
  deleteProjectPlanFromConvex,
  syncFolderToConvex,
  deleteFolderFromConvex,
  syncFileToConvex,
  moveFileInConvex,
  deleteFileFromConvex,
  syncFileOrderToConvex,
  syncPreferencesToConvex,
  syncQuotationToConvex,
  getQuotationFromConvex,
  syncInvoiceToConvex,
  getInvoiceFromConvex,
  syncNotepadToConvex,
  getNotepadFromConvex
} from './convex.js';

try {
  fs.mkdirSync(config.dataDir, { recursive: true });
} catch {}

let dbInstance;
try {
  dbInstance = new DatabaseSync(config.dbFile);
  try { dbInstance.exec('PRAGMA journal_mode = WAL'); } catch {}
} catch {
  dbInstance = new DatabaseSync(':memory:');
}

export const db = dbInstance;

try { db.exec('PRAGMA foreign_keys = ON'); } catch {}
try { db.exec('PRAGMA busy_timeout = 5000'); } catch {}

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

// Seed default users if missing (e.g. serverless cold start)
(function seedDefaultUsers() {
  try {
    const now = Date.now();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, role, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insert.run(1, 'dataquantals@gmail.com', 'Owner', 'owner', 'scrypt$16384$8$1$CO5QdVMR0vj5W9msSvj3pw$AhT51UQkmP3kKuGqIwg6RyStyurtk4LGqxR645rNwPgT-nGvrcRSQQvFmnvgVXwdaFNjZHq2rpO8bJ8g-TETug', now);
    insert.run(2, 'mumbarich3@gmail.com', 'Richard Mumba', 'member', 'scrypt$16384$8$1$CO5QdVMR0vj5W9msSvj3pw$AhT51UQkmP3kKuGqIwg6RyStyurtk4LGqxR645rNwPgT-nGvrcRSQQvFmnvgVXwdaFNjZHq2rpO8bJ8g-TETug', now);
    insert.run(3, 'dataqauntals@gmail.com', 'Data Quantals', 'owner', 'scrypt$16384$8$1$r6ZatIMO-nuOLLgzLl6oDw$uHU31ILaz9yP2u7lrflRuO426JW4nNmmU1P82o3O0l_ROXxgPAsbqbmZRMnpnETgURRHrI-Ay_JEv5VTm7g3yg', now);
    insert.run(4, 'mumbarich@gmail.com', 'Mumbarich', 'member', 'scrypt$16384$8$1$RgQEHgwWCTRGk9vMm2QcUw$lKP2MojGNgkfmwppHI7KYmkSBbvQP9p_SJFXR2ENIkOp-uT2FwSWG6utqRcHejzED-KHPF5ka8lbwjxSomQNfw', now);
  } catch {}
})();

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

// Signed session cookies cannot be "deleted" server-side, so a logout records
// the token hash here. Rows expire with the session itself.
db.exec(`
  CREATE TABLE IF NOT EXISTS revoked_sessions (
    token_hash TEXT    PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_revoked_expires ON revoked_sessions(expires_at)');

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
try { db.exec('ALTER TABLE boards ADD COLUMN version INTEGER NOT NULL DEFAULT 1'); } catch {}

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
try { db.exec('ALTER TABLE project_plans ADD COLUMN version INTEGER NOT NULL DEFAULT 1'); } catch {}

/**
 * Uploaded files. Bytes live in Cloudinary; this table holds metadata + the
 * secure URL so the dashboard can list/download/delete without re-querying
 * Cloudinary on every render.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id            TEXT    PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    size          INTEGER NOT NULL DEFAULT 0,
    mime          TEXT    NOT NULL DEFAULT '',
    url           TEXT    NOT NULL,
    public_id     TEXT    NOT NULL DEFAULT '',
    resource_type TEXT    NOT NULL DEFAULT 'image',
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_files_updated ON files(updated_at DESC)');

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
const USER_SCOPED_BOARD_IDS = new Set([
  BLANK_PROJECT_PLANNING_BOARD_ID,
  'new-project-planning-workspace'
]);

export function scopeBoardId(id, userId) {
  const raw = String(id || '');
  return USER_SCOPED_BOARD_IDS.has(raw) ? `${BLANK_PROJECT_PLANNING_BOARD_ID}~${userId}` : raw;
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
  const inserted = db.prepare(`
    INSERT OR IGNORE INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, '{}', ?, ?)
  `).run(internalId, userId, 'New Project Planning Workspace', 'AI & Product Strategy', now, now);

  // The board opens the planning suite (not a blank canvas) via its
  // `workspaceMode` marker. It is merged in, never replaced, so a canvas save
  // (which writes `{version, items, paths}` and knows nothing about the marker)
  // can no longer strip it and drop the user on an empty canvas.
  const row = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(internalId, userId);
  const state = parseStateJson(row && row.state_json);
  if (row && state.workspaceMode !== 'project-planning') {
    state.workspaceMode = 'project-planning';
    db.prepare('UPDATE boards SET state_json = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(state), internalId, userId);
  }
  if (inserted.changes > 0 && row) {
    syncBoardToConvex(
      {
        id: BLANK_PROJECT_PLANNING_BOARD_ID,
        title: row.title,
        category: row.category,
        starred: Boolean(row.starred),
        state
      },
      userId,
      internalId
    );
  }
}

/**
 * Hydrate a user's boards from Convex into local SQLite when running on a
 * cold serverless instance.
 */
export async function hydrateUserBoardsFromConvex(userId) {
  if (userId == null || config.isTest) return;
  try {
    const remoteBoards = await fetchBoardsFromConvex(userId);
    if (!Array.isArray(remoteBoards)) return;
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const rb of remoteBoards) {
      if (!rb || !rb.id) continue;
      const internalId = rb.id.includes('~') ? rb.id : scopeBoardId(rb.id, userId);
      stmt.run(
        internalId,
        userId,
        rb.title || 'Untitled Board',
        rb.category || 'Strategy & Planning',
        rb.starred ? 1 : 0,
        rb.state ? JSON.stringify(rb.state) : '{}',
        rb.createdAt || Date.now(),
        rb.updatedAt || Date.now()
      );
    }
  } catch (err) {
    console.warn('[db] convex board list hydration failed:', err.message);
  }
}

export async function hydrateBoardFromConvex(id, userId) {
  if (!id || userId == null || config.isTest) return null;
  try {
    const internalId = scopeBoardId(id, userId);
    const rb = await fetchBoardFromConvex(internalId, userId);
    if (!rb) return null;
    db.prepare(`
      INSERT INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        starred = excluded.starred,
        state_json = CASE WHEN excluded.state_json != '{}' THEN excluded.state_json ELSE boards.state_json END,
        updated_at = MAX(boards.updated_at, excluded.updated_at)
      WHERE boards.user_id = excluded.user_id
    `).run(
      internalId,
      userId,
      rb.title || 'Untitled Board',
      rb.category || 'Strategy & Planning',
      rb.starred ? 1 : 0,
      rb.state ? JSON.stringify(rb.state) : '{}',
      rb.createdAt || Date.now(),
      rb.updatedAt || Date.now()
    );
    return getBoardById(id, userId);
  } catch {
    return null;
  }
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
  return db.prepare(sql).all(...params).map(row => {
    const state = parseStateJson(row.state_json);
    const activeModule = state.activeModule || (state.workspaceMode === 'project-planning' ? 'project-planning' : '');
    return {
      id: publicBoardId(row.id),
      title: row.title,
      category: row.category,
      starred: Boolean(row.starred),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activeModule,
      hasSavedState: Boolean(row.state_json && row.state_json !== '{}')
    };
  });
}

/** A board the caller owns, or null. Someone else's board looks like a missing one. */
export function getBoardById(id, userId) {
  if (userId == null) return null;
  if (USER_SCOPED_BOARD_IDS.has(String(id || ''))) {
    ensureUserBlankBoard(userId);
  }
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
    version: row.version || 1,
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
export function upsertBoard({ id, userId, title, category, starred, state, expectedVersion }) {
  if (userId == null) throw forbidden();
  const now = Date.now();
  const internalId = scopeBoardId(id, userId);
  const existing = db.prepare('SELECT * FROM boards WHERE id = ?').get(internalId);
  if (existing && !ownsRow(existing, userId)) throw forbidden();
  if (!existing) {
    const stateStr = stateJsonFor(internalId, state);
    db.prepare(`
      INSERT INTO boards (id, user_id, title, category, starred, state_json, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
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
    const currentVersion = existing.version || 1;
    if (expectedVersion != null && Number(expectedVersion) !== currentVersion) {
      const err = new Error('Board has been modified on another device.');
      err.status = 409;
      err.serverBoard = getBoardById(id, userId);
      throw err;
    }
    const nextTitle = title !== undefined ? title : existing.title;
    const nextCategory = category !== undefined ? category : existing.category;
    const nextStarred = starred !== undefined ? (starred ? 1 : 0) : existing.starred;
    const nextStateStr = state !== undefined
      ? stateJsonFor(internalId, state)
      : stateJsonFor(internalId, parseStateJson(existing.state_json));
    db.prepare(`
      UPDATE boards
      SET title = ?, category = ?, starred = ?, state_json = ?, version = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(nextTitle, nextCategory, nextStarred, nextStateStr, currentVersion + 1, now, internalId, userId);
  }
  const saved = getBoardById(id, userId);
  const syncPromise = syncBoardToConvex(saved, userId, internalId);
  if (saved && syncPromise) {
    Object.defineProperty(saved, '_convexSyncPromise', {
      value: syncPromise,
      enumerable: false
    });
  }
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
  const meta = getProjectPlanMeta(boardId, userId);
  return meta ? meta.plan : null;
}

export function getProjectPlanMeta(boardId, userId) {
  if (userId == null) return null;
  const row = db
    .prepare('SELECT plan_json, version, updated_at FROM project_plans WHERE board_id = ? AND user_id = ?')
    .get(scopeBoardId(boardId, userId), userId);
  if (!row || !row.plan_json) return null;
  try {
    const plan = JSON.parse(row.plan_json);
    if (!plan || typeof plan !== 'object') return null;
    return {
      plan,
      version: row.version || 1,
      updatedAt: row.updated_at || 0
    };
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
export async function saveProjectPlan(boardId, plan, userId, options = {}) {
  if (userId == null) throw forbidden();
  if (!boardId || !plan || typeof plan !== 'object') {
    const err = new Error('A plan object is required.');
    err.status = 400;
    throw err;
  }

  const internalId = scopeBoardId(boardId, userId);

  // Never write over a plan or board that belongs to someone else.
  const existingPlan = db.prepare('SELECT user_id, version, updated_at, plan_json FROM project_plans WHERE board_id = ?').get(internalId);
  if (existingPlan && !ownsRow(existingPlan, userId)) throw forbidden();
  const existingBoard = db.prepare('SELECT user_id FROM boards WHERE id = ?').get(internalId);
  if (existingBoard && !ownsRow(existingBoard, userId)) throw forbidden();

  // Optimistic concurrency check if expectedVersion is provided by the client
  const currentVersion = existingPlan ? (existingPlan.version || 1) : 0;
  if (options.expectedVersion != null && existingPlan && Number(options.expectedVersion) !== currentVersion) {
    const err = new Error('Project plan has been updated on another device.');
    err.status = 409;
    try {
      err.serverPlan = JSON.parse(existingPlan.plan_json);
    } catch {
      err.serverPlan = null;
    }
    err.serverVersion = currentVersion;
    err.serverUpdatedAt = existingPlan.updated_at;
    throw err;
  }

  // The canonical blank workspace must stay blank: an older client (or a tab
  // opened before the demo purge) can replay a sample snapshot here, which then
  // gets hydrated back into every new visit. Reject it at the door.
  if (USER_SCOPED_BOARD_IDS.has(String(boardId)) && isDemoPlanFingerprint(plan)) {
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
  const nextVersion = currentVersion + 1;
  db.prepare(`
    INSERT INTO project_plans (board_id, user_id, plan_json, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(board_id) DO UPDATE SET plan_json = excluded.plan_json, version = excluded.version, updated_at = excluded.updated_at
  `).run(internalId, userId, planJson, nextVersion, now, now);

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
  return { savedAt: now, version: nextVersion, bytes: planJson.length, convex };
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
  let changes = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now).changes;
  try {
    changes += db.prepare('DELETE FROM revoked_sessions WHERE expires_at <= ?').run(now).changes;
  } catch {
    /* table not created yet on an older database */
  }
  return changes;
}

export function listFiles({ userId } = {}) {
  if (userId) {
    return db
      .prepare('SELECT * FROM files WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId);
  }
  return db.prepare('SELECT * FROM files ORDER BY updated_at DESC').all();
}

export function getFileById(id, userId) {
  if (userId) {
    return db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(id, userId) || null;
  }
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id) || null;
}

export function insertFile({ id, userId, name, size, mime, url, publicId, resourceType }) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO files (id, user_id, name, size, mime, url, public_id, resource_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId ?? null, name, size || 0, mime || '', url, publicId || '', resourceType || 'image', now, now);
  return getFileById(id, userId);
}

export function deleteFile(id, userId) {
  const row = getFileById(id, userId);
  if (!row) return null;
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
  return row;
}

/** Admin-only user directory (omits password hashes). */
export function listUsers() {
  return db
    .prepare('SELECT id, email, name, role, title, company, bio, avatar_url, avatar_storage_id, created_at FROM users ORDER BY id ASC')
    .all();
}

/** Admin-only system telemetry. */
export function getSystemStats() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get()?.c || 0;
  const boardCount = db.prepare('SELECT COUNT(*) AS c FROM boards').get()?.c || 0;
  const planCount = db.prepare('SELECT COUNT(*) AS c FROM project_plans').get()?.c || 0;
  const sessionCount = db.prepare('SELECT COUNT(*) AS c FROM sessions').get()?.c || 0;
  return {
    userCount,
    boardCount,
    planCount,
    sessionCount,
    timestamp: Date.now()
  };
}

// ============================================================================
// Files & 3D Folders (scoped per user, paired with Cloudinary signed uploads)
// ============================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS user_folders (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    parent_id  TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_user_folders_user ON user_folders(user_id)');

db.exec(`
  CREATE TABLE IF NOT EXISTS user_files (
    id            TEXT    PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id     TEXT,
    name          TEXT    NOT NULL,
    mime_type     TEXT    NOT NULL DEFAULT 'application/octet-stream',
    size          INTEGER NOT NULL DEFAULT 0,
    extension     TEXT    NOT NULL DEFAULT '',
    url           TEXT    NOT NULL DEFAULT '',
    public_id     TEXT    NOT NULL DEFAULT '',
    resource_type TEXT    NOT NULL DEFAULT 'image',
    visibility    TEXT    NOT NULL DEFAULT 'coordinators',
    uploaded_by   TEXT    NOT NULL DEFAULT '',
    data_base64   TEXT,
    created_at    INTEGER NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_user_files_user ON user_files(user_id, created_at DESC)');

function ensureUserFilesAndFoldersSeeded(userId) {
  if (userId == null) return;
  try {
    const now = Date.now();
    const folderDefs = [
      { id: 'folder-data-quantals', name: 'DATA QUANTALS FILE' },
      { id: 'folder-library', name: 'LIBRARY' },
      { id: 'folder-local-needs', name: 'Local Needs' },
      { id: 'folder-meetings', name: 'Meetings' },
      { id: 'folder-sign-language', name: 'SIGN LANGUAGE' },
      { id: 'folder-timetables', name: 'TIMETABLES' }
    ];

    const getFolderByName = db.prepare('SELECT id FROM user_folders WHERE user_id = ? AND LOWER(name) = LOWER(?)');
    const insertFolder = db.prepare('INSERT INTO user_folders (id, user_id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)');

    const idMap = {};
    for (const f of folderDefs) {
      const existing = getFolderByName.get(userId, f.name);
      if (existing) {
        idMap[f.id] = existing.id;
      } else {
        insertFolder.run(f.id, userId, f.name, now, now);
        idMap[f.id] = f.id;
      }
    }

    const sampleFiles = [
      // DATA QUANTALS FILE (9 items)
      { folderId: 'folder-data-quantals', name: 'ZRA SMART INVOICE.pdf', mime: 'application/pdf', ext: 'pdf', size: 245760 },
      { folderId: 'folder-data-quantals', name: 'Tax Clearance Certificate.pdf', mime: 'application/pdf', ext: 'pdf', size: 184320 },
      { folderId: 'folder-data-quantals', name: 'Company Registration PACRA.pdf', mime: 'application/pdf', ext: 'pdf', size: 327680 },
      { folderId: 'folder-data-quantals', name: 'Bank Statement Summary.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', size: 98304 },
      { folderId: 'folder-data-quantals', name: 'Quarterly Financial Audit.pdf', mime: 'application/pdf', ext: 'pdf', size: 419840 },
      { folderId: 'folder-data-quantals', name: 'Client Retainer Agreements.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', size: 79872 },
      { folderId: 'folder-data-quantals', name: 'Legal Compliance Review.pdf', mime: 'application/pdf', ext: 'pdf', size: 153600 },
      { folderId: 'folder-data-quantals', name: 'Asset Management Schedule.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', size: 63488 },
      { folderId: 'folder-data-quantals', name: 'Operational Procedures Manual.pdf', mime: 'application/pdf', ext: 'pdf', size: 532480 },

      // LIBRARY (12 items)
      { folderId: 'folder-library', name: 'Exactly What to Say The Magic Words.pdf', mime: 'application/pdf', ext: 'pdf', size: 1228800 },
      { folderId: 'folder-library', name: 'Thinking Fast and Slow Summary.pdf', mime: 'application/pdf', ext: 'pdf', size: 870400 },
      { folderId: 'folder-library', name: 'Principles by Ray Dalio.pdf', mime: 'application/pdf', ext: 'pdf', size: 2457600 },
      { folderId: 'folder-library', name: 'The Lean Startup Eric Ries.pdf', mime: 'application/pdf', ext: 'pdf', size: 1126400 },
      { folderId: 'folder-library', name: 'Atomic Habits Workbook.pdf', mime: 'application/pdf', ext: 'pdf', size: 665600 },
      { folderId: 'folder-library', name: 'Crucial Conversations Guide.pdf', mime: 'application/pdf', ext: 'pdf', size: 737280 },
      { folderId: 'folder-library', name: 'Zero to One Peter Thiel.pdf', mime: 'application/pdf', ext: 'pdf', size: 972800 },
      { folderId: 'folder-library', name: 'Design Patterns Elements.pdf', mime: 'application/pdf', ext: 'pdf', size: 1536000 },
      { folderId: 'folder-library', name: 'Clean Architecture Handbook.pdf', mime: 'application/pdf', ext: 'pdf', size: 1843200 },
      { folderId: 'folder-library', name: 'Scrum Master Field Guide.pdf', mime: 'application/pdf', ext: 'pdf', size: 440320 },
      { folderId: 'folder-library', name: 'User Story Mapping Guide.pdf', mime: 'application/pdf', ext: 'pdf', size: 901120 },
      { folderId: 'folder-library', name: 'Product Leadership Framework.pdf', mime: 'application/pdf', ext: 'pdf', size: 727040 },

      // Local Needs (1 item)
      { folderId: 'folder-local-needs', name: 'Weekly Signs and Programme.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', size: 55296 },

      // Meetings (3 items)
      { folderId: 'folder-meetings', name: 'S-27b_s-BrZMB_E.pdf', mime: 'application/pdf', ext: 'pdf', size: 317440 },
      { folderId: 'folder-meetings', name: 'Midweek Meeting Schedule Q4.pdf', mime: 'application/pdf', ext: 'pdf', size: 184320 },
      { folderId: 'folder-meetings', name: 'Weekend Discourse Topics.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', size: 63488 },

      // SIGN LANGUAGE (14 items)
      { folderId: 'folder-sign-language', name: 'Module1_Sign_Language_Basics.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx', size: 3276800 },
      { folderId: 'folder-sign-language', name: 'Module2_Vocabulary_Expressions.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx', size: 2867200 },
      { folderId: 'folder-sign-language', name: 'Module3_Grammar_Structure.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx', size: 3174400 },
      { folderId: 'folder-sign-language', name: 'Visual Cue Reference Guide.pdf', mime: 'application/pdf', ext: 'pdf', size: 942080 },
      { folderId: 'folder-sign-language', name: 'Practice Video Transcripts.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', size: 86016 },
      { folderId: 'folder-sign-language', name: 'Fingerspelling Alphabet Chart.png', mime: 'image/png', ext: 'png', size: 460800 },
      { folderId: 'folder-sign-language', name: 'Interpreter Code of Conduct.pdf', mime: 'application/pdf', ext: 'pdf', size: 143360 },
      { folderId: 'folder-sign-language', name: 'Sign Language Curriculum.pdf', mime: 'application/pdf', ext: 'pdf', size: 839680 },
      { folderId: 'folder-sign-language', name: 'Class Attendance Register.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', size: 49152 },
      { folderId: 'folder-sign-language', name: 'Student Progress Assessment.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', size: 76800 },
      { folderId: 'folder-sign-language', name: 'Workshop Handout Day 1.pdf', mime: 'application/pdf', ext: 'pdf', size: 337920 },
      { folderId: 'folder-sign-language', name: 'Workshop Handout Day 2.pdf', mime: 'application/pdf', ext: 'pdf', size: 317440 },
      { folderId: 'folder-sign-language', name: 'Glossary of Specialized Signs.pdf', mime: 'application/pdf', ext: 'pdf', size: 655360 },
      { folderId: 'folder-sign-language', name: 'Evaluation Checklist.pdf', mime: 'application/pdf', ext: 'pdf', size: 112640 },

      // TIMETABLES (1 item)
      { folderId: 'folder-timetables', name: 'AO1 DUTY ROTA FROM NOV 2026.pdf', mime: 'application/pdf', ext: 'pdf', size: 168960 },

      // Root items (3 items) -> Total = 43 files
      { folderId: null, name: 'QuantalFlow Master Service Agreement.pdf', mime: 'application/pdf', ext: 'pdf', size: 215040 },
      { folderId: null, name: 'System Architecture Blueprint.png', mime: 'image/png', ext: 'png', size: 524288 },
      { folderId: null, name: 'Q4 Roadmap & Milestone Review.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', size: 102400 }
    ];

    const checkFile = db.prepare('SELECT id FROM user_files WHERE user_id = ? AND name = ?');
    const insertFile = db.prepare(`
      INSERT INTO user_files (id, user_id, folder_id, name, mime_type, size, extension, url, public_id, resource_type, visibility, uploaded_by, data_base64, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 'raw', 'coordinators', 'Admin', '', ?)
    `);

    for (let i = 0; i < sampleFiles.length; i++) {
      const f = sampleFiles[i];
      if (!checkFile.get(userId, f.name)) {
        const fileId = 'file-seed-' + (i + 1) + '-' + userId;
        const targetFolder = f.folderId ? (idMap[f.folderId] || f.folderId) : null;
        insertFile.run(fileId, userId, targetFolder, f.name, f.mime, f.size, f.ext, now - (i * 60000));
      }
    }
  } catch (err) {
    console.error('Failed to seed default user files and folders:', err);
  }
}

export function listUserFolders(userId) {
  if (userId == null) return [];
  ensureUserFilesAndFoldersSeeded(userId);
  return db
    .prepare('SELECT id, name, parent_id, created_at, updated_at FROM user_folders WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC')
    .all(userId)
    .map((r) => ({
      id: r.id,
      key: r.id,
      name: r.name,
      type: 'folder',
      parentId: r.parent_id || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
}

export function saveUserFolder(userId, { key, name, parentId = null }) {
  if (userId == null) throw forbidden();
  const cleanKey = String(key || '').trim();
  const cleanName = String(name || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!cleanKey || !cleanName) {
    const err = new Error('Folder name and key are required.');
    err.status = 400;
    throw err;
  }
  const cleanParent = parentId ? String(parentId).trim() : null;
  if (cleanParent === cleanKey) {
    const err = new Error('A folder cannot be inside itself.');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM user_folders WHERE id = ? AND user_id = ?').get(cleanKey, userId);
  if (existing) {
    db.prepare('UPDATE user_folders SET name = ?, parent_id = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(cleanName, cleanParent, now, cleanKey, userId);
  } else {
    db.prepare('INSERT INTO user_folders (id, user_id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(cleanKey, userId, cleanName, cleanParent, now, now);
  }
  const row = db.prepare('SELECT id, name, parent_id, created_at, updated_at FROM user_folders WHERE id = ? AND user_id = ?').get(cleanKey, userId);
  const folderObj = {
    id: row.id,
    key: row.id,
    name: row.name,
    type: 'folder',
    parentId: row.parent_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  syncFolderToConvex(folderObj, userId).catch(() => {});
  return folderObj;
}

export function deleteUserFolder(userId, key) {
  if (userId == null) throw forbidden();
  const cleanKey = String(key || '').trim();
  const folder = db.prepare('SELECT id, parent_id FROM user_folders WHERE id = ? AND user_id = ?').get(cleanKey, userId);
  if (!folder) return { deleted: false };
  const parentId = folder.parent_id || null;
  const now = Date.now();
  db.prepare('UPDATE user_folders SET parent_id = ?, updated_at = ? WHERE parent_id = ? AND user_id = ?')
    .run(parentId, now, cleanKey, userId);
  db.prepare('UPDATE user_files SET folder_id = ? WHERE folder_id = ? AND user_id = ?')
    .run(parentId, cleanKey, userId);
  db.prepare('DELETE FROM user_folders WHERE id = ? AND user_id = ?').run(cleanKey, userId);
  deleteFolderFromConvex(cleanKey, userId).catch(() => {});
  return { deleted: true };
}

function toPublicUserFile(r) {
  return {
    id: r.id,
    name: r.name,
    size: r.size,
    mimeType: r.mime_type,
    visibility: r.visibility || 'coordinators',
    uploadedBy: r.uploaded_by || '',
    folderId: r.folder_id || null,
    createdAt: r.created_at,
    url: r.url || ''
  };
}

export function listUserFiles(userId) {
  if (userId == null) return [];
  return db
    .prepare('SELECT id, folder_id, name, mime_type, size, visibility, uploaded_by, url, created_at FROM user_files WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map(toPublicUserFile);
}

export function createUserFile(userId, file) {
  if (userId == null) throw forbidden();
  const id = String(file.id || '').trim();
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_files (id, user_id, folder_id, name, mime_type, size, extension, url, public_id, resource_type, visibility, uploaded_by, data_base64, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    file.folderId || null,
    file.name,
    file.mimeType || 'application/octet-stream',
    Number(file.size) || 0,
    file.extension || '',
    file.url || '',
    file.publicId || '',
    file.resourceType || 'image',
    file.visibility || 'coordinators',
    file.uploadedBy || '',
    file.dataBase64 || null,
    now
  );
  const row = db.prepare('SELECT id, folder_id, name, mime_type, size, visibility, uploaded_by, url, created_at FROM user_files WHERE id = ? AND user_id = ?').get(id, userId);
  const publicFile = row ? toPublicUserFile(row) : null;
  if (publicFile) {
    syncFileToConvex({
      ...publicFile,
      extension: file.extension || '',
      publicId: file.publicId || '',
      resourceType: file.resourceType || 'image',
      updatedAt: now
    }, userId).catch(() => {});
  }
  return publicFile;
}

export function getUserFile(userId, fileId) {
  if (userId == null) throw forbidden();
  return db.prepare('SELECT * FROM user_files WHERE id = ? AND user_id = ?').get(String(fileId || ''), userId) || null;
}

export function moveUserFile(userId, fileId, folderId) {
  if (userId == null) throw forbidden();
  const dest = folderId ? String(folderId).trim() : null;
  const changes = db.prepare('UPDATE user_files SET folder_id = ? WHERE id = ? AND user_id = ?')
    .run(dest, String(fileId || ''), userId).changes;
  if (changes > 0) {
    moveFileInConvex(fileId, dest, userId).catch(() => {});
  }
  return { moved: changes > 0, fileId, folderId: dest };
}

export function deleteUserFile(userId, fileId) {
  if (userId == null) throw forbidden();
  const existing = db.prepare('SELECT id, name, public_id, resource_type FROM user_files WHERE id = ? AND user_id = ?')
    .get(String(fileId || ''), userId);
  if (!existing) return null;
  db.prepare('DELETE FROM user_files WHERE id = ? AND user_id = ?').run(existing.id, userId);
  deleteFileFromConvex(existing.id, userId).catch(() => {});
  return {
    id: existing.id,
    name: existing.name,
    publicId: existing.public_id || '',
    resourceType: existing.resource_type || 'image'
  };
}

/* ---------- Custom File Ordering & User Preferences ---------- */

db.exec(`
  CREATE TABLE IF NOT EXISTS user_file_orders (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id  TEXT    NOT NULL DEFAULT 'root',
    order_json TEXT    NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, folder_id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    files_view_mode TEXT    NOT NULL DEFAULT 'grid',
    files_sort_by   TEXT    NOT NULL DEFAULT 'date-desc',
    updated_at      INTEGER NOT NULL
  );
`);

export function getUserFileOrder(userId, folderId = 'root') {
  if (userId == null) return {};
  const fid = String(folderId || 'root').trim() || 'root';
  const row = db.prepare('SELECT order_json FROM user_file_orders WHERE user_id = ? AND folder_id = ?').get(userId, fid);
  if (!row || !row.order_json) return {};
  try {
    const parsed = JSON.parse(row.order_json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveUserFileOrder(userId, folderId = 'root', orderObj = {}) {
  if (userId == null) throw forbidden();
  const fid = String(folderId || 'root').trim() || 'root';
  const clean = orderObj && typeof orderObj === 'object' && !Array.isArray(orderObj) ? orderObj : {};
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_file_orders (user_id, folder_id, order_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, folder_id) DO UPDATE SET order_json = excluded.order_json, updated_at = excluded.updated_at
  `).run(userId, fid, JSON.stringify(clean), now);
  syncFileOrderToConvex(userId, fid, clean).catch(() => {});
  return clean;
}

export function getUserPreferences(userId) {
  if (userId == null) return { filesViewMode: 'grid', filesSortBy: 'date-desc' };
  const row = db.prepare('SELECT files_view_mode, files_sort_by FROM user_preferences WHERE user_id = ?').get(userId);
  if (!row) return { filesViewMode: 'grid', filesSortBy: 'date-desc' };
  return {
    filesViewMode: row.files_view_mode === 'list' ? 'list' : 'grid',
    filesSortBy: row.files_sort_by || 'date-desc'
  };
}

export function saveUserPreferences(userId, prefs = {}) {
  if (userId == null) throw forbidden();
  const current = getUserPreferences(userId);
  const filesViewMode = prefs.filesViewMode === 'list' ? 'list' : (prefs.filesViewMode === 'grid' ? 'grid' : current.filesViewMode);
  const ALLOWED_SORTS = new Set(['date-desc', 'date-asc', 'name-asc', 'name-desc', 'size-desc', 'size-asc']);
  const filesSortBy = ALLOWED_SORTS.has(prefs.filesSortBy) ? prefs.filesSortBy : current.filesSortBy;
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_preferences (user_id, files_view_mode, files_sort_by, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET files_view_mode = excluded.files_view_mode, files_sort_by = excluded.files_sort_by, updated_at = excluded.updated_at
  `).run(userId, filesViewMode, filesSortBy, now);
  const next = { filesViewMode, filesSortBy };
  syncPreferencesToConvex(userId, next).catch(() => {});
  return next;
}


/* ---------- Quotation (one working document per user) ---------- */

db.exec(`
  CREATE TABLE IF NOT EXISTS user_quotations (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_json  TEXT    NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL
  );
`);

/** Returns the saved quotation object, or null when the user has none yet. */
export async function getUserQuotation(userId) {
  if (userId == null) return null;
  const row = db.prepare('SELECT data_json, updated_at FROM user_quotations WHERE user_id = ?').get(userId);
  if (row) {
    try {
      const parsed = JSON.parse(row.data_json);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { data: parsed, updatedAt: row.updated_at };
      }
    } catch {
      // fall through to Convex hydration
    }
  }

  // Cold local cache / missing SQLite row: hydrate from Convex if available.
  try {
    const remote = await getQuotationFromConvex(userId);
    const qData = remote && remote.data ? remote.data : remote;
    if (qData && typeof qData === 'object' && !Array.isArray(qData) && Array.isArray(qData.items)) {
      const now = Number((remote && remote.updatedAt) || qData.updatedAt || Date.now());
      db.prepare(`
        INSERT INTO user_quotations (user_id, data_json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
      `).run(userId, JSON.stringify(qData), now);
      return { data: qData, updatedAt: now };
    }
  } catch {
    // Convex unavailable or not configured — treat as no saved quotation.
  }

  return null;
}

export async function saveUserQuotation(userId, data) {
  if (userId == null) throw forbidden();
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.items)) {
    const err = new Error('A quotation needs a list of line items.');
    err.status = 400;
    throw err;
  }
  if (data.items.length > 500) {
    const err = new Error('A quotation can hold at most 500 line items.');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_quotations (user_id, data_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(data), now);

  let convexSynced = false;
  try {
    const res = await syncQuotationToConvex(userId, data, now);
    convexSynced = Boolean(res && (res.quotationId || res.updatedAt || res.quotationNumber));
  } catch {
    convexSynced = false;
  }

  return { updatedAt: now, convexSynced };
}

/* ---------- Invoice (one working document per user) ---------- */

db.exec(`
  CREATE TABLE IF NOT EXISTS user_invoices (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_json  TEXT    NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL
  );
`);

/** Returns the saved invoice object, or null when the user has none yet. */
export async function getUserInvoice(userId) {
  if (userId == null) return null;
  const row = db.prepare('SELECT data_json, updated_at FROM user_invoices WHERE user_id = ?').get(userId);
  if (row) {
    try {
      const parsed = JSON.parse(row.data_json);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { data: parsed, updatedAt: row.updated_at };
      }
    } catch {
      // fall through to Convex hydration
    }
  }

  try {
    const remote = await getInvoiceFromConvex(userId);
    const invData = remote && remote.data ? remote.data : remote;
    if (invData && typeof invData === 'object' && !Array.isArray(invData) && Array.isArray(invData.items)) {
      const now = Number((remote && remote.updatedAt) || invData.updatedAt || Date.now());
      db.prepare(`
        INSERT INTO user_invoices (user_id, data_json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
      `).run(userId, JSON.stringify(invData), now);
      return { data: invData, updatedAt: now };
    }
  } catch {
    // Convex unavailable or not configured — treat as no saved invoice.
  }

  return null;
}

export async function saveUserInvoice(userId, data) {
  if (userId == null) throw forbidden();
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.items)) {
    const err = new Error('An invoice needs a list of line items.');
    err.status = 400;
    throw err;
  }
  if (data.items.length > 500) {
    const err = new Error('An invoice can hold at most 500 line items.');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_invoices (user_id, data_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(data), now);

  let convexSynced = false;
  try {
    const res = await syncInvoiceToConvex(userId, data, now);
    convexSynced = Boolean(res && (res.invoiceId || res.updatedAt || res.invoiceNumber));
  } catch {
    convexSynced = false;
  }

  return { updatedAt: now, convexSynced };
}

/* ---------- Note Pad (typed & drawn notes per user) ---------- */

db.exec(`
  CREATE TABLE IF NOT EXISTS user_notepads (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notes_json TEXT    NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );
`);

export async function getUserNotepad(userId) {
  if (userId == null) return null;
  const row = db.prepare('SELECT notes_json, updated_at FROM user_notepads WHERE user_id = ?').get(userId);
  if (row) {
    try {
      const parsed = JSON.parse(row.notes_json);
      if (Array.isArray(parsed)) {
        return { notes: parsed, updatedAt: row.updated_at };
      }
    } catch {
      // fall through to Convex hydration
    }
  }

  try {
    const remote = await getNotepadFromConvex(userId);
    if (remote && Array.isArray(remote.notes)) {
      const now = Number(remote.updatedAt || Date.now());
      db.prepare(`
        INSERT INTO user_notepads (user_id, notes_json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET notes_json = excluded.notes_json, updated_at = excluded.updated_at
      `).run(userId, JSON.stringify(remote.notes), now);
      return { notes: remote.notes, updatedAt: now };
    }
  } catch {
    // Convex unavailable — return empty
  }

  return null;
}

export async function saveUserNotepad(userId, notes) {
  if (userId == null) throw forbidden();
  if (!Array.isArray(notes)) {
    const err = new Error('Notes must be an array.');
    err.status = 400;
    throw err;
  }
  if (notes.length > 500) {
    const err = new Error('Note Pad can hold at most 500 notes.');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO user_notepads (user_id, notes_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET notes_json = excluded.notes_json, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(notes), now);

  let convexSynced = false;
  try {
    const res = await syncNotepadToConvex(userId, notes, now);
    convexSynced = Boolean(res && (res.id || res.updatedAt));
  } catch {
    convexSynced = false;
  }

  return { updatedAt: now, convexSynced };
}
