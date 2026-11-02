/* Backfill the Convex mirror from SQLite (the source of truth).

   Safe to re-run: boards/plans/users are upserts, and section rows are pruned
   per board. Nothing is deleted from Convex except section rows that no longer
   exist in the SQLite plan.

   Usage: node scripts/convex-backfill.mjs [--prune-boards]
   --prune-boards also removes Convex boards that no longer exist in SQLite. */
import { DatabaseSync } from 'node:sqlite';
import { convexQuery, convexMutation, buildProjectPlanPayload } from '../server/convex.js';

const pruneBoards = process.argv.includes('--prune-boards');
const db = new DatabaseSync('data/app.db', { readOnly: true });

const boards = db.prepare('SELECT id, title, category, starred, state_json FROM boards').all();
const plans = db.prepare('SELECT board_id, plan_json FROM project_plans').all();
const users = db.prepare('SELECT id, email, name, role FROM users').all();

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
    console.log('  ok   ' + label + (value ? ' -> ' + JSON.stringify(value).slice(0, 120) : ''));
  } catch (err) {
    failures += 1;
    console.log('  FAIL ' + label + ' -> ' + err.message);
  }
};

console.log('users');
for (const u of users) {
  // Deliberately no passwordHash: hashes never leave SQLite.
  await step(u.email, () =>
    convexMutation('users:upsertUser', {
      email: u.email,
      name: u.name,
      role: u.role || 'member',
      externalId: String(u.id)
    })
  );
}

console.log('boards');
for (const b of boards) {
  await step(b.id, () =>
    convexMutation('boards:upsert', {
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
  await step(p.board_id + ' (' + (plan.tasks || []).length + ' tasks)', async () => {
    const res = await convexMutation('projectPlanning:save', buildProjectPlanPayload(p.board_id, plan));
    return res && res.counts;
  });
}

const remote = await convexQuery('boards:list', {}).catch(() => null);
const remoteIds = new Set((remote || []).map((b) => String(b.id ?? b.boardId)));
const localIds = new Set(boards.map((b) => String(b.id)));

const sqliteOnly = [...localIds].filter((id) => !remoteIds.has(id));
const convexOnly = [...remoteIds].filter((id) => !localIds.has(id));
console.log('sqlite boards not in convex: ' + (sqliteOnly.length ? sqliteOnly.join(', ') : 'none'));
console.log('convex boards not in sqlite: ' + (convexOnly.length ? convexOnly.join(', ') : 'none'));

if (pruneBoards && convexOnly.length) {
  console.log('pruning convex-only boards');
  for (const id of convexOnly) {
    await step(id, () => convexMutation('boards:remove', { boardId: id }));
  }
}

const planList = await convexQuery('projectPlanning:list', {}).catch(() => []);
console.log('convex projectPlans: ' + (planList || []).length);
for (const p of planList || []) {
  console.log('  - ' + p.boardId + ' | ' + p.projectName + ' | tasks=' + p.taskCount + ' milestones=' + p.milestoneCount + ' resources=' + p.resourceCount);
}

const one = (planList || [])[0];
if (one) {
  const detail = await convexQuery('projectPlanning:get', { boardId: one.boardId }).catch(() => null);
  if (detail && detail.sections) {
    console.log('section rows for ' + one.boardId + ':');
    for (const [name, rows] of Object.entries(detail.sections)) console.log('  ' + name + ': ' + rows.length);
  }
}

console.log(failures ? 'done with ' + failures + ' failure(s)' : 'done, no failures');
process.exitCode = failures ? 1 : 0;
