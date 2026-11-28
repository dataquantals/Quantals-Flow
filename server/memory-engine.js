import crypto from 'node:crypto';
import { db } from './db.js';
import { config } from './config.js';

/**
 * AI-Powered Organisational Memory Engine (`server/memory-engine.js`)
 *
 * Complements `activity_logs` (immutable audit trail: who/what/when) without
 * replacing it. Implements:
 *  1. Stable deduplication keys (`{type}:{projectId}:{cause}`) + one-time
 *     duplicate-merge migration; never recreates Archived records.
 *  2. Adjustable minimum evidence threshold (default 3, range 2–10); never
 *     generates insights mentioning 0 events; stores exact supporting event IDs
 *     and computes evidence-backed confidence percentages.
 *  3. Review lifecycle: Proposed (engine output) -> Validated (approved/manual)
 *     -> Archived (with Restore, Edit, Delete) + strict Capture validation.
 *  4. 6 canonical types (`decision`, `lesson`, `best_practice`, `risk`,
 *     `process`, `research`) with a single source-of-truth count aggregator.
 *  5. Real hydrated Activity Log evidence + observed/updated dates.
 */

export const MEMORY_TYPES = [
  { id: 'decision', label: 'Decision', plural: 'Decisions', hint: 'Captured when architectural, product, or governance choices are recorded.' },
  { id: 'lesson', label: 'Lesson', plural: 'Lessons', hint: 'Generated from recurring delivery revisions or captured after project reviews.' },
  { id: 'best_practice', label: 'Best practice', plural: 'Best practices', hint: 'Proven playbooks and standards validated by your team.' },
  { id: 'risk', label: 'Risk', plural: 'Risks', hint: 'Flagged automatically when repeated errors or security anomalies occur.' },
  { id: 'process', label: 'Process improvement', plural: 'Process improvements', hint: 'Synthesised from recurring workflow, role, or lifecycle changes.' },
  { id: 'research', label: 'Research insight', plural: 'Research insights', hint: 'Findings from user interviews, experiments, and market analysis.' }
];

const VALID_TYPES = new Set(MEMORY_TYPES.map((t) => t.id));
const VALID_STATUSES = new Set(['Proposed', 'Validated', 'Archived']);
const TYPE_TAG_BLOCKLIST = new Set([
  'decision', 'decisions', 'decision repository',
  'lesson', 'lessons', 'lessons learned',
  'best practice', 'best practices',
  'risk', 'risks', 'risk intelligence',
  'process', 'process evolution', 'process improvement',
  'research', 'research insight', 'research insights',
  'ai synthesis', 'ai synthesised', 'activity intelligence'
]);

db.exec(`
  CREATE TABLE IF NOT EXISTS org_memory_records (
    id                       TEXT    PRIMARY KEY,
    org_id                   TEXT    NOT NULL,
    category                 TEXT    NOT NULL DEFAULT 'lesson',
    title                    TEXT    NOT NULL,
    summary                  TEXT    NOT NULL DEFAULT '',
    why_happened             TEXT    NOT NULL DEFAULT '',
    lesson_learned           TEXT    NOT NULL DEFAULT '',
    recommendation           TEXT    NOT NULL DEFAULT '',
    impact_level             TEXT    NOT NULL DEFAULT 'Medium',
    confidence               INTEGER NOT NULL DEFAULT 80,
    status                   TEXT    NOT NULL DEFAULT 'Validated',
    ai_generated             INTEGER NOT NULL DEFAULT 0,
    source_label             TEXT    NOT NULL DEFAULT '',
    source_link              TEXT    NOT NULL DEFAULT '',
    source_activity_ids_json TEXT    NOT NULL DEFAULT '[]',
    tags_json                TEXT    NOT NULL DEFAULT '[]',
    author_id                INTEGER REFERENCES users(id) ON DELETE SET NULL,
    author_name              TEXT    NOT NULL DEFAULT 'AI Memory Engine',
    created_at               INTEGER NOT NULL,
    updated_at               INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS org_memory_settings (
    org_id                 TEXT    PRIMARY KEY,
    min_evidence_threshold INTEGER NOT NULL DEFAULT 3,
    updated_at             INTEGER NOT NULL
  );
`);

