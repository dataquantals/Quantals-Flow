import crypto from 'node:crypto';
import { db } from './db.js';

/**
 * Immutable Activity Log Engine (`server/activity-log.js`)
 *
 * - Append-only `activity_logs` SQLite table enforced with BEFORE UPDATE and
 *   BEFORE DELETE triggers so records cannot be modified or deleted.
 * - Role-based visibility: Admins (`owner`, `admin`) see all system-wide events;
 *   regular users only see their own (`actor_id = String(user.id)`).
 * - Automatic request metadata capture (IP address, parsed device/browser,
 *   HTTP method/path, and structured before/after diffs).
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id            TEXT    PRIMARY KEY,
    timestamp     INTEGER NOT NULL,
    actor_id      TEXT    NOT NULL,
    actor_name    TEXT    NOT NULL DEFAULT 'System',
    actor_email   TEXT    NOT NULL DEFAULT '',
    actor_avatar  TEXT    NOT NULL DEFAULT '',
    action_type   TEXT    NOT NULL,
    description   TEXT    NOT NULL,
    target_name   TEXT    NOT NULL DEFAULT '',
    target_link   TEXT    NOT NULL DEFAULT '',
    target_id     TEXT    NOT NULL DEFAULT '',
    metadata_json TEXT    NOT NULL DEFAULT '{}'
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_logs(timestamp DESC)');
db.exec('CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_logs(actor_id, timestamp DESC)');
db.exec('CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action_type, timestamp DESC)');

// Database-level immutability guards: logs can ONLY be inserted and read.
db.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_activity_logs_no_update
  BEFORE UPDATE ON activity_logs
  BEGIN
    SELECT RAISE(ABORT, 'activity_logs records are immutable and cannot be updated');
  END;
`);
db.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_activity_logs_no_delete
  BEFORE DELETE ON activity_logs
  BEGIN
    SELECT RAISE(ABORT, 'activity_logs records are immutable and cannot be deleted');
  END;
`);

const VALID_ACTIONS = new Set(['Created', 'Updated', 'Deleted', 'Auth', 'Status', 'Error', 'System']);

export function isActivityAdmin(user, workspaceRole = '') {
  if (!user) return false;
  const r = String(user.role || '').toLowerCase();
  const wr = String(workspaceRole || '').toLowerCase();
  return r === 'owner' || r === 'admin' || wr === 'owner' || wr === 'admin';
}

function parseDeviceFromUA(ua = '') {
  const s = String(ua || '');
  if (!s) return 'Unknown device';
  let os = 'Unknown OS';
  if (/iPhone/i.test(s)) os = 'iPhone (iOS)';
  else if (/iPad/i.test(s)) os = 'iPad (iPadOS)';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/Windows NT/i.test(s)) os = 'Windows';
  else if (/Mac OS X/i.test(s)) os = 'macOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/node|curl/i.test(s)) browser = 'API Client';

  return `${browser} on ${os}`;
}

export function extractRequestMeta(req) {
  if (!req) return { ip: 'internal', device: 'Server', userAgent: '', method: '', path: '' };
  const headers = req.headers || {};
  const xff = headers['x-forwarded-for'];
  const rawIp = Array.isArray(xff)
    ? xff[0]
    : typeof xff === 'string' && xff.trim()
      ? xff.split(',')[0].trim()
      : (req.socket && req.socket.remoteAddress) || '127.0.0.1';
  const ip = String(rawIp || '').replace(/^::ffff:/, '') || '127.0.0.1';
  const userAgent = String(headers['user-agent'] || '').slice(0, 300);
  return {
    ip,
    device: parseDeviceFromUA(userAgent),
    userAgent,
    method: String(req.method || ''),
    path: String(req.url || '').split('?')[0]
  };
}

const insertStmt = db.prepare(`
  INSERT INTO activity_logs (
    id, timestamp, actor_id, actor_name, actor_email, actor_avatar,
    action_type, description, target_name, target_link, target_id, metadata_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Append an immutable activity log entry.
 * Fail-safe: never throws into calling request handlers.
 */
export function recordActivity({
  req = null,
  actor = null,
  actionType = 'System',
  description = '',
  target = null,
  before = undefined,
  after = undefined,
  extra = undefined
} = {}) {
  try {
    const id = `act_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = Date.now();
    const isSystem = !actor || actor === 'System' || actor.id === 'System';
    const actorId = isSystem ? 'System' : String(actor.id);
    const actorName = isSystem ? 'System' : String(actor.name || actor.email || `User #${actor.id}`);
    const actorEmail = isSystem ? '' : String(actor.email || '');
    const actorAvatar = isSystem ? '' : String(actor.avatar_url || actor.avatarUrl || '');
    const normalizedAction = VALID_ACTIONS.has(actionType) ? actionType : 'System';

    const targetName = target && target.name ? String(target.name) : '';
    const targetLink = target && target.link ? String(target.link) : '';
    const targetId = target && target.id != null ? String(target.id) : '';

    const reqMeta = extractRequestMeta(req);
    const metadata = {
      ip: reqMeta.ip,
      device: reqMeta.device,
      ...(reqMeta.userAgent ? { userAgent: reqMeta.userAgent } : {}),
      ...(reqMeta.method ? { method: reqMeta.method } : {}),
      ...(reqMeta.path ? { path: reqMeta.path } : {}),
      ...(before !== undefined ? { before } : {}),
      ...(after !== undefined ? { after } : {}),
      ...(extra && typeof extra === 'object' ? { details: extra } : {})
    };

    insertStmt.run(
      id,
      timestamp,
      actorId,
      actorName,
      actorEmail,
      actorAvatar,
      normalizedAction,
      String(description || `${normalizedAction} ${targetName || 'event'}`).slice(0, 600),
      targetName.slice(0, 200),
      targetLink.slice(0, 400),
      targetId.slice(0, 120),
      JSON.stringify(metadata)
    );
    return id;
  } catch {
    return null;
  }
}

