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
const folders = db
  .prepare('SELECT id, user_id, name, parent_id, created_at, updated_at FROM user_folders WHERE user_id IS NOT NULL')
  .all();
const files = db
  .prepare('SELECT id, user_id, folder_id, name, mime_type, size, extension, url, public_id, resource_type, visibility, uploaded_by, created_at FROM user_files WHERE user_id IS NOT NULL')
  .all();
const fileOrders = db
  .prepare('SELECT user_id, folder_id, order_json, updated_at FROM user_file_orders WHERE user_id IS NOT NULL')
  .all();
const preferences = db
  .prepare('SELECT user_id, files_view_mode, files_sort_by, updated_at FROM user_preferences WHERE user_id IS NOT NULL')
  .all();
const quotations = db
  .prepare('SELECT user_id, data_json, updated_at FROM user_quotations WHERE user_id IS NOT NULL')
  .all();
const invoices = db
  .prepare('SELECT user_id, data_json, updated_at FROM user_invoices WHERE user_id IS NOT NULL')
  .all();
const receipts = db
  .prepare('SELECT user_id, data_json, updated_at FROM user_receipts WHERE user_id IS NOT NULL')
  .all();
const notepads = db
  .prepare('SELECT user_id, notes_json, updated_at FROM user_notepads WHERE user_id IS NOT NULL')
  .all();

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

console.log('user folders');
for (const f of folders) {
  await step(`${f.id} (${f.name}, user ${f.user_id})`, () =>
    convexMutation('userFiles:upsertFolder', {
      userId: String(f.user_id),
      folderId: String(f.id),
      name: String(f.name || ''),
      parentId: f.parent_id ? String(f.parent_id) : undefined,
      createdAt: Number(f.created_at || Date.now()),
      updatedAt: Number(f.updated_at || Date.now())
    })
  );
}

console.log('user files');
for (const f of files) {
  await step(`${f.id} (${f.name}, user ${f.user_id})`, () =>
    convexMutation('userFiles:upsertFile', {
      userId: String(f.user_id),
      fileId: String(f.id),
      folderId: f.folder_id ? String(f.folder_id) : undefined,
      name: String(f.name || ''),
      mimeType: String(f.mime_type || 'application/octet-stream'),
      size: Number(f.size || 0),
      extension: String(f.extension || ''),
      url: String(f.url || ''),
      publicId: f.public_id ? String(f.public_id) : undefined,
      resourceType: f.resource_type ? String(f.resource_type) : undefined,
      visibility: String(f.visibility || 'coordinators'),
      uploadedBy: String(f.uploaded_by || ''),
      createdAt: Number(f.created_at || Date.now()),
      updatedAt: Number(f.created_at || Date.now())
    })
  );
}

console.log('file orders');
for (const fo of fileOrders) {
  await step(`folder ${fo.folder_id} (user ${fo.user_id})`, () =>
    convexMutation('userFiles:upsertFileOrder', {
      userId: String(fo.user_id),
      folderId: String(fo.folder_id || 'root'),
      orderJson: String(fo.order_json || '{}'),
      updatedAt: Number(fo.updated_at || Date.now())
    })
  );
}

console.log('user preferences');
for (const pr of preferences) {
  await step(`user ${pr.user_id}`, () =>
    convexMutation('userFiles:upsertPreferences', {
      userId: String(pr.user_id),
      filesViewMode: String(pr.files_view_mode || 'grid'),
      filesSortBy: String(pr.files_sort_by || 'date-desc'),
      updatedAt: Number(pr.updated_at || Date.now())
    })
  );
}

console.log('quotations');
for (const q of quotations) {
  await step(`quotation for user ${q.user_id}`, () =>
    convexMutation('quotations:upsertQuotation', {
      userId: String(q.user_id),
      quotationJson: String(q.data_json || '{}'),
      updatedAt: Number(q.updated_at || Date.now())
    })
  );
}

console.log('invoices');
for (const inv of invoices) {
  await step(`invoice for user ${inv.user_id}`, () =>
    convexMutation('invoices:upsertInvoice', {
      userId: String(inv.user_id),
      invoiceJson: String(inv.data_json || '{}'),
      updatedAt: Number(inv.updated_at || Date.now())
    })
  );
}

console.log('receipts');
for (const rcp of receipts) {
  await step(`receipt for user ${rcp.user_id}`, () =>
    convexMutation('receipts:upsertReceipt', {
      userId: String(rcp.user_id),
      receiptJson: String(rcp.data_json || '{}'),
      updatedAt: Number(rcp.updated_at || Date.now())
    })
  );
}

console.log('notepads');
for (const np of notepads) {
  await step(`notepad for user ${np.user_id}`, () =>
    convexMutation('notepad:saveNotes', {
      userId: String(np.user_id),
      notesJson: String(np.notes_json || '[]'),
      updatedAt: Number(np.updated_at || Date.now())
    })
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