// Schema evolution columns (idempotent)
try { db.exec("ALTER TABLE org_memory_records ADD COLUMN dedupe_key TEXT NOT NULL DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE org_memory_records ADD COLUMN project_id TEXT NOT NULL DEFAULT 'workspace'"); } catch {}
try { db.exec("ALTER TABLE org_memory_records ADD COLUMN project_name TEXT NOT NULL DEFAULT 'Workspace'"); } catch {}
try { db.exec('ALTER TABLE org_memory_records ADD COLUMN first_observed_at INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE org_memory_records ADD COLUMN last_observed_at INTEGER NOT NULL DEFAULT 0'); } catch {}

db.exec('CREATE INDEX IF NOT EXISTS idx_mem_rec_org_cat ON org_memory_records(org_id, category, updated_at DESC)');
db.exec('CREATE INDEX IF NOT EXISTS idx_mem_rec_org_status ON org_memory_records(org_id, status, updated_at DESC)');
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_mem_rec_org_dedupe ON org_memory_records(org_id, dedupe_key) WHERE dedupe_key != ''");

function safeJson(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function cleanTags(tags, typeId) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of tags) {
    const t = String(raw || '').replace(/^#/, '').trim();
    if (!t) continue;
    const low = t.toLowerCase();
    if (low === typeId || TYPE_TAG_BLOCKLIST.has(low)) continue;
    if (!seen.has(low)) {
      seen.add(low);
      out.push(t.slice(0, 40));
    }
  }
  return out.slice(0, 8);
}

function normalizeStatus(s, aiGenerated) {
  if (VALID_STATUSES.has(s)) return s;
  const low = String(s || '').toLowerCase();
  if (low === 'proposed' || low === 'draft') return 'Proposed';
  if (low === 'archived') return 'Archived';
  if (low === 'validated' || low === 'verified') return 'Validated';
  return aiGenerated ? 'Proposed' : 'Validated';
}

function normalizeType(cat) {
  if (VALID_TYPES.has(cat)) return cat;
  if (cat === 'project_history') return 'lesson';
  if (cat === 'expert_knowledge') return 'best_practice';
  return 'lesson';
}

/** Reject gibberish / keyboard-mash / repeated-char placeholder text */
export function isGibberishText(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (/(.)\1{4,}/i.test(s)) return true;
  if (/\b(asdf|sdf|sdfs|qwer|zxcv|lkj|jkl|hjkl|fghj|test123|aaaa|xxxx|zzzz)\b/i.test(s)) return true;
  const words = s.split(/\s+/).filter(Boolean);
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z]/g, '');
    if (clean.length >= 6 && clean !== clean.toUpperCase()) {
      if (/[bcdfghjklmnpqrstvwxz]{6,}/i.test(clean)) return true;
    }
  }
  const letters = s.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 6) {
    const vowels = (letters.match(/[aeiouy]/gi) || []).length;
    if (vowels / letters.length < 0.14) return true;
  }
  return false;
}

export function validateManualRecordInput({ title, summary, whyHappened }) {
  const errors = {};
  const t = String(title || '').trim();
  const s = String(summary || '').trim();
  const w = String(whyHappened || '').trim();

  if (t.length < 8) errors.title = 'Title must be at least 8 characters.';
  else if (isGibberishText(t)) errors.title = 'Please enter a meaningful title (placeholder or random characters are not accepted).';

  if (s.length < 20) errors.summary = 'Summary must be at least 20 characters.';
  else if (isGibberishText(s)) errors.summary = 'Please provide a clear summary rather than placeholder text.';

  if (w.length < 10) errors.whyHappened = 'Please explain why it happened (at least 10 characters).';
  else if (isGibberishText(w)) errors.whyHappened = 'Please provide a meaningful explanation for why it happened.';

  return errors;
}