function hydrateRow(row) {
  if (!row) return null;
  let metadata = {};
  try { metadata = JSON.parse(row.metadata_json || '{}'); } catch {}
  return {
    id: row.id,
    timestamp: row.timestamp,
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    actor_email: row.actor_email || '',
    actor_avatar: row.actor_avatar || '',
    action_type: row.action_type,
    description: row.description,
    target_resource: {
      name: row.target_name || '',
      link: row.target_link || '',
      id: row.target_id || ''
    },
    metadata
  };
}

function buildFilterWhere({ viewer, isAdmin, search, actionType, actorId, dateFrom, dateTo }) {
  const clauses = [];
  const params = [];

  if (!isAdmin) {
    clauses.push('actor_id = ?');
    params.push(String(viewer.id));
  } else if (actorId && actorId !== 'all') {
    clauses.push('actor_id = ?');
    params.push(String(actorId));
  }

  if (actionType && actionType !== 'all') {
    clauses.push('action_type = ?');
    params.push(String(actionType));
  }

  if (dateFrom) {
    const fromMs = /^\d+$/.test(String(dateFrom))
      ? Number(dateFrom)
      : Date.parse(`${dateFrom}T00:00:00.000Z`);
    if (Number.isFinite(fromMs)) {
      clauses.push('timestamp >= ?');
      params.push(fromMs);
    }
  }

  if (dateTo) {
    const toMs = /^\d+$/.test(String(dateTo))
      ? Number(dateTo)
      : Date.parse(`${dateTo}T23:59:59.999Z`);
    if (Number.isFinite(toMs)) {
      clauses.push('timestamp <= ?');
      params.push(toMs);
    }
  }

  const q = String(search || '').trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    clauses.push(
      '(LOWER(description) LIKE ? OR LOWER(actor_name) LIKE ? OR LOWER(actor_email) LIKE ? OR LOWER(target_name) LIKE ? OR LOWER(action_type) LIKE ?)'
    );
    params.push(like, like, like, like, like);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

export function queryActivityLogs({
  viewer,
  isAdmin = false,
  search = '',
  actionType = 'all',
  actorId = 'all',
  dateFrom = '',
  dateTo = '',
  page = 1,
  pageSize = 20
}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeSize = Math.min(100, Math.max(5, parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safeSize;

  const { whereSql, params } = buildFilterWhere({
    viewer, isAdmin, search, actionType, actorId, dateFrom, dateTo
  });

  const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM activity_logs ${whereSql}`).get(...params);
  const total = Number(totalRow && totalRow.cnt) || 0;

  const rows = db
    .prepare(`SELECT * FROM activity_logs ${whereSql} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, safeSize, offset);

  let actors = [];
  if (isAdmin) {
    actors = db
      .prepare(`SELECT DISTINCT actor_id AS id, actor_name AS name, actor_email AS email FROM activity_logs ORDER BY actor_name ASC LIMIT 200`)
      .all();
  } else {
    actors = [{ id: String(viewer.id), name: viewer.name || viewer.email, email: viewer.email || '' }];
  }

  return {
    items: rows.map(hydrateRow),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages: Math.max(1, Math.ceil(total / safeSize)),
    actors,
    isAdmin
  };
}

export function getActivityLogById({ id, viewer, isAdmin = false }) {
  if (!id) return null;
  const row = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(String(id));
  if (!row) return null;
  if (!isAdmin && row.actor_id !== String(viewer.id)) return null;
  return hydrateRow(row);
}

function csvCell(val) {
  const s = String(val == null ? '' : val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportActivityLogsCsv({
  viewer,
  isAdmin = false,
  search = '',
  actionType = 'all',
  actorId = 'all',
  dateFrom = '',
  dateTo = ''
}) {
  const { whereSql, params } = buildFilterWhere({
    viewer, isAdmin, search, actionType, actorId, dateFrom, dateTo
  });
  const rows = db
    .prepare(`SELECT * FROM activity_logs ${whereSql} ORDER BY timestamp DESC, id DESC LIMIT 5000`)
    .all(...params);

  const header = ['ID', 'Timestamp (ISO)', 'Actor ID', 'Actor Name', 'Actor Email', 'Action Type', 'Description', 'Target Name', 'Target Link', 'IP Address', 'Device', 'Metadata JSON'];
  const lines = [header.map(csvCell).join(',')];

  for (const r of rows) {
    let meta = {};
    try { meta = JSON.parse(r.metadata_json || '{}'); } catch {}
    lines.push([
      r.id,
      new Date(r.timestamp).toISOString(),
      r.actor_id,
      r.actor_name,
      r.actor_email,
      r.action_type,
      r.description,
      r.target_name,
      r.target_link,
      meta.ip || '',
      meta.device || '',
      r.metadata_json || '{}'
    ].map(csvCell).join(','));
  }
  return lines.join('\r\n');
}

// Seed one immutable system boot record if the table is completely empty
(function ensureInitialSystemEvent() {
  try {
    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM activity_logs').get();
    if (!cnt || cnt.cnt === 0) {
      recordActivity({
        actor: 'System',
        actionType: 'System',
        description: 'Activity Log audit subsystem initialized (immutable append-only store)',
        target: { name: 'Activity Log', link: '/dashboard/activity/', id: 'activity_logs' },
        extra: { storage: 'sqlite', immutable: true }
      });
    }
  } catch {}
})();
