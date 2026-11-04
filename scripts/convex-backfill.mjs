/* Backfill the Convex mirror from SQLite (the source of truth).

   Safe to re-run: boards/plans/users are upserts, and section rows are pruned
   per board. Every board and plan is pushed under its owner's user id, so the
   mirror keeps the same row-level isolation as the app. Rows with no owner are
   skipped (they are invisible by design until claimed).

   Requires SYNC_SECRET (same value set on the Convex deployment).

   Usage: node scripts/convex-backfill.mjs */
import { db } from '../server/db.js';
import { convexQuery, convexMutation, buildProjectPlanPayload } from '../server/convex.js';
import { config } from '../server/config.js';

if (!config.convex.syncSecret) {
  console.error('SYNC_SECRET is not set. Add it to .env.local and `npx convex env set SYNC_SECRET <value>`.');
  process.exit(1);
}

const boards = db
  .prepare('SELECT id, user_id, title, category, starred, state_json FROM boards WHERE user_id IS NOT NULL')
  .all();
const plans = db
  .prepare('SELECT board_id, user_id, plan_json FROM project_plans WHERE user_id IS NOT NULL')
  .all();
const users = db.prepare('SELECT id, email, name, role, password_hash FROM users').all();

const parse = (raw) => {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

let failures = 0;
const step = async (label, fn) => {
  try {
    const value = await fn();
    if (value === null || value === undefined) throw new Error('no result (rejected or unreachable)');
    console.log('  ok   ' + label);
  } catch (err) {
    failures += 1;
    console.log('  FAIL ' + label + ' -> ' + err.message);
  }
};

console.log('users');
for (const u of users) {
  await step(u.email, () =>
    convexMutation('users:upsertUser', {
      email: u.email,
      name: u.name,
      role: u.role || 'member',
      externalId: String(u.id),
      passwordHash: u.password_hash || undefined
    })
  );
}

console.log('boards');
for (const b of boards) {
  await step(`${b.id} (user ${b.user_id})`, () =>
    convexMutation('boards:upsert', {
      userId: String(b.user_id),
      boardId: String(b.id),
      title: b.title || 'New Collaborative Board',
      category: b.category || 'Strategy & Planning',
      starred: Boolean(b.starred),
      stateJson: JSON.stringify(parse(b.state_json))
    })
  );
}

console.log('project plans');
for (const p of plans) {
  const plan = parse(p.plan_json);
  await step(`${p.board_id} (user ${p.user_id}, ${(plan.tasks || []).length} tasks)`, () =>
    convexMutation(
      'projectPlanning:save',
      buildProjectPlanPayload(p.board_id, plan, String(p.user_id))
    )
  );
}

// Per-user reconciliation: what each user has locally vs in Convex.
console.log('reconciliation');
for (const u of users) {
  const localIds = new Set(boards.filter((b) => b.user_id === u.id).map((b) => String(b.id)));
  const remote = (await convexQuery('boards:list', { userId: String(u.id) })) || [];
  const remoteIds = new Set(remote.map((b) => String(b.id)));
  const missing = [...localIds].filter((id) => !remoteIds.has(id));
  const extra = [...remoteIds].filter((id) => !localIds.has(id));
  console.log(
    `  ${u.email}: local=${localIds.size} convex=${remoteIds.size}` +
      (missing.length ? ` missing=[${missing.join(', ')}]` : '') +
      (extra.length ? ` convex-only=[${extra.join(', ')}]` : '')
  );
}

console.log(failures ? `done, ${failures} failure(s)` : 'done, no failures');
process.exit(failures ? 1 : 0);