/* ---------------- One-Time Deduplication & Normalization Migration ---------------- */
(function runOneTimeMemoryMigration() {
  try {
    const rows = db.prepare('SELECT * FROM org_memory_records ORDER BY created_at ASC').all();
    const byGroup = new Map();

    for (const r of rows) {
      // Remove legacy zero-evidence AI records
      const zeroMention = /\b0\s+(status|role|removal|error|update|event)/i.test(`${r.why_happened} ${r.summary}`);
      const evIds = safeJson(r.source_activity_ids_json, []);
      if (r.ai_generated && (zeroMention || evIds.length === 0)) {
        db.prepare('DELETE FROM org_memory_records WHERE id = ?').run(r.id);
        continue;
      }

      const normCat = normalizeType(r.category);
      const normStatus = normalizeStatus(r.status, Boolean(r.ai_generated));
      const normTags = cleanTags(safeJson(r.tags_json, []), normCat);
      const groupKey = `${r.org_id}::${r.dedupe_key || r.title.trim().toLowerCase()}`;

      if (!byGroup.has(groupKey)) {
        byGroup.set(groupKey, { keep: r, mergedIds: new Set(evIds) });
        const firstObs = r.first_observed_at || r.created_at;
        const lastObs = r.last_observed_at || r.updated_at || r.created_at;
        db.prepare(`
          UPDATE org_memory_records
          SET category = ?, status = ?, tags_json = ?, first_observed_at = ?, last_observed_at = ?,
              project_name = CASE WHEN project_name = '' THEN 'Workspace' ELSE project_name END
          WHERE id = ?
        `).run(normCat, normStatus, JSON.stringify(normTags), firstObs, lastObs, r.id);
      } else {
        // Merge duplicate into the oldest kept record and delete duplicate row
        const entry = byGroup.get(groupKey);
        for (const eid of evIds) entry.mergedIds.add(eid);
        const mergedArr = Array.from(entry.mergedIds).slice(0, 50);
        const nextLast = Math.max(entry.keep.last_observed_at || entry.keep.updated_at, r.updated_at || r.created_at);
        db.prepare('UPDATE org_memory_records SET source_activity_ids_json = ?, last_observed_at = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(mergedArr), nextLast, nextLast, entry.keep.id);
        db.prepare('DELETE FROM org_memory_records WHERE id = ?').run(r.id);
      }
    }
  } catch {}
})();

export function getMemorySettings(orgId) {
  const row = db.prepare('SELECT min_evidence_threshold FROM org_memory_settings WHERE org_id = ?').get(String(orgId));
  return {
    minEvidenceThreshold: row ? Math.max(2, Math.min(10, Number(row.min_evidence_threshold) || 3)) : 3
  };
}

export function updateMemorySettings(orgId, { minEvidenceThreshold }) {
  const val = Math.max(2, Math.min(10, parseInt(minEvidenceThreshold, 10) || 3));
  db.prepare(`
    INSERT INTO org_memory_settings (org_id, min_evidence_threshold, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(org_id) DO UPDATE SET min_evidence_threshold = excluded.min_evidence_threshold, updated_at = excluded.updated_at
  `).run(String(orgId), val, Date.now());
  return { minEvidenceThreshold: val };
}

function hydrateEvidenceEvents(activityIds) {
  if (!Array.isArray(activityIds) || !activityIds.length) return [];
  const placeholders = activityIds.slice(0, 20).map(() => '?').join(',');
  try {
    return db
      .prepare(`SELECT id, timestamp, actor_name, action_type, description, target_name, target_link FROM activity_logs WHERE id IN (${placeholders}) ORDER BY timestamp DESC`)
      .all(...activityIds.slice(0, 20));
  } catch {
    return [];
  }
}

function hydrateRecord(r, includeEvidence = false) {
  if (!r) return null;
  const evIds = safeJson(r.source_activity_ids_json, []);
  const typeId = normalizeType(r.category);
  return {
    id: r.id,
    orgId: r.org_id,
    dedupeKey: r.dedupe_key || '',
    category: typeId,
    projectId: r.project_id || 'workspace',
    projectName: r.project_name || 'Workspace',
    title: r.title,
    summary: r.summary,
    whyHappened: r.why_happened,
    lessonLearned: r.lesson_learned,
    recommendation: r.recommendation,
    impactLevel: r.impact_level || 'Medium',
    confidence: Number(r.confidence) || 80,
    status: normalizeStatus(r.status, Boolean(r.ai_generated)),
    aiGenerated: Boolean(r.ai_generated),
    source: r.ai_generated ? 'ai' : 'manual',
    sourceLabel: r.source_label || (r.ai_generated ? 'AI Memory Engine' : 'Manual entry'),
    sourceLink: r.source_link || '/dashboard/activity/',
    sourceActivityIds: evIds,
    evidenceCount: evIds.length,
    ...(includeEvidence ? { evidenceEvents: hydrateEvidenceEvents(evIds) } : {}),
    tags: cleanTags(safeJson(r.tags_json, []), typeId),
    authorId: r.author_id || null,
    authorName: r.author_name || (r.ai_generated ? 'AI Memory Engine' : 'Workspace Member'),
    firstObservedAt: r.first_observed_at || r.created_at,
    lastObservedAt: r.last_observed_at || r.updated_at || r.created_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function resolveMemoryScopeOrgId(user, activeOrg) {
  if (activeOrg && activeOrg.id) return String(activeOrg.id);
  return `personal_${user.id}`;
}

/** Single source of truth for header totals, Needs Review count, and every tab count */
export function computeMemoryCounts(orgId, statusScope = 'active') {
  const statusClause = statusScope === 'Archived'
    ? "status = 'Archived'"
    : statusScope === 'Proposed'
      ? "status = 'Proposed'"
      : statusScope === 'Validated'
        ? "status = 'Validated'"
        : "status != 'Archived'";

  const rows = db
    .prepare(`SELECT category, COUNT(*) AS cnt FROM org_memory_records WHERE org_id = ? AND ${statusClause} GROUP BY category`)
    .all(String(orgId));

  const counts = {};
  for (const t of MEMORY_TYPES) counts[t.id] = 0;
  let totalInScope = 0;
  for (const r of rows) {
    const key = normalizeType(r.category);
    counts[key] = (counts[key] || 0) + (Number(r.cnt) || 0);
    totalInScope += Number(r.cnt) || 0;
  }

  const reviewRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM org_memory_records WHERE org_id = ? AND status = 'Proposed'")
    .get(String(orgId));
  const archivedRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM org_memory_records WHERE org_id = ? AND status = 'Archived'")
    .get(String(orgId));

  return {
    counts,
    totalAll: totalInScope,
    needsReviewCount: Number(reviewRow && reviewRow.cnt) || 0,
    archivedCount: Number(archivedRow && archivedRow.cnt) || 0
  };
}

export function createMemoryRecord({
  orgId,
  category = 'lesson',
  projectId = 'workspace',
  projectName = 'Workspace',
  title,
  summary = '',
  whyHappened = '',
  lessonLearned = '',
  recommendation = '',
  impactLevel = 'Medium',
  confidence = 95,
  status = undefined,
  aiGenerated = false,
  dedupeKey = '',
  sourceLabel = '',
  sourceLink = '',
  sourceActivityIds = [],
  firstObservedAt = 0,
  lastObservedAt = 0,
  tags = [],
  author = null,
  skipManualValidation = false
}) {
  if (!aiGenerated && !skipManualValidation) {
    const errs = validateManualRecordInput({ title, summary, whyHappened });
    if (Object.keys(errs).length) {
      const err = new Error(Object.values(errs)[0]);
      err.status = 400;
      err.fieldErrors = errs;
      throw err;
    }
  }

  const cleanTitle = String(title || '').trim().slice(0, 180);
  const cat = normalizeType(category);
  const now = Date.now();
  const id = `mem_${now.toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const finalStatus = normalizeStatus(status, aiGenerated);
  const authorId = author && author.id ? Number(author.id) : null;
  const authorName = aiGenerated
    ? 'AI Memory Engine'
    : (author && (author.name || author.email)) || 'Workspace Member';

  db.prepare(`
    INSERT INTO org_memory_records (
      id, org_id, dedupe_key, project_id, project_name, category, title, summary,
      why_happened, lesson_learned, recommendation, impact_level, confidence, status,
      ai_generated, source_label, source_link, source_activity_ids_json, tags_json,
      author_id, author_name, first_observed_at, last_observed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(orgId),
    String(dedupeKey || '').slice(0, 140),
    String(projectId || 'workspace').slice(0, 80),
    String(projectName || 'Workspace').slice(0, 120),
    cat,
    cleanTitle,
    String(summary || '').slice(0, 800),
    String(whyHappened || '').slice(0, 600),
    String(lessonLearned || '').slice(0, 600),
    String(recommendation || '').slice(0, 600),
    ['High', 'Medium', 'Low'].includes(impactLevel) ? impactLevel : 'Medium',
    Math.max(1, Math.min(100, Number(confidence) || 85)),
    finalStatus,
    aiGenerated ? 1 : 0,
    String(sourceLabel || (aiGenerated ? 'AI Memory Engine' : 'Manual entry')).slice(0, 140),
    String(sourceLink || '/dashboard/activity/').slice(0, 300),
    JSON.stringify(Array.isArray(sourceActivityIds) ? sourceActivityIds.slice(0, 50) : []),
    JSON.stringify(cleanTags(tags, cat)),
    authorId,
    String(authorName).slice(0, 100),
    firstObservedAt || now,
    lastObservedAt || now,
    now,
    now
  );

  return hydrateRecord(db.prepare('SELECT * FROM org_memory_records WHERE id = ?').get(id), true);
}

/** Upsert by stable dedupeKey; merges new evidence; NEVER recreates Archived records */
function upsertEngineRecord(payload) {
  const existing = db
    .prepare('SELECT * FROM org_memory_records WHERE org_id = ? AND dedupe_key = ?')
    .get(String(payload.orgId), String(payload.dedupeKey));

  if (existing) {
    if (normalizeStatus(existing.status, true) === 'Archived') {
      return { action: 'skipped_archived', record: hydrateRecord(existing) };
    }
    const prevIds = safeJson(existing.source_activity_ids_json, []);
    const mergedIds = Array.from(new Set(prevIds.concat(payload.sourceActivityIds || []))).slice(0, 50);
    const nextConf = Math.min(98, 60 + mergedIds.length * 6);
    const nextLast = Math.max(existing.last_observed_at || existing.updated_at, payload.lastObservedAt || Date.now());
    const nextFirst = Math.min(existing.first_observed_at || existing.created_at, payload.firstObservedAt || existing.created_at);

    db.prepare(`
      UPDATE org_memory_records
      SET summary = ?, why_happened = ?, lesson_learned = ?, recommendation = ?,
          confidence = ?, source_label = ?, source_activity_ids_json = ?,
          first_observed_at = ?, last_observed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      payload.summary,
      payload.whyHappened,
      payload.lessonLearned,
      payload.recommendation,
      nextConf,
      `${mergedIds.length} supporting events`,
      JSON.stringify(mergedIds),
      nextFirst,
      nextLast,
      Date.now(),
      existing.id
    );
    return { action: 'updated', record: hydrateRecord(db.prepare('SELECT * FROM org_memory_records WHERE id = ?').get(existing.id), true) };
  }

  const created = createMemoryRecord({
    ...payload,
    status: 'Proposed',
    aiGenerated: true,
    skipManualValidation: true
  });
  return { action: 'created', record: created };
}

export function getMemoryRecordById({ orgId, id }) {
  const row = db.prepare('SELECT * FROM org_memory_records WHERE id = ? AND org_id = ?').get(String(id), String(orgId));
  return hydrateRecord(row, true);
}

export function updateMemoryRecord({ orgId, id, patch }) {
  const existing = db.prepare('SELECT * FROM org_memory_records WHERE id = ? AND org_id = ?').get(String(id), String(orgId));
  if (!existing) {
    const err = new Error('Memory record not found.');
    err.status = 404;
    throw err;
  }

  const nextTitle = patch.title !== undefined ? String(patch.title).trim().slice(0, 180) : existing.title;
  const nextSummary = patch.summary !== undefined ? String(patch.summary).trim().slice(0, 800) : existing.summary;
  const nextWhy = patch.whyHappened !== undefined ? String(patch.whyHappened).trim().slice(0, 600) : existing.why_happened;

  if (patch.title !== undefined || patch.summary !== undefined || patch.whyHappened !== undefined) {
    const errs = validateManualRecordInput({ title: nextTitle, summary: nextSummary, whyHappened: nextWhy });
    if (Object.keys(errs).length) {
      const err = new Error(Object.values(errs)[0]);
      err.status = 400;
      err.fieldErrors = errs;
      throw err;
    }
  }

  const nextCat = patch.category !== undefined ? normalizeType(patch.category) : existing.category;
  const nextStatus = patch.status !== undefined ? normalizeStatus(patch.status, Boolean(existing.ai_generated)) : existing.status;
  const nextLesson = patch.lessonLearned !== undefined ? String(patch.lessonLearned).slice(0, 600) : existing.lesson_learned;
  const nextRec = patch.recommendation !== undefined ? String(patch.recommendation).slice(0, 600) : existing.recommendation;
  const nextProj = patch.projectName !== undefined ? String(patch.projectName).trim().slice(0, 120) || 'Workspace' : existing.project_name;
  const nextImpact = patch.impactLevel && ['High', 'Medium', 'Low'].includes(patch.impactLevel) ? patch.impactLevel : existing.impact_level;

  db.prepare(`
    UPDATE org_memory_records
    SET category = ?, title = ?, summary = ?, why_happened = ?, lesson_learned = ?,
        recommendation = ?, project_name = ?, impact_level = ?, status = ?, updated_at = ?
    WHERE id = ? AND org_id = ?
  `).run(
    nextCat, nextTitle, nextSummary, nextWhy, nextLesson, nextRec, nextProj, nextImpact, nextStatus, Date.now(), String(id), String(orgId)
  );

  return hydrateRecord(db.prepare('SELECT * FROM org_memory_records WHERE id = ?').get(String(id)), true);
}

export function deleteMemoryRecord({ orgId, id }) {
  const res = db.prepare('DELETE FROM org_memory_records WHERE id = ? AND org_id = ?').run(String(id), String(orgId));
  return { deleted: res.changes > 0 };
}

export function listMemoryRecords({ orgId, category = 'all', search = '', source = 'all', status = 'active', limit = 100 }) {
  const clauses = ['org_id = ?'];
  const params = [String(orgId)];

  if (status === 'Archived') clauses.push("status = 'Archived'");
  else if (status === 'Proposed') clauses.push("status = 'Proposed'");
  else if (status === 'Validated') clauses.push("status = 'Validated'");
  else clauses.push("status != 'Archived'");

  if (category && category !== 'all' && VALID_TYPES.has(category)) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (source === 'ai') clauses.push('ai_generated = 1');
  else if (source === 'manual') clauses.push('ai_generated = 0');

  const q = String(search || '').trim().toLowerCase();
  if (q) {
    const like = `%${q}%`;
    clauses.push('(LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(why_happened) LIKE ? OR LOWER(lesson_learned) LIKE ? OR LOWER(recommendation) LIKE ? OR LOWER(project_name) LIKE ?)');
    params.push(like, like, like, like, like, like);
  }

  const rows = db
    .prepare(`SELECT * FROM org_memory_records WHERE ${clauses.join(' AND ')} ORDER BY last_observed_at DESC, updated_at DESC LIMIT ?`)
    .all(...params, Math.min(200, Math.max(10, Number(limit) || 100)));

  const items = rows.map((r) => hydrateRecord(r, false));
  const summaryCounts = computeMemoryCounts(orgId, status);
  const settings = getMemorySettings(orgId);
  const distinctImpacts = new Set(items.map((i) => i.impactLevel));

  return {
    items,
    ...summaryCounts,
    settings,
    impactVaries: distinctImpacts.size > 1,
    types: MEMORY_TYPES
  };
}

/**
 * Evidence-gated AI Memory Engine:
 *  - Only generates/updates insights when supporting events >= minEvidenceThreshold (default 3)
 *  - Stable dedupe keys prevent duplicates across repeated runs
 *  - Never recreates Archived records
 *  - Never outputs zero-event claims
 */
export async function synthesizeMemoryFromActivity({ orgId, actor }) {
  const { minEvidenceThreshold } = getMemorySettings(orgId);
  const recentLogs = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 120').all();

  const buckets = [
    {
      cause: 'auth_or_access_errors',
      category: 'risk',
      projectId: 'security',
      projectName: 'Security & Access',
      events: recentLogs.filter((l) => l.action_type === 'Error'),
      build: (evs) => ({
        title: 'Recurring authentication or access errors detected',
        summary: `${evs.length} error events were logged in recent workspace activity, signalling credential or permission friction.`,
        whyHappened: `Audit analysis found ${evs.length} recorded Error events (most recent: "${evs[0].description}").`,
        lessonLearned: 'Repeated access failures slow down onboarding and point to unclear sign-in or permission setup.',
        recommendation: 'Review role assignments in People & Teams and enable SSO or Magic Links for affected accounts.',
        impactLevel: 'High',
        tags: ['Security', 'Access']
      })
    },
    {
      cause: 'frequent_workspace_revisions',
      category: 'lesson',
      projectId: 'delivery',
      projectName: 'Workspace Delivery',
      events: recentLogs.filter((l) => l.action_type === 'Updated'),
      build: (evs) => ({
        title: 'Frequent workspace revisions benefit from earlier stakeholder review',
        summary: `${evs.length} sequential update events across active boards and documents indicate ongoing scope iteration.`,
        whyHappened: `${evs.length} Updated events were recorded across active workspace assets without an intervening approval checkpoint.`,
        lessonLearned: 'Introducing stakeholder review during planning reduces late-stage document and board rework.',
        recommendation: 'Link a board-scoped Leaf spec before execution and capture scope sign-off as a Decision record.',
        impactLevel: 'Medium',
        tags: ['Planning', 'Stakeholders']
      })
    },
    {
      cause: 'governance_and_role_changes',
      category: 'process',
      projectId: 'governance',
      projectName: 'Org Governance',
      events: recentLogs.filter((l) => l.action_type === 'Status' || l.action_type === 'Deleted'),
      build: (evs) => ({
        title: 'Document rationale behind role transitions and workspace removals',
        summary: `${evs.length} lifecycle and permission changes were recorded in the audit trail.`,
        whyHappened: `${evs.length} Status/Deleted events occurred across workspace memberships and boards.`,
        lessonLearned: 'Without short handover notes, future teams lose context on why permissions or assets changed.',
        recommendation: 'Pair major role or lifecycle changes with a one-paragraph Decision record so context persists.',
        impactLevel: 'Medium',
        tags: ['Governance', 'Continuity']
      })
    },
    {
      cause: 'rapid_asset_creation',
      category: 'best_practice',
      projectId: 'workspace',
      projectName: 'Workspace Growth',
      events: recentLogs.filter((l) => l.action_type === 'Created'),
      build: (evs) => ({
        title: 'Standardise naming and templates for newly created workspace assets',
        summary: `${evs.length} new boards, invitations, or workspace records were created recently.`,
        whyHappened: `${evs.length} Created events show active workspace expansion across teams.`,
        lessonLearned: 'Consistent naming conventions and starter templates make cross-team discovery significantly faster.',
        recommendation: 'Adopt shared starter templates and tag new boards by department or project code.',
        impactLevel: 'Low',
        tags: ['Templates', 'Standards']
      })
    }
  ];

  const created = [];
  const updated = [];
  const skippedArchived = [];

  for (const b of buckets) {
    if (b.events.length < minEvidenceThreshold) continue;
    const timestamps = b.events.map((e) => Number(e.timestamp) || Date.now());
    const firstObservedAt = Math.min(...timestamps);
    const lastObservedAt = Math.max(...timestamps);
    const evIds = b.events.map((e) => e.id);
    const confidence = Math.min(98, 60 + evIds.length * 6);
    const details = b.build(b.events);

    const res = upsertEngineRecord({
      orgId,
      dedupeKey: `${b.category}:${b.projectId}:${b.cause}`,
      category: b.category,
      projectId: b.projectId,
      projectName: b.projectName,
      title: details.title,
      summary: details.summary,
      whyHappened: details.whyHappened,
      lessonLearned: details.lessonLearned,
      recommendation: details.recommendation,
      impactLevel: details.impactLevel,
      confidence,
      sourceLabel: `${evIds.length} supporting events`,
      sourceLink: `/dashboard/activity/?actionType=${encodeURIComponent(b.events[0].action_type || 'all')}`,
      sourceActivityIds: evIds,
      firstObservedAt,
      lastObservedAt,
      tags: details.tags,
      author: actor
    });

    if (res.action === 'created') created.push(res.record);
    else if (res.action === 'updated') updated.push(res.record);
    else skippedArchived.push(res.record);
  }

  return {
    createdCount: created.length,
    updatedCount: updated.length,
    skippedArchivedCount: skippedArchived.length,
    minEvidenceThreshold,
    analyzedActivityCount: recentLogs.length
  };
}

export async function askMemoryAssistant({ orgId, question }) {
  const q = String(question || '').trim();
  if (!q) {
    const err = new Error('Please enter a question for the AI Memory Assistant.');
    err.status = 400;
    throw err;
  }

  const all = listMemoryRecords({ orgId, status: 'active', limit: 80 }).items;
  const tokens = q.toLowerCase().split(/\W+/).filter((t) => t.length > 2);

  const scored = all
    .map((m) => {
      const hay = [m.title, m.summary, m.whyHappened, m.lessonLearned, m.recommendation, m.projectName, (m.tags || []).join(' ')].join(' ').toLowerCase();
      let score = 0;
      for (const tok of tokens) { if (hay.includes(tok)) score += 3; }
      if (m.status === 'Validated') score += 2;
      return { record: m, score };
    })
    .sort((a, b) => b.score - a.score || b.record.lastObservedAt - a.record.lastObservedAt);

  const citations = (scored.filter((s) => s.score > 0).length ? scored.filter((s) => s.score > 0) : scored)
    .slice(0, 4)
    .map((s) => s.record);

  if (!citations.length) {
    return {
      answer: 'No active Organisational Memory records match yet. Run the AI Memory Engine once enough activity events accumulate, or capture a validated insight manually.',
      citations: [],
      mode: 'grounded'
    };
  }

  const bullets = citations.map((c, idx) => {
    const parts = [`${idx + 1}. ${c.title} (${c.status}, ${c.confidence}% confidence)`];
    if (c.whyHappened) parts.push(`Why: ${c.whyHappened}`);
    if (c.lessonLearned) parts.push(`Learned: ${c.lessonLearned}`);
    if (c.recommendation) parts.push(`Recommendation: ${c.recommendation}`);
    return parts.join(' — ');
  });

  return {
    answer: `Based on ${citations.length} institutional memory record(s):\n\n${bullets.join('\n\n')}`,
    citations,
    mode: 'grounded'
  };
}
