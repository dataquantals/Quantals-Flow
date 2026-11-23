import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import {
  syncBoardToConvex,
  fetchBoardsFromConvex,
  fetchBoardFromConvex,
  deleteBoardFromConvex,
  syncProjectPlanToConvex,
  fetchProjectPlanFromConvex,
  deleteProjectPlanFromConvex,
  syncFolderToConvex,
  deleteFolderFromConvex,
  syncFileToConvex,
  moveFileInConvex,
  deleteFileFromConvex,
  syncFileOrderToConvex,
  syncPreferencesToConvex,
  fetchFoldersFromConvex,
  fetchFilesFromConvex,
  fetchFileOrderFromConvex,
  fetchPreferencesFromConvex,
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
    expires_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL DEFAULT 0
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)');

// Rolling idle timeout: every session gets a last_activity stamp on creation.
// The 10-minute inactivity window is enforced in getSessionUser (auth.js).
try { db.exec('ALTER TABLE sessions ADD COLUMN last_activity INTEGER NOT NULL DEFAULT 0'); } catch {}

// Backfill pre-existing rows so they don't get instantly invalidated by the
// new idle check. A session's creation time is the earliest activity we can
// legitimately claim for it; anything older than the 10-minute window was
// already idle and should be re-authenticated.
try {
  db.prepare('UPDATE sessions SET last_activity = created_at WHERE last_activity = 0 OR last_activity IS NULL').run();
} catch {
  /* best-effort: a brand-new DB has nothing to backfill */
}

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
      INSERT INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = CASE WHEN excluded.updated_at >= boards.updated_at THEN excluded.title ELSE boards.title END,
        category = CASE WHEN excluded.updated_at >= boards.updated_at THEN excluded.category ELSE boards.category END,
        starred = CASE WHEN excluded.updated_at >= boards.updated_at THEN excluded.starred ELSE boards.starred END,
        state_json = CASE
          WHEN excluded.state_json != '{}' AND (boards.state_json = '{}' OR excluded.updated_at >= boards.updated_at)
          THEN excluded.state_json
          ELSE boards.state_json
        END,
        updated_at = MAX(boards.updated_at, excluded.updated_at)
      WHERE boards.user_id = excluded.user_id
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
    let rb = await fetchBoardFromConvex(internalId, userId);
    if (!rb && internalId !== String(id)) {
      rb = await fetchBoardFromConvex(String(id), userId);
    }
    if (!rb) return null;
    db.prepare(`
      INSERT INTO boards (id, user_id, title, category, starred, state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = CASE WHEN excluded.updated_at >= boards.updated_at THEN excluded.title ELSE boards.title END,
        category = CASE WHEN excluded.updated_at >= boards.updated_at THEN excluded.category ELSE boards.category END,
        starred = CASE WHEN excluded.updated_at >= boards.updated_at THEN excluded.starred ELSE boards.starred END,
        state_json = CASE
          WHEN excluded.state_json != '{}' AND (boards.state_json = '{}' OR excluded.updated_at >= boards.updated_at)
          THEN excluded.state_json
          ELSE boards.state_json
        END,
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

/** The caller's own boards plus any boards shared with them via board_members or workspace_members. */
export function listBoards({ query = '', starredOnly = false, userId } = {}) {
  if (userId == null) throw forbidden();
  ensureUserBlankBoard(userId);

  let sql = `
    SELECT b.id, b.user_id, b.title, b.category, b.starred, b.state_json, b.created_at, b.updated_at,
           bm.permission AS board_perm,
           wm.permission AS ws_perm,
           u.name AS owner_name,
           u.email AS owner_email
      FROM boards b
      LEFT JOIN board_members bm
        ON bm.board_id = b.id AND bm.member_user_id = ? AND bm.status = 'active'
      LEFT JOIN workspace_members wm
        ON wm.owner_user_id = b.user_id AND wm.member_user_id = ? AND wm.status = 'active'
      LEFT JOIN users u ON u.id = b.user_id
  `;
  const clauses = ['(b.user_id = ? OR bm.id IS NOT NULL OR wm.id IS NOT NULL)'];
  const params = [userId, userId, userId];
  if (starredOnly) {
    clauses.push('b.starred = 1');
  }
  if (query) {
    clauses.push('(b.title LIKE ? OR b.category LIKE ?)');
    params.push(`%${query}%`, `%${query}%`);
  }
  sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY b.updated_at DESC';

  const seen = new Set();
  const results = [];
  for (const row of db.prepare(sql).all(...params)) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    // Do not expose another user's private blank workspace template copy via workspace_members
    if (row.user_id !== userId && USER_SCOPED_BOARD_IDS.has(publicBoardId(row.id)) && !row.board_perm) {
      continue;
    }
    const state = parseStateJson(row.state_json);
    const activeModule = state.activeModule || (state.workspaceMode === 'project-planning' ? 'project-planning' : '');
    const permission = row.user_id === userId ? 'owner' : (row.board_perm || row.ws_perm || 'viewer');
    results.push({
      id: publicBoardId(row.id),
      title: row.title,
      category: row.category,
      starred: Boolean(row.starred),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activeModule,
      hasSavedState: Boolean(row.state_json && row.state_json !== '{}'),
      permission,
      isShared: row.user_id !== userId,
      ownerName: row.owner_name || '',
      ownerEmail: row.owner_email || ''
    });
  }
  return results;
}

/** Resolve a board and the caller's permission (owned, board-shared, or workspace-shared). */
export function resolveBoardAccess(id, userId) {
  if (userId == null) return null;
  if (USER_SCOPED_BOARD_IDS.has(String(id || ''))) {
    ensureUserBlankBoard(userId);
  }
  const scoped = scopeBoardId(id, userId);
  let row = db.prepare('SELECT * FROM boards WHERE id = ?').get(scoped);
  if (row && ownsRow(row, userId)) {
    return { row, internalId: row.id, ownerUserId: row.user_id, ...capabilitiesForRole('owner') };
  }

  // Look up by raw board id for shared boards owned by another user
  const rawId = String(id || '');
  row = db.prepare('SELECT * FROM boards WHERE id = ?').get(rawId);
  if (!row) return null;
  if (ownsRow(row, userId)) {
    return { row, internalId: row.id, ownerUserId: row.user_id, ...capabilitiesForRole('owner') };
  }

  const bm = db.prepare(`
    SELECT permission FROM board_members
     WHERE board_id = ? AND member_user_id = ? AND status = 'active'
     LIMIT 1
  `).get(row.id, userId);
  if (bm) {
    return { row, internalId: row.id, ownerUserId: row.user_id, ...capabilitiesForRole(bm.permission) };
  }

  const wm = db.prepare(`
    SELECT permission FROM workspace_members
     WHERE owner_user_id = ? AND member_user_id = ? AND status = 'active'
     LIMIT 1
  `).get(row.user_id, userId);
  if (wm && !USER_SCOPED_BOARD_IDS.has(publicBoardId(row.id))) {
    return { row, internalId: row.id, ownerUserId: row.user_id, ...capabilitiesForRole(wm.permission) };
  }

  return null;
}

/** A board the caller owns or has been granted access to, or null. */
export function getBoardById(id, userId) {
  const access = resolveBoardAccess(id, userId);
  if (!access) return null;
  const row = access.row;
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
    permission: access.role,
    capabilities: capabilitiesForRole(access.role),
    isShared: row.user_id !== userId,
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
 * Resolve a pretty URL slug back to the board it belongs to (owned or shared).
 */
export function findBoardBySlug(slug, userId) {
  const target = slugify(slug);
  if (!target || userId == null) return null;
  ensureUserBlankBoard(userId);
  const candidates = listBoards({ userId });
  const match = candidates.find((candidate) => slugify(candidate.title) === target);
  return match ? getBoardById(match.id, userId) : null;
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
  const access = resolveBoardAccess(id, userId);
  const internalId = access ? access.internalId : scopeBoardId(id, userId);
  const existing = access ? access.row : db.prepare('SELECT * FROM boards WHERE id = ?').get(internalId);

  if (existing) {
    if (!access || !access.canEdit) {
      const err = new Error('You do not have edit permission for this board.');
      err.status = 403;
      throw err;
    }
  }

  const ownerUserId = existing ? existing.user_id : userId;

  if (!existing) {
    const stateStr = stateJsonFor(internalId, state);
    db.prepare(`
      INSERT INTO boards (id, user_id, title, category, starred, state_json, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      internalId,
      ownerUserId,
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
    `).run(nextTitle, nextCategory, nextStarred, nextStateStr, currentVersion + 1, now, internalId, ownerUserId);
  }
  const saved = getBoardById(id, userId);
  const syncPromise = syncBoardToConvex(saved, ownerUserId, internalId);
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
  const access = resolveBoardAccess(id, userId);
  if (!access) return { removed: false, convex: false };
  if (!access.canDelete) {
    const err = new Error('Only the board Owner or Admin can delete this board.');
    err.status = 403;
    throw err;
  }
  const internalId = access.internalId;
  const ownerUserId = access.ownerUserId;
  const removed = db.prepare('DELETE FROM boards WHERE id = ? AND user_id = ?').run(internalId, ownerUserId).changes > 0;
  if (!removed) return { removed: false, convex: false };

  db.prepare('DELETE FROM project_plans WHERE board_id = ? AND user_id = ?').run(internalId, ownerUserId);
  db.prepare('DELETE FROM board_members WHERE board_id = ?').run(internalId);
  const boardGone = await deleteBoardFromConvex(internalId, ownerUserId);
  const planGone = await deleteProjectPlanFromConvex(internalId, ownerUserId);
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

/**
 * Purge sessions that are expired (absolute wall-clock) or idle beyond the
 * 10-minute inactivity window. The idle check is also enforced on-demand in
 * getSessionUser (auth.js) so a live request never reads a stale session,
 * but this sweep keeps the sessions table from filling up with rows that a
 * browser never bothered to delete.
 */
export function purgeExpiredSessions(now = Date.now()) {
  let changes = db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now).changes;
  try {
    changes += db.prepare('DELETE FROM revoked_sessions WHERE expires_at <= ?').run(now).changes;
  } catch {
    /* table not created yet on an older database */
  }
  try {
    // Idle-expired rows: last_activity older than the rolling window. The
    // constant lives in auth.js (IDLE_TIMEOUT_MS); keep them in sync.
    changes += db.prepare('DELETE FROM sessions WHERE last_activity <= ?').run(now - 600000).changes;
  } catch {
    /* column may not exist on an older schema */
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

function attachConvexSync(target, promise) {
  if (target && promise && typeof target === 'object') {
    Object.defineProperty(target, '_convexSyncPromise', {
      value: promise,
      enumerable: false
    });
  }
  return target;
}

export async function hydrateUserFilesAndFoldersFromConvex(userId) {
  if (userId == null || config.isTest) return;
  try {
    const [remoteFolders, remoteFiles] = await Promise.all([
      fetchFoldersFromConvex(userId),
      fetchFilesFromConvex(userId)
    ]);
    if (Array.isArray(remoteFolders) && remoteFolders.length) {
      const folderStmt = db.prepare(`
        INSERT INTO user_folders (id, user_id, name, parent_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = CASE WHEN excluded.updated_at >= user_folders.updated_at THEN excluded.name ELSE user_folders.name END,
          parent_id = CASE WHEN excluded.updated_at >= user_folders.updated_at THEN excluded.parent_id ELSE user_folders.parent_id END,
          updated_at = MAX(user_folders.updated_at, excluded.updated_at)
        WHERE user_folders.user_id = excluded.user_id
      `);
      for (const rf of remoteFolders) {
        if (!rf || !rf.folderId) continue;
        folderStmt.run(
          String(rf.folderId),
          userId,
          String(rf.name || 'Folder'),
          rf.parentId ? String(rf.parentId) : null,
          Number(rf.createdAt || Date.now()),
          Number(rf.updatedAt || Date.now())
        );
      }
    }
    if (Array.isArray(remoteFiles) && remoteFiles.length) {
      const fileStmt = db.prepare(`
        INSERT INTO user_files (id, user_id, folder_id, name, mime_type, size, extension, url, public_id, resource_type, visibility, uploaded_by, data_base64, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        ON CONFLICT(id) DO UPDATE SET
          folder_id = excluded.folder_id,
          name = excluded.name,
          mime_type = excluded.mime_type,
          size = excluded.size,
          extension = excluded.extension,
          url = CASE WHEN excluded.url != '' THEN excluded.url ELSE user_files.url END,
          public_id = CASE WHEN excluded.public_id != '' THEN excluded.public_id ELSE user_files.public_id END,
          resource_type = excluded.resource_type,
          visibility = excluded.visibility,
          uploaded_by = excluded.uploaded_by
        WHERE user_files.user_id = excluded.user_id
      `);
      for (const rf of remoteFiles) {
        if (!rf || !rf.fileId) continue;
        fileStmt.run(
          String(rf.fileId),
          userId,
          rf.folderId ? String(rf.folderId) : null,
          String(rf.name || 'Untitled'),
          String(rf.mimeType || 'application/octet-stream'),
          Number(rf.size || 0),
          String(rf.extension || ''),
          String(rf.url || ''),
          String(rf.publicId || ''),
          String(rf.resourceType || 'image'),
          String(rf.visibility || 'coordinators'),
          String(rf.uploadedBy || ''),
          Number(rf.createdAt || Date.now())
        );
      }
    }
  } catch (err) {
    console.warn('[db] convex files/folders hydration failed:', err.message);
  }
}

export async function hydrateUserFileOrderFromConvex(userId, folderId = 'root') {
  if (userId == null || config.isTest) return;
  try {
    const fid = String(folderId || 'root').trim() || 'root';
    const remote = await fetchFileOrderFromConvex(userId, fid);
    if (!remote) return;
    db.prepare(`
      INSERT INTO user_file_orders (user_id, folder_id, order_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, folder_id) DO UPDATE SET
        order_json = excluded.order_json,
        updated_at = MAX(user_file_orders.updated_at, excluded.updated_at)
    `).run(userId, fid, JSON.stringify(remote), Date.now());
  } catch {}
}

export async function hydrateUserPreferencesFromConvex(userId) {
  if (userId == null || config.isTest) return;
  try {
    const remote = await fetchPreferencesFromConvex(userId);
    if (!remote) return;
    db.prepare(`
      INSERT INTO user_preferences (user_id, files_view_mode, files_sort_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        files_view_mode = excluded.files_view_mode,
        files_sort_by = excluded.files_sort_by,
        updated_at = MAX(user_preferences.updated_at, excluded.updated_at)
    `).run(userId, remote.filesViewMode, remote.filesSortBy, Date.now());
  } catch {}
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
  return attachConvexSync(folderObj, syncFolderToConvex(folderObj, userId).catch(() => null));
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
  return attachConvexSync({ deleted: true }, deleteFolderFromConvex(cleanKey, userId).catch(() => false));
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
    attachConvexSync(
      publicFile,
      syncFileToConvex({
        ...publicFile,
        extension: file.extension || '',
        publicId: file.publicId || '',
        resourceType: file.resourceType || 'image',
        updatedAt: now
      }, userId).catch(() => null)
    );
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
  const result = { moved: changes > 0, fileId, folderId: dest };
  if (changes > 0) {
    attachConvexSync(result, moveFileInConvex(fileId, dest, userId).catch(() => null));
  }
  return result;
}

export function deleteUserFile(userId, fileId) {
  if (userId == null) throw forbidden();
  const existing = db.prepare('SELECT id, name, public_id, resource_type FROM user_files WHERE id = ? AND user_id = ?')
    .get(String(fileId || ''), userId);
  if (!existing) return null;
  db.prepare('DELETE FROM user_files WHERE id = ? AND user_id = ?').run(existing.id, userId);
  const result = {
    id: existing.id,
    name: existing.name,
    publicId: existing.public_id || '',
    resourceType: existing.resource_type || 'image'
  };
  return attachConvexSync(result, deleteFileFromConvex(existing.id, userId).catch(() => false));
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
  return attachConvexSync(clean, syncFileOrderToConvex(userId, fid, clean).catch(() => null));
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
  return attachConvexSync(next, syncPreferencesToConvex(userId, next).catch(() => null));
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

/* ==========================================================================
   Knowledge Management Hub (Organisational Brain) Persistence & Ecosystem Sync
   ========================================================================== */

db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_hub (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT    NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL
  );
`);

export function getUserKnowledgeHub(userId) {
  if (userId == null) return null;
  const row = db.prepare('SELECT state_json, updated_at FROM knowledge_hub WHERE user_id = ?').get(userId);
  if (!row) return null;
  try {
    const state = JSON.parse(row.state_json);
    if (state && typeof state === 'object') {
      return { state, updatedAt: row.updated_at };
    }
  } catch {}
  return null;
}

export function saveUserKnowledgeHub(userId, state) {
  if (userId == null) throw forbidden();
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    const err = new Error('Knowledge Hub state must be a JSON object.');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO knowledge_hub (user_id, state_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(state), now);
  return { updatedAt: now };
}

/* ==========================================================================
   QuantalFlow Organisational OS 2.0 — Unified Data Model Persistence
   ========================================================================== */

db.exec(`
  CREATE TABLE IF NOT EXISTS os_workspace (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_json TEXT    NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL
  );
`);

export function getUserOsWorkspace(userId) {
  if (userId == null) return null;
  const row = db.prepare('SELECT state_json, updated_at FROM os_workspace WHERE user_id = ?').get(userId);
  if (!row) return null;
  try {
    const state = JSON.parse(row.state_json);
    if (state && typeof state === 'object') {
      return { state, updatedAt: row.updated_at };
    }
  } catch {}
  return null;
}

export function saveUserOsWorkspace(userId, state) {
  if (userId == null) throw forbidden();
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    const err = new Error('Organisational OS state must be a JSON object.');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  db.prepare(`
    INSERT INTO os_workspace (user_id, state_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(state), now);
  return { updatedAt: now };
}

export async function hydrateEcosystemFromConvex(userId, specificBoardIds = []) {
  if (userId == null || config.isTest) return;
  try {
    await hydrateUserBoardsFromConvex(userId);
  } catch {}

  try {
    const idsToHydrate = new Set();
    for (const rawId of (Array.isArray(specificBoardIds) ? specificBoardIds : [])) {
      const clean = String(rawId || '').trim();
      if (clean) idsToHydrate.add(clean);
    }

    // On cold serverless instances (Vercel), hydrate board state_json for recent boards that only have empty '{}'
    const emptyRows = db.prepare(
      "SELECT id FROM boards WHERE (user_id = ? OR user_id IS NULL) AND (state_json IS NULL OR state_json = '{}' OR length(state_json) < 10) ORDER BY updated_at DESC LIMIT 10"
    ).all(userId);
    for (const r of emptyRows) {
      if (r && r.id) idsToHydrate.add(r.id);
    }

    if (idsToHydrate.size) {
      await Promise.allSettled(
        Array.from(idsToHydrate).map((bid) => hydrateBoardFromConvex(bid, userId))
      );
    }

    // Hydrate project plans from Convex for specifically requested boards if not already cached locally
    if (Array.isArray(specificBoardIds) && specificBoardIds.length) {
      await Promise.allSettled(
        specificBoardIds.map(async (rawId) => {
          const bid = String(rawId || '').trim();
          if (!bid) return;
          const scoped = scopeBoardId(bid, userId);
          const existing = db.prepare('SELECT 1 AS ok FROM project_plans WHERE board_id IN (?, ?)').get(bid, scoped);
          if (existing) return;
          const remotePlan = await fetchProjectPlanFromConvex(scoped, userId) || await fetchProjectPlanFromConvex(bid, userId);
          if (remotePlan && typeof remotePlan === 'object') {
            const now = Date.now();
            db.prepare(`
              INSERT INTO project_plans (board_id, user_id, plan_json, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(board_id) DO UPDATE SET plan_json = excluded.plan_json, updated_at = excluded.updated_at
            `).run(scoped, userId, JSON.stringify(remotePlan), now, now);
          }
        })
      );
    }
  } catch (err) {
    console.warn('[db] hydrateEcosystemFromConvex failed:', err.message);
  }
}

export function getKnowledgeEcosystemSnapshot(userId) {
  const boards = [];
  const workspaceDocs = [];
  const projects = [];
  const files = [];
  const notes = [];
  const members = [];

  try {
    const boardRows = db.prepare(
      'SELECT id, title, category, starred, state_json, created_at, updated_at FROM boards WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC LIMIT 80'
    ).all(userId);
    for (const r of boardRows) {
      let mode = 'whiteboard';
      let enabledModules = [];
      let parsed = null;
      try {
        parsed = JSON.parse(r.state_json || '{}');
        if (parsed.workspaceMode) mode = String(parsed.workspaceMode);
        else if (parsed.module) mode = String(parsed.module);
        else if (parsed.template) mode = String(parsed.template);
        if (Array.isArray(parsed.enabledModules)) {
          enabledModules = parsed.enabledModules.map((m) => String(m || '').toLowerCase()).filter(Boolean);
        }
      } catch {}

      boards.push({
        id: r.id,
        title: r.title || 'Untitled Board',
        category: r.category || 'Workspace',
        mode,
        enabledModules,
        starred: Boolean(r.starred),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      });

      // Extract embedded workspace documents (e.g. Perspective / Brainstorm / Whiteboard doc items)
      if (parsed && typeof parsed === 'object') {
        const seenDocKey = new Set();
        const scanItemsForDocs = (list, modKey) => {
          if (!Array.isArray(list)) return;
          list.forEach((item, idx) => {
            if (!item || typeof item !== 'object') return;
            if (item.doc && typeof item.doc === 'object') {
              const docTitle = String(item.doc.title || '').trim();
              const plain = stripHtmlPreserveStructure(item.doc.html || item.doc.text || item.doc.content || '');
              if (docTitle || plain.length > 20) {
                const dedupeKey = `${r.id}|${modKey}|${(docTitle || '').toLowerCase()}`;
                if (!seenDocKey.has(dedupeKey)) {
                  seenDocKey.add(dedupeKey);
                  workspaceDocs.push({
                    id: `doc:${r.id}:${modKey}:${item.id || idx}`,
                    boardId: r.id,
                    boardTitle: r.title || 'Untitled Board',
                    moduleKey: modKey,
                    itemId: String(item.id || ''),
                    title: docTitle || `${r.title || 'Workspace'} (${modKey})`,
                    textLength: plain.length,
                    updatedAt: r.updated_at
                  });
                }
              }
            }
          });
        };

        if (parsed.modules && typeof parsed.modules === 'object') {
          for (const [modKey, modVal] of Object.entries(parsed.modules)) {
            if (modVal && typeof modVal === 'object') {
              scanItemsForDocs(modVal.items, String(modKey).toLowerCase());
            }
          }
        }
        const activeMod = String(parsed.activeModule || mode || 'whiteboard').toLowerCase();
        scanItemsForDocs(parsed.items, activeMod);
      }
    }
  } catch {}

  try {
    const planRows = db.prepare(
      'SELECT board_id, plan_json, created_at, updated_at FROM project_plans ORDER BY updated_at DESC LIMIT 30'
    ).all();
    for (const r of planRows) {
      try {
        const plan = JSON.parse(r.plan_json || '{}');
        const title = (plan.meta && plan.meta.title) || plan.title || r.board_id;
        const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
        const wikiPages = Array.isArray(plan.wikiPages) ? plan.wikiPages : [];
        const raid = Array.isArray(plan.raidItems) ? plan.raidItems : [];
        projects.push({
          id: r.board_id,
          title,
          status: (plan.meta && plan.meta.status) || 'Active',
          taskCount: tasks.length,
          wikiCount: wikiPages.length,
          riskCount: raid.length,
          tasks: tasks.slice(0, 12).map((t) => ({
            id: t.id || '',
            title: t.title || t.name || 'Task',
            status: t.status || 'todo',
            assignee: t.assignee || t.owner || ''
          })),
          wikiPages: wikiPages.slice(0, 10).map((w) => ({
            id: w.id || '',
            title: w.title || 'Wiki Page',
            content: String(w.content || '').slice(0, 300)
          })),
          updatedAt: r.updated_at
        });
      } catch {}
    }
  } catch {}

  try {
    const fileRows = db.prepare(
      'SELECT id, name, mime_type, size_bytes, secure_url, folder_id, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 60'
    ).all(userId);
    for (const f of fileRows) {
      files.push({
        id: f.id,
        name: f.name || 'Untitled File',
        mimeType: f.mime_type || 'application/octet-stream',
        sizeBytes: f.size_bytes || 0,
        url: f.secure_url || '',
        folderId: f.folder_id || '',
        createdAt: f.created_at
      });
    }
  } catch {}

  try {
    const noteRow = db.prepare('SELECT notes_json, updated_at FROM user_notepads WHERE user_id = ?').get(userId);
    if (noteRow && noteRow.notes_json) {
      const parsed = JSON.parse(noteRow.notes_json);
      if (Array.isArray(parsed)) {
        for (const n of parsed.slice(0, 30)) {
          notes.push({
            id: n.id || '',
            title: n.title || 'Note Pad Entry',
            body: String(n.text || n.content || '').slice(0, 280),
            updatedAt: n.updatedAt || noteRow.updated_at
          });
        }
      }
    }
  } catch {}

  try {
    const userRows = db.prepare('SELECT id, name, email, role, title, company FROM users LIMIT 40').all();
    for (const u of userRows) {
      members.push({
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role || 'member',
        title: u.title || '',
        company: u.company || ''
      });
    }
  } catch {}

  return { boards, workspaceDocs, projects, files, notes, members, syncedAt: Date.now() };
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 65536 ? String.fromCharCode(code) : '';
    });
}

function stripHtmlTags(raw) {
  return decodeHtmlEntities(
    String(raw || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlPreserveStructure(raw) {
  return decodeHtmlEntities(
    String(raw || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|blockquote|section|article)>/gi, '\n')
      .replace(/<(li)[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const STARTER_PLACEHOLDER_RE = /^\[(frame|shape|text|sticky)\]\s*(Mind Map|Main Idea|Topic [1-4]|Kanban Board|TO DO|IN PROGRESS|DONE|Task [1-2]|In progress\.{0,3}|In progress…|Completed\.{0,3}|Completed…)$/i;

function isStarterPlaceholder(line) {
  return STARTER_PLACEHOLDER_RE.test(String(line || '').trim());
}

function collectItemsText(list, outLines, seen, opts) {
  if (!Array.isArray(list)) return;
  const targetItemId = opts && opts.targetItemId ? String(opts.targetItemId) : '';
  const targetDocTitle = opts && opts.targetDocTitle ? String(opts.targetDocTitle).toLowerCase() : '';

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;

    // 1. Rich embedded document cards (item.doc = { title, html, ... })
    if (item.doc && typeof item.doc === 'object') {
      const docTitle = String(item.doc.title || '').trim();
      const docBody = stripHtmlPreserveStructure(item.doc.html || item.doc.text || item.doc.content || '');
      const matchesTarget =
        (!targetItemId && !targetDocTitle) ||
        (targetItemId && String(item.id || '') === targetItemId) ||
        (targetDocTitle && docTitle.toLowerCase() === targetDocTitle);

      if (matchesTarget && (docTitle || docBody)) {
        const block = (docTitle ? `[Document: ${docTitle}]\n` : '[Document]\n') + docBody;
        const sig = block.slice(0, 300);
        if (!seen.has(sig)) {
          seen.add(sig);
          outLines.push(block);
        }
      }
      continue;
    }

    if (targetItemId || targetDocTitle) continue;

    // 2. Embedded table / spreadsheet cards
    if (item.table && typeof item.table === 'object' && Array.isArray(item.table.cells)) {
      const rows = item.table.cells
        .map((row) => (Array.isArray(row) ? row.map((c) => stripHtmlTags(c)).filter(Boolean).join(' | ') : ''))
        .filter(Boolean);
      if (rows.length) {
        const tblLine = '[Table]\n' + rows.slice(0, 30).join('\n');
        if (!seen.has(tblLine)) {
          seen.add(tblLine);
          outLines.push(tblLine);
        }
      }
      continue;
    }

    const parts = [];
    const kind = item.type || item.kind || item.shape || '';
    const title = String(item.title || item.label || item.name || '').trim();
    const text = stripHtmlTags(item.text || item.content || item.body || item.description || item.note || item.html || '');
    if (title) parts.push(title);
    if (text && text !== title) parts.push(text);
    if (item.decision && typeof item.decision === 'object') {
      const decBits = [item.decision.summary, item.decision.discussion, item.decision.approval ? `Status: ${item.decision.approval}` : ''].filter(Boolean);
      if (decBits.length) parts.push(decBits.join(' — '));
    }
    if (Array.isArray(item.items) && item.items.length) {
      const sub = item.items.map((x) => (typeof x === 'string' ? x : (x && (x.title || x.text || x.label || '')))).filter(Boolean);
      if (sub.length) parts.push(sub.join('; '));
    }
    if (parts.length) {
      const line = (kind ? `[${kind}] ` : '') + parts.join(' — ');
      if (!seen.has(line)) {
        seen.add(line);
        outLines.push(line);
      }
    }
  }
}

function extractBoardContentLines(stateJson, options) {
  const opts = options || {};
  const preferredModule = opts.preferredModule ? String(opts.preferredModule).toLowerCase() : '';
  const targetItemId = opts.targetItemId ? String(opts.targetItemId) : '';
  const targetDocTitle = opts.targetDocTitle ? String(opts.targetDocTitle).trim() : '';

  const lines = [];
  const seen = new Set();
  if (!stateJson || stateJson === '{}') return lines;
  let state;
  try {
    state = typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson;
  } catch {
    return lines;
  }
  if (!state || typeof state !== 'object') return lines;

  // If targeting a specific doc item / module, extract it directly first
  if (targetItemId || targetDocTitle) {
    const targetLines = [];
    const targetSeen = new Set();
    if (preferredModule && state.modules && state.modules[preferredModule]) {
      collectItemsText(state.modules[preferredModule].items, targetLines, targetSeen, { targetItemId, targetDocTitle });
    }
    if (!targetLines.length && state.modules && typeof state.modules === 'object') {
      for (const modVal of Object.values(state.modules)) {
        if (modVal && typeof modVal === 'object') {
          collectItemsText(modVal.items, targetLines, targetSeen, { targetItemId, targetDocTitle });
        }
      }
    }
    if (!targetLines.length) {
      collectItemsText(state.items, targetLines, targetSeen, { targetItemId, targetDocTitle });
    }
    if (targetLines.length) return targetLines;
  }

  if (state.title && String(state.title).trim()) {
    lines.push(`Workspace Title: ${String(state.title).trim()}`);
  }
  if (state.description && String(state.description).trim()) {
    lines.push(`Description: ${String(state.description).trim()}`);
  }

  // If a preferred module (e.g. 'perspective', 'brainstorm') was requested, prioritize its content first
  if (preferredModule && state.modules && state.modules[preferredModule]) {
    const modVal = state.modules[preferredModule];
    const modLines = [];
    const modSeen = new Set();
    collectItemsText(modVal.items, modLines, modSeen);
    collectItemsText(modVal.elements, modLines, modSeen);
    collectItemsText(modVal.objects, modLines, modSeen);
    if (modVal.whiteboardState && typeof modVal.whiteboardState === 'object') {
      collectItemsText(modVal.whiteboardState.objects, modLines, modSeen);
      collectItemsText(modVal.whiteboardState.items, modLines, modSeen);
    }
    const realModLines = modLines.filter((l) => !isStarterPlaceholder(l));
    if (realModLines.length) {
      lines.push(`Module (${preferredModule}):`);
      for (const l of realModLines) {
        const sig = l.slice(0, 300);
        if (!seen.has(sig)) {
          seen.add(sig);
          lines.push(l);
        }
      }
      return lines;
    }
  }

  collectItemsText(state.items, lines, seen);
  collectItemsText(state.elements, lines, seen);
  collectItemsText(state.objects, lines, seen);

  if (state.whiteboardState && typeof state.whiteboardState === 'object') {
    collectItemsText(state.whiteboardState.objects, lines, seen);
    collectItemsText(state.whiteboardState.items, lines, seen);
  }

  if (state.modules && typeof state.modules === 'object') {
    for (const [modKey, modVal] of Object.entries(state.modules)) {
      if (!modVal || typeof modVal !== 'object') continue;
      const modLines = [];
      const modSeen = new Set();
      collectItemsText(modVal.items, modLines, modSeen);
      collectItemsText(modVal.elements, modLines, modSeen);
      collectItemsText(modVal.objects, modLines, modSeen);
      if (modVal.whiteboardState && typeof modVal.whiteboardState === 'object') {
        collectItemsText(modVal.whiteboardState.objects, modLines, modSeen);
        collectItemsText(modVal.whiteboardState.items, modLines, modSeen);
      }
      if (modVal.docHtml || modVal.html || modVal.text) {
        const docTxt = stripHtmlPreserveStructure(modVal.docHtml || modVal.html || modVal.text);
        if (docTxt) modLines.push(docTxt.slice(0, 4000));
      }
      const filteredMod = modLines.filter((l) => !isStarterPlaceholder(l));
      if (filteredMod.length) {
        lines.push(`Module (${modKey}):`);
        for (const l of filteredMod) {
          const sig = l.slice(0, 300);
          if (!seen.has(sig)) {
            seen.add(sig);
            lines.push(l);
          }
        }
      }
    }
  }

  // Strip starter template placeholders if any real user content exists
  const nonPlaceholder = lines.filter((l) => !isStarterPlaceholder(l));
  const hasRealContent = nonPlaceholder.some((l) => !/^Workspace Title:/i.test(l) && !/^Module \(/i.test(l));
  return hasRealContent ? nonPlaceholder : [];
}

function extractProjectPlanLines(planJson) {
  const lines = [];
  if (!planJson) return lines;
  let plan;
  try {
    plan = typeof planJson === 'string' ? JSON.parse(planJson) : planJson;
  } catch {
    return lines;
  }
  if (!plan || typeof plan !== 'object') return lines;

  const pName = (plan.meta && plan.meta.title) || plan.projectName || plan.title || '';
  const pDesc = (plan.meta && plan.meta.description) || plan.projectDescription || '';
  if (pName) lines.push(`Project: ${pName}`);
  if (pDesc) lines.push(`Project Overview: ${pDesc}`);

  if (Array.isArray(plan.wbsPhases) && plan.wbsPhases.length) {
    lines.push(`Phases: ${plan.wbsPhases.map((p) => `${p.wbs || ''} ${p.title || ''}`.trim()).filter(Boolean).join(' | ')}`);
  }
  if (Array.isArray(plan.tasks) && plan.tasks.length) {
    lines.push('Tasks:');
    for (const t of plan.tasks.slice(0, 40)) {
      const bits = [t.id, t.title || t.name, t.status ? `status=${t.status}` : '', t.priority ? `priority=${t.priority}` : '', t.assignee || t.owner || ''].filter(Boolean);
      if (bits.length) lines.push(`  - ${bits.join(' | ')}`);
    }
  }
  if (Array.isArray(plan.milestones) && plan.milestones.length) {
    lines.push('Milestones:');
    for (const m of plan.milestones.slice(0, 20)) {
      lines.push(`  - ${m.title || 'Milestone'} (${m.status || 'planned'}${m.owner ? `, owner: ${m.owner}` : ''})`);
    }
  }
  if (Array.isArray(plan.raidItems) && plan.raidItems.length) {
    lines.push('Risks & Issues:');
    for (const r of plan.raidItems.slice(0, 20)) {
      lines.push(`  - [${r.type || 'Risk'}] ${r.title || ''}${r.mitigation ? ` — Mitigation: ${r.mitigation}` : ''}`);
    }
  }
  if (Array.isArray(plan.wikiPages) && plan.wikiPages.length) {
    lines.push('Project Notes & Wiki:');
    for (const w of plan.wikiPages.slice(0, 10)) {
      const body = stripHtmlTags(w.content || '');
      if (w.title || body) lines.push(`  - ${w.title || 'Note'}: ${body.slice(0, 500)}`);
    }
  }
  return lines;
}

export function getDocumentSourceContext(userId, sourceCategory, selectedItems) {
  const refs = Array.isArray(selectedItems) ? selectedItems : [];
  const results = [];
  const missingOrEmptyTitles = [];
  const contextBlocks = [];

  let knowledgeState = null;
  try {
    const kRow = db.prepare('SELECT state_json FROM knowledge_hub WHERE user_id = ?').get(userId);
    if (kRow && kRow.state_json) knowledgeState = JSON.parse(kRow.state_json);
  } catch {}

  let userNotes = [];
  try {
    const nRow = db.prepare('SELECT notes_json FROM user_notepads WHERE user_id = ?').get(userId);
    if (nRow && nRow.notes_json) {
      const parsed = JSON.parse(nRow.notes_json);
      if (Array.isArray(parsed)) userNotes = parsed;
    }
  } catch {}

  for (const rawRef of refs) {
    const refId = typeof rawRef === 'object' && rawRef ? String(rawRef.id || '').trim() : '';
    const refTitle = typeof rawRef === 'object' && rawRef ? String(rawRef.title || rawRef.label || '').trim() : String(rawRef || '').trim();
    let refBoardId = typeof rawRef === 'object' && rawRef ? String(rawRef.boardId || '').trim() : '';
    let refModuleKey = typeof rawRef === 'object' && rawRef ? String(rawRef.moduleKey || '').trim().toLowerCase() : '';
    let refItemId = typeof rawRef === 'object' && rawRef ? String(rawRef.itemId || '').trim() : '';

    // Parse structured doc ref IDs: "doc:<boardId>:<moduleKey>:<itemId>"
    if (refId.startsWith('doc:')) {
      const parts = refId.split(':');
      if (!refBoardId && parts[1]) refBoardId = parts[1];
      if (!refModuleKey && parts[2]) refModuleKey = parts[2].toLowerCase();
      if (!refItemId && parts.length > 3) refItemId = parts.slice(3).join(':');
    }
    // Resolve Knowledge Hub auto-synced board IDs: "ECO-BRD-<boardId>"
    if (!refBoardId && refId.startsWith('ECO-BRD-')) {
      refBoardId = refId.slice('ECO-BRD-'.length);
    }

    const label = refTitle || refId || 'Selected Item';
    const lines = [];
    let found = false;

    // 1. Check boards (by refBoardId / refId — both raw and user-scoped — then exact title, then embedded doc.title across user boards)
    let boardRow = null;
    try {
      const lookupBoardId = refBoardId || (refId && !refId.startsWith('doc:') ? refId : '');
      if (lookupBoardId) {
        const scopedId = scopeBoardId(lookupBoardId, userId);
        const baseId = lookupBoardId.includes('~') ? lookupBoardId.split('~')[0] : lookupBoardId;
        boardRow = db.prepare(
          'SELECT id, title, category, state_json FROM boards WHERE id IN (?, ?, ?) AND (user_id = ? OR user_id IS NULL) ORDER BY length(state_json) DESC LIMIT 1'
        ).get(lookupBoardId, scopedId, baseId, userId);
      }
      if (!boardRow && refTitle) {
        boardRow = db.prepare(
          'SELECT id, title, category, state_json FROM boards WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND (user_id = ? OR user_id IS NULL) ORDER BY updated_at DESC LIMIT 1'
        ).get(refTitle, userId);
      }
      // Search inside boards' embedded doc titles (e.g. "14 One-Person AI Business Ideas to Escape Your 9-5")
      if (!boardRow && refTitle) {
        const candidateBoards = db.prepare(
          'SELECT id, title, category, state_json FROM boards WHERE (user_id = ? OR user_id IS NULL) AND state_json LIKE ? ORDER BY updated_at DESC LIMIT 10'
        ).all(userId, `%${refTitle}%`);
        if (candidateBoards.length) {
          boardRow = candidateBoards[0];
        }
      }
    } catch {}

    if (boardRow) {
      found = true;
      const preferredMod = refModuleKey || (
        ['perspective', 'brainstorm', 'whiteboard', 'mindmap', 'kanban'].includes(String(sourceCategory || '').toLowerCase())
          ? String(sourceCategory).toLowerCase()
          : ''
      );
      const bLines = extractBoardContentLines(boardRow.state_json, {
        preferredModule: preferredMod,
        targetItemId: refItemId,
        targetDocTitle: (refId.startsWith('doc:') || (refTitle && boardRow.title && refTitle.toLowerCase() !== boardRow.title.trim().toLowerCase())) ? refTitle : ''
      });
      lines.push(...bLines);

      // Also check linked project plan for this board if no rich doc content already found or source is projects
      if (!lines.length || sourceCategory === 'projects' || sourceCategory === 'tasks') {
        try {
          const planRow = db.prepare('SELECT plan_json FROM project_plans WHERE board_id = ?').get(boardRow.id);
          if (planRow && planRow.plan_json) {
            lines.push(...extractProjectPlanLines(planRow.plan_json));
          }
        } catch {}
      }
    }

    // 2. Check project_plans directly if not already loaded via board
    if (!lines.length && (sourceCategory === 'projects' || sourceCategory === 'tasks' || refId || refTitle)) {
      try {
        let planRow = refId ? db.prepare('SELECT board_id, plan_json FROM project_plans WHERE board_id = ?').get(refId) : null;
        if (!planRow && refTitle) {
          const allPlans = db.prepare('SELECT board_id, plan_json FROM project_plans ORDER BY updated_at DESC LIMIT 40').all();
          for (const p of allPlans) {
            try {
              const pj = JSON.parse(p.plan_json || '{}');
              const pt = (pj.meta && pj.meta.title) || pj.projectName || pj.title || '';
              if (pt && pt.trim().toLowerCase() === refTitle.toLowerCase()) {
                planRow = p;
                break;
              }
            } catch {}
          }
        }
        if (planRow && planRow.plan_json) {
          found = true;
          lines.push(...extractProjectPlanLines(planRow.plan_json));
        }
      } catch {}
    }

    // 3. Check Knowledge Hub objects / decisions / sops
    if (knowledgeState && typeof knowledgeState === 'object') {
      const pools = [
        ...(Array.isArray(knowledgeState.objects) ? knowledgeState.objects : []),
        ...(Array.isArray(knowledgeState.decisions) ? knowledgeState.decisions : []),
        ...(Array.isArray(knowledgeState.sops) ? knowledgeState.sops : [])
      ];
      const matchObj = pools.find((o) => o && (
        (refId && String(o.id || '') === refId) ||
        (refTitle && String(o.title || '').trim().toLowerCase() === refTitle.toLowerCase())
      ));
      if (matchObj) {
        found = true;
        if (matchObj.type) lines.push(`Type: ${matchObj.type}`);
        if (matchObj.department) lines.push(`Department: ${matchObj.department}`);
        if (matchObj.owner) lines.push(`Owner: ${matchObj.owner}`);
        if (matchObj.description) lines.push(`Description: ${stripHtmlTags(matchObj.description)}`);
        if (matchObj.content) lines.push(`Content: ${stripHtmlTags(matchObj.content)}`);
        if (matchObj.rationale) lines.push(`Rationale: ${stripHtmlTags(matchObj.rationale)}`);
        if (Array.isArray(matchObj.steps) && matchObj.steps.length) {
          lines.push(`Steps: ${matchObj.steps.map((s) => (typeof s === 'string' ? s : (s.title || s.text || ''))).filter(Boolean).join(' -> ')}`);
        }
      }
    }

    // 4. Check Note Pad entries
    if (userNotes.length) {
      const matchNote = userNotes.find((n) => n && (
        (refId && String(n.id || '') === refId) ||
        (refTitle && String(n.title || '').trim().toLowerCase() === refTitle.toLowerCase())
      ));
      if (matchNote) {
        found = true;
        const body = stripHtmlTags(matchNote.text || matchNote.content || '');
        if (body) lines.push(`Note Content: ${body}`);
      }
    }

    // Filter out trivial header-only lines like "Workspace Title: X" when checking if there's real content
    const meaningfulLines = lines.filter((l) => !/^Workspace Title:/i.test(l));
    const hasContent = meaningfulLines.length > 0;

    if (!found || !hasContent) {
      missingOrEmptyTitles.push(label);
    } else {
      contextBlocks.push(`=== SOURCE ITEM: ${label} (${sourceCategory || 'workspace'}) ===\n${lines.join('\n')}`);
    }

    results.push({
      id: (boardRow && boardRow.id) || refId || '',
      title: label,
      found,
      hasContent,
      lineCount: meaningfulLines.length
    });
  }

  return {
    items: results,
    missingOrEmptyTitles,
    combinedContext: contextBlocks.join('\n\n')
  };
}

/* ==========================================================================
   Email-Based Member Collaboration, Invitations & Owner RBAC
   ========================================================================== */

db.exec(`
  CREATE TABLE IF NOT EXISTS workspace_members (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email          TEXT    NOT NULL COLLATE NOCASE,
    permission     TEXT    NOT NULL DEFAULT 'viewer',
    status         TEXT    NOT NULL DEFAULT 'pending',
    invited_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    UNIQUE(owner_user_id, email)
  );
  CREATE INDEX IF NOT EXISTS idx_ws_members_owner  ON workspace_members(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_ws_members_member ON workspace_members(member_user_id);
  CREATE INDEX IF NOT EXISTS idx_ws_members_email  ON workspace_members(email);

  CREATE TABLE IF NOT EXISTS board_members (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id       TEXT    NOT NULL,
    owner_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email          TEXT    NOT NULL COLLATE NOCASE,
    permission     TEXT    NOT NULL DEFAULT 'viewer',
    status         TEXT    NOT NULL DEFAULT 'pending',
    invited_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    UNIQUE(board_id, email)
  );
  CREATE INDEX IF NOT EXISTS idx_board_members_board  ON board_members(board_id);
  CREATE INDEX IF NOT EXISTS idx_board_members_member ON board_members(member_user_id);
  CREATE INDEX IF NOT EXISTS idx_board_members_email  ON board_members(email);

  CREATE TABLE IF NOT EXISTS invitations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    token            TEXT    NOT NULL UNIQUE,
    scope            TEXT    NOT NULL DEFAULT 'workspace',
    owner_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_id         TEXT,
    email            TEXT    NOT NULL COLLATE NOCASE,
    permission       TEXT    NOT NULL DEFAULT 'viewer',
    status           TEXT    NOT NULL DEFAULT 'pending',
    invited_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    accepted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at       INTEGER NOT NULL,
    expires_at       INTEGER NOT NULL,
    accepted_at      INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
  CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
`);

export const VALID_MEMBER_PERMISSIONS = ['admin', 'editor', 'commenter', 'viewer'];
const ROLE_RANK = { owner: 5, admin: 4, editor: 3, commenter: 2, viewer: 1 };
const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer'
};

export function normalizePermission(value, fallback = 'viewer') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'can edit' || raw === 'edit') return 'editor';
  if (raw === 'can comment' || raw === 'comment') return 'commenter';
  if (raw === 'can view' || raw === 'view' || raw === 'read') return 'viewer';
  if (VALID_MEMBER_PERMISSIONS.includes(raw)) return raw;
  return fallback;
}

export function capabilitiesForRole(rawRole) {
  const role = ROLE_RANK[String(rawRole || '').toLowerCase()] ? String(rawRole).toLowerCase() : 'viewer';
  return {
    role,
    label: ROLE_LABELS[role] || 'Viewer',
    canView: true,
    canComment: role === 'owner' || role === 'admin' || role === 'editor' || role === 'commenter',
    canEdit: role === 'owner' || role === 'admin' || role === 'editor',
    canManageMembers: role === 'owner' || role === 'admin',
    canDelete: role === 'owner' || role === 'admin',
    canManageAdminFolders: role === 'owner' || role === 'admin'
  };
}

export function getEffectiveWorkspaceRole(user) {
  if (!user) return 'viewer';
  if (user.role === 'owner') return 'owner';
  // Check if user has been invited into an owner's workspace
  const memberships = db.prepare(`
    SELECT permission FROM workspace_members
     WHERE member_user_id = ? AND status = 'active'
  `).all(user.id);
  if (memberships.length > 0) {
    let best = 'viewer';
    for (const m of memberships) {
      const p = normalizePermission(m.permission, 'viewer');
      if ((ROLE_RANK[p] || 0) > (ROLE_RANK[best] || 0)) best = p;
    }
    return best;
  }
  // Check if user has any board-level collaborator permissions
  const boardShares = db.prepare(`
    SELECT permission FROM board_members
     WHERE member_user_id = ? AND status = 'active'
  `).all(user.id);
  if (boardShares.length > 0) {
    let best = 'viewer';
    for (const b of boardShares) {
      const p = normalizePermission(b.permission, 'viewer');
      if ((ROLE_RANK[p] || 0) > (ROLE_RANK[best] || 0)) best = p;
    }
    return best;
  }
  // Standalone account owner of their own workspace
  return user.role === 'admin' ? 'admin' : 'owner';
}

export function isWorkspaceAdminOrOwner(user) {
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'admin') return true;
  const adminMembership = db.prepare(`
    SELECT id FROM workspace_members
     WHERE member_user_id = ? AND status = 'active' AND permission = 'admin'
     LIMIT 1
  `).get(user.id);
  return Boolean(adminMembership);
}

/** Auto-accept all pending workspace and board invitations matching a user's email. */
export function acceptPendingInvitationsForUser(user) {
  if (!user || !user.id || !user.email) return { accepted: 0 };
  const email = String(user.email).trim().toLowerCase();
  const now = Date.now();

  const wsChanges = db.prepare(`
    UPDATE workspace_members
       SET member_user_id = ?, status = 'active', updated_at = ?
     WHERE LOWER(email) = ? AND (status = 'pending' OR member_user_id IS NULL)
  `).run(user.id, now, email).changes;

  const boardChanges = db.prepare(`
    UPDATE board_members
       SET member_user_id = ?, status = 'active', updated_at = ?
     WHERE LOWER(email) = ? AND (status = 'pending' OR member_user_id IS NULL)
  `).run(user.id, now, email).changes;

  const invChanges = db.prepare(`
    UPDATE invitations
       SET status = 'accepted', accepted_user_id = ?, accepted_at = ?
     WHERE LOWER(email) = ? AND status = 'pending' AND expires_at > ?
  `).run(user.id, now, email, now).changes;

  return { accepted: wsChanges + boardChanges + invChanges };
}

function parseEmailList(input) {
  const rawList = Array.isArray(input)
    ? input
    : String(input || '').split(/[\s,;]+/);
  const seen = new Set();
  const valid = [];
  const invalid = [];
  for (const item of rawList) {
    const email = String(item || '').trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid.push(email);
      continue;
    }
    if (!seen.has(email)) {
      seen.add(email);
      valid.push(email);
    }
  }
  return { valid, invalid };
}

/** Resolve which workspace owner_user_id a caller manages (their own, or the workspace where they are Admin). */
function resolveManagedWorkspaceOwnerId(actorUserId) {
  const actor = db.prepare('SELECT id, role FROM users WHERE id = ?').get(actorUserId);
  if (!actor) return { ownerUserId: actorUserId, actorRole: 'viewer' };
  const asAdmin = db.prepare(`
    SELECT owner_user_id FROM workspace_members
     WHERE member_user_id = ? AND status = 'active' AND permission = 'admin'
     ORDER BY created_at ASC LIMIT 1
  `).get(actorUserId);
  if (actor.role !== 'owner' && asAdmin) {
    return { ownerUserId: asAdmin.owner_user_id, actorRole: 'admin' };
  }
  return { ownerUserId: actorUserId, actorRole: 'owner' };
}

export function listWorkspaceMembers(actorUserId) {
  const actor = db.prepare('SELECT id, email, name, role, avatar_url FROM users WHERE id = ?').get(actorUserId);
  if (!actor) throw forbidden();

  const effectiveRole = getEffectiveWorkspaceRole(actor);
  // If user is invited into an owner's workspace, show that workspace's roster; otherwise their own.
  const membership = db.prepare(`
    SELECT owner_user_id, permission FROM workspace_members
     WHERE member_user_id = ? AND status = 'active'
     ORDER BY created_at ASC LIMIT 1
  `).get(actorUserId);

  const ownerUserId = (actor.role !== 'owner' && membership) ? membership.owner_user_id : actorUserId;
  const owner = db.prepare('SELECT id, email, name, role, avatar_url FROM users WHERE id = ?').get(ownerUserId);

  const rows = db.prepare(`
    SELECT wm.id, wm.owner_user_id, wm.member_user_id, wm.email, wm.permission, wm.status,
           wm.created_at, wm.updated_at,
           u.name AS user_name, u.avatar_url AS user_avatar,
           inv.token AS invite_token
      FROM workspace_members wm
      LEFT JOIN users u ON u.id = wm.member_user_id
      LEFT JOIN invitations inv
        ON inv.scope = 'workspace' AND inv.owner_user_id = wm.owner_user_id
       AND LOWER(inv.email) = LOWER(wm.email) AND inv.status = 'pending'
     WHERE wm.owner_user_id = ?
     ORDER BY CASE WHEN wm.status = 'active' THEN 0 ELSE 1 END, wm.created_at DESC
  `).all(ownerUserId);

  const members = [];
  if (owner) {
    members.push({
      id: `owner-${owner.id}`,
      userId: owner.id,
      email: owner.email,
      name: owner.name || owner.email,
      avatarUrl: owner.avatar_url || '',
      permission: 'owner',
      permissionLabel: 'Owner',
      status: 'active',
      isOwner: true
    });
  }
  for (const r of rows) {
    const perm = normalizePermission(r.permission, 'viewer');
    members.push({
      id: r.id,
      userId: r.member_user_id || null,
      email: r.email,
      name: r.user_name || r.email.split('@')[0],
      avatarUrl: r.user_avatar || '',
      permission: perm,
      permissionLabel: ROLE_LABELS[perm] || 'Viewer',
      status: r.status === 'active' ? 'active' : 'pending',
      inviteToken: r.status === 'pending' ? (r.invite_token || null) : null,
      isOwner: false,
      createdAt: r.created_at
    });
  }

  const canManage = ownerUserId === actorUserId || (membership && membership.permission === 'admin');
  return {
    ownerUserId,
    effectiveRole,
    effectiveRoleLabel: ROLE_LABELS[effectiveRole] || 'Owner',
    canManage,
    members
  };
}

export function inviteWorkspaceMembers({ actorUserId, emails, permission = 'editor' }) {
  const { ownerUserId, actorRole } = resolveManagedWorkspaceOwnerId(actorUserId);
  if (!capabilitiesForRole(actorRole).canManageMembers) {
    throw forbidden('Only the Owner or an Admin can invite workspace members.');
  }

  const perm = normalizePermission(permission, '');
  if (!perm) {
    const err = new Error('Invalid permission. Choose Admin, Can Edit, Can Comment, or Can View.');
    err.status = 400;
    throw err;
  }

  const { valid, invalid } = parseEmailList(emails);
  if (!valid.length) {
    const err = new Error(invalid.length ? `Invalid email address: ${invalid[0]}` : 'Please enter at least one valid email address.');
    err.status = 400;
    throw err;
  }

  const owner = db.prepare('SELECT id, email FROM users WHERE id = ?').get(ownerUserId);
  const now = Date.now();
  const expiresAt = now + 14 * 24 * 60 * 60 * 1000;
  const results = [];

  for (const email of valid) {
    if (owner && String(owner.email || '').toLowerCase() === email) {
      results.push({ email, skipped: true, reason: 'Already workspace owner.' });
      continue;
    }

    const existingUser = db.prepare('SELECT id, email, name, avatar_url FROM users WHERE LOWER(email) = ?').get(email);
    const status = existingUser ? 'active' : 'pending';
    const memberUserId = existingUser ? existingUser.id : null;

    db.prepare(`
      INSERT INTO workspace_members (owner_user_id, member_user_id, email, permission, status, invited_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_user_id, email) DO UPDATE SET
        member_user_id = COALESCE(excluded.member_user_id, workspace_members.member_user_id),
        permission = excluded.permission,
        status = excluded.status,
        invited_by = excluded.invited_by,
        updated_at = excluded.updated_at
    `).run(ownerUserId, memberUserId, email, perm, status, actorUserId, now, now);

    const row = db.prepare('SELECT id FROM workspace_members WHERE owner_user_id = ? AND LOWER(email) = ?').get(ownerUserId, email);
    let inviteToken = null;
    if (!existingUser) {
      inviteToken = 'inv_' + crypto.randomBytes(16).toString('hex');
      db.prepare(`
        DELETE FROM invitations WHERE scope = 'workspace' AND owner_user_id = ? AND LOWER(email) = ? AND status = 'pending'
      `).run(ownerUserId, email);
      db.prepare(`
        INSERT INTO invitations (token, scope, owner_user_id, board_id, email, permission, status, invited_by, created_at, expires_at)
        VALUES (?, 'workspace', ?, NULL, ?, ?, 'pending', ?, ?, ?)
      `).run(inviteToken, ownerUserId, email, perm, actorUserId, now, expiresAt);
    }

    results.push({
      id: row.id,
      email,
      userId: memberUserId,
      name: existingUser ? existingUser.name : email.split('@')[0],
      permission: perm,
      permissionLabel: ROLE_LABELS[perm],
      status,
      inviteToken
    });
  }

  return { invited: results, invalid, workspace: listWorkspaceMembers(actorUserId) };
}

export function updateWorkspaceMemberRole({ actorUserId, memberId, permission }) {
  const { ownerUserId, actorRole } = resolveManagedWorkspaceOwnerId(actorUserId);
  if (!capabilitiesForRole(actorRole).canManageMembers) {
    throw forbidden('Only the Owner or an Admin can update member permissions.');
  }
  const perm = normalizePermission(permission, '');
  if (!perm) {
    const err = new Error('Invalid permission level.');
    err.status = 400;
    throw err;
  }
  const existing = db.prepare('SELECT * FROM workspace_members WHERE id = ? AND owner_user_id = ?').get(Number(memberId), ownerUserId);
  if (!existing) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }
  const now = Date.now();
  db.prepare('UPDATE workspace_members SET permission = ?, updated_at = ? WHERE id = ?').run(perm, now, existing.id);
  db.prepare(`
    UPDATE invitations SET permission = ?
     WHERE scope = 'workspace' AND owner_user_id = ? AND LOWER(email) = ? AND status = 'pending'
  `).run(perm, ownerUserId, String(existing.email).toLowerCase());
  return { ok: true, workspace: listWorkspaceMembers(actorUserId) };
}

export function removeWorkspaceMember({ actorUserId, memberId }) {
  const { ownerUserId, actorRole } = resolveManagedWorkspaceOwnerId(actorUserId);
  if (!capabilitiesForRole(actorRole).canManageMembers) {
    throw forbidden('Only the Owner or an Admin can remove workspace members.');
  }
  const existing = db.prepare('SELECT * FROM workspace_members WHERE id = ? AND owner_user_id = ?').get(Number(memberId), ownerUserId);
  if (!existing) {
    const err = new Error('Member not found.');
    err.status = 404;
    throw err;
  }
  db.prepare('DELETE FROM workspace_members WHERE id = ?').run(existing.id);
  db.prepare(`
    DELETE FROM invitations
     WHERE scope = 'workspace' AND owner_user_id = ? AND LOWER(email) = ? AND status = 'pending'
  `).run(ownerUserId, String(existing.email).toLowerCase());
  return { ok: true, workspace: listWorkspaceMembers(actorUserId) };
}

/* ---------- Board-level sharing & collaborators ---------- */

export function listBoardMembers({ boardId, actorUserId }) {
  const access = resolveBoardAccess(boardId, actorUserId);
  if (!access) {
    const err = new Error('Board not found.');
    err.status = 404;
    throw err;
  }
  const owner = db.prepare('SELECT id, email, name, avatar_url FROM users WHERE id = ?').get(access.ownerUserId);
  const rows = db.prepare(`
    SELECT bm.id, bm.board_id, bm.member_user_id, bm.email, bm.permission, bm.status, bm.created_at,
           u.name AS user_name, u.avatar_url AS user_avatar,
           inv.token AS invite_token
      FROM board_members bm
      LEFT JOIN users u ON u.id = bm.member_user_id
      LEFT JOIN invitations inv
        ON inv.scope = 'board' AND inv.board_id = bm.board_id
       AND LOWER(inv.email) = LOWER(bm.email) AND inv.status = 'pending'
     WHERE bm.board_id = ?
     ORDER BY CASE WHEN bm.status = 'active' THEN 0 ELSE 1 END, bm.created_at DESC
  `).all(access.internalId);

  const members = [];
  if (owner) {
    members.push({
      id: `owner-${owner.id}`,
      userId: owner.id,
      email: owner.email,
      name: owner.name || owner.email,
      avatarUrl: owner.avatar_url || '',
      permission: 'owner',
      permissionLabel: 'Owner',
      status: 'active',
      isOwner: true
    });
  }
  for (const r of rows) {
    const perm = normalizePermission(r.permission, 'viewer');
    members.push({
      id: r.id,
      userId: r.member_user_id || null,
      email: r.email,
      name: r.user_name || r.email.split('@')[0],
      avatarUrl: r.user_avatar || '',
      permission: perm,
      permissionLabel: ROLE_LABELS[perm] || 'Viewer',
      status: r.status === 'active' ? 'active' : 'pending',
      inviteToken: r.status === 'pending' ? (r.invite_token || null) : null,
      isOwner: false,
      createdAt: r.created_at
    });
  }

  return {
    boardId: publicBoardId(access.internalId),
    permission: access.role,
    capabilities: capabilitiesForRole(access.role),
    canManage: access.canManageMembers,
    members,
    presence: listBoardPresence(access.internalId)
  };
}

export function inviteBoardMembers({ boardId, actorUserId, emails, permission = 'editor' }) {
  const access = resolveBoardAccess(boardId, actorUserId);
  if (!access) {
    const err = new Error('Board not found.');
    err.status = 404;
    throw err;
  }
  if (!access.canManageMembers) {
    throw forbidden('Only the board Owner or an Admin can invite collaborators.');
  }

  const perm = normalizePermission(permission, '');
  if (!perm) {
    const err = new Error('Invalid permission level.');
    err.status = 400;
    throw err;
  }

  const { valid, invalid } = parseEmailList(emails);
  if (!valid.length) {
    const err = new Error(invalid.length ? `Invalid email address: ${invalid[0]}` : 'Please enter at least one valid email address.');
    err.status = 400;
    throw err;
  }

  const owner = db.prepare('SELECT id, email FROM users WHERE id = ?').get(access.ownerUserId);
  const now = Date.now();
  const expiresAt = now + 14 * 24 * 60 * 60 * 1000;
  const invited = [];

  for (const email of valid) {
    if (owner && String(owner.email || '').toLowerCase() === email) {
      invited.push({ email, skipped: true, reason: 'Already board owner.' });
      continue;
    }

    const existingUser = db.prepare('SELECT id, email, name FROM users WHERE LOWER(email) = ?').get(email);
    const status = existingUser ? 'active' : 'pending';
    const memberUserId = existingUser ? existingUser.id : null;

    db.prepare(`
      INSERT INTO board_members (board_id, owner_user_id, member_user_id, email, permission, status, invited_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(board_id, email) DO UPDATE SET
        member_user_id = COALESCE(excluded.member_user_id, board_members.member_user_id),
        permission = excluded.permission,
        status = excluded.status,
        invited_by = excluded.invited_by,
        updated_at = excluded.updated_at
    `).run(access.internalId, access.ownerUserId, memberUserId, email, perm, status, actorUserId, now, now);

    const row = db.prepare('SELECT id FROM board_members WHERE board_id = ? AND LOWER(email) = ?').get(access.internalId, email);
    let inviteToken = null;
    if (!existingUser) {
      inviteToken = 'inv_' + crypto.randomBytes(16).toString('hex');
      db.prepare(`
        DELETE FROM invitations WHERE scope = 'board' AND board_id = ? AND LOWER(email) = ? AND status = 'pending'
      `).run(access.internalId, email);
      db.prepare(`
        INSERT INTO invitations (token, scope, owner_user_id, board_id, email, permission, status, invited_by, created_at, expires_at)
        VALUES (?, 'board', ?, ?, ?, ?, 'pending', ?, ?, ?)
      `).run(inviteToken, access.ownerUserId, access.internalId, email, perm, actorUserId, now, expiresAt);
    }

    invited.push({
      id: row.id,
      email,
      userId: memberUserId,
      name: existingUser ? existingUser.name : email.split('@')[0],
      permission: perm,
      permissionLabel: ROLE_LABELS[perm],
      status,
      inviteToken
    });
  }

  return { invited, invalid, ...listBoardMembers({ boardId, actorUserId }) };
}

export function updateBoardMemberRole({ boardId, actorUserId, memberId, permission }) {
  const access = resolveBoardAccess(boardId, actorUserId);
  if (!access) {
    const err = new Error('Board not found.');
    err.status = 404;
    throw err;
  }
  if (!access.canManageMembers) {
    throw forbidden('Only the board Owner or an Admin can update collaborator permissions.');
  }
  const perm = normalizePermission(permission, '');
  if (!perm) {
    const err = new Error('Invalid permission level.');
    err.status = 400;
    throw err;
  }
  const existing = db.prepare('SELECT * FROM board_members WHERE id = ? AND board_id = ?').get(Number(memberId), access.internalId);
  if (!existing) {
    const err = new Error('Collaborator not found.');
    err.status = 404;
    throw err;
  }
  db.prepare('UPDATE board_members SET permission = ?, updated_at = ? WHERE id = ?').run(perm, Date.now(), existing.id);
  db.prepare(`
    UPDATE invitations SET permission = ?
     WHERE scope = 'board' AND board_id = ? AND LOWER(email) = ? AND status = 'pending'
  `).run(perm, access.internalId, String(existing.email).toLowerCase());
  return { ok: true, ...listBoardMembers({ boardId, actorUserId }) };
}

export function removeBoardMember({ boardId, actorUserId, memberId }) {
  const access = resolveBoardAccess(boardId, actorUserId);
  if (!access) {
    const err = new Error('Board not found.');
    err.status = 404;
    throw err;
  }
  if (!access.canManageMembers) {
    throw forbidden('Only the board Owner or an Admin can remove collaborators.');
  }
  const existing = db.prepare('SELECT * FROM board_members WHERE id = ? AND board_id = ?').get(Number(memberId), access.internalId);
  if (!existing) {
    const err = new Error('Collaborator not found.');
    err.status = 404;
    throw err;
  }
  db.prepare('DELETE FROM board_members WHERE id = ?').run(existing.id);
  db.prepare(`
    DELETE FROM invitations
     WHERE scope = 'board' AND board_id = ? AND LOWER(email) = ? AND status = 'pending'
  `).run(access.internalId, String(existing.email).toLowerCase());
  return { ok: true, ...listBoardMembers({ boardId, actorUserId }) };
}

/* ---------- Live Board Collaborator Presence (in-memory 30s TTL) ---------- */
const presenceStore = new Map();
const PRESENCE_TTL_MS = 30 * 1000;

export function recordBoardPresence(internalBoardId, user, role) {
  if (!internalBoardId || !user || !user.id) return [];
  const key = String(internalBoardId);
  let room = presenceStore.get(key);
  if (!room) {
    room = new Map();
    presenceStore.set(key, room);
  }
  const now = Date.now();
  room.set(user.id, {
    userId: user.id,
    name: user.name || user.email || 'User',
    email: user.email || '',
    avatarUrl: user.avatar_url || '',
    role: role || 'viewer',
    lastSeen: now
  });
  return listBoardPresence(key);
}

export function listBoardPresence(internalBoardId) {
  const room = presenceStore.get(String(internalBoardId || ''));
  if (!room) return [];
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  const active = [];
  for (const [uid, entry] of room.entries()) {
    if (entry.lastSeen < cutoff) {
      room.delete(uid);
    } else {
      active.push(entry);
    }
  }
  return active;
}
