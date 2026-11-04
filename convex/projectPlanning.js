import { query, mutation } from './_generated/server.js';
import { v, ConvexError } from 'convex/values';
import { requireUser, owns } from './authHelpers';

/**
 * Project Planning sync.
 *
 * The workspace state is a single object holding nine list sections. The browser
 * is the editor, so the sync is "last write wins" per board: each save sends the
 * whole snapshot plus the already-flattened sections, and this module upserts the
 * plan row, upserts changed entity rows and prunes rows that disappeared.
 *
 * Keeping the snapshot as well as the rows is deliberate: the snapshot restores
 * the exact UI state, while the rows make the plan queryable (dashboard, reports,
 * future server-side scheduling) without parsing a JSON blob.
 */

const ENTITY_INPUT = v.object({
  entityId: v.string(),
  position: v.number(),
  title: v.optional(v.string()),
  status: v.optional(v.string()),
  owner: v.optional(v.string()),
  date: v.optional(v.string()),
  dataJson: v.string(),
  updatedAt: v.optional(v.number())
});

/** Sections of the plan state that get their own Convex table. */
export const SECTIONS = {
  phases: 'projectPhases',
  tasks: 'projectTasks',
  milestones: 'projectMilestones',
  resources: 'projectResources',
  timesheets: 'projectTimesheets',
  wikiPages: 'projectWikiPages',
  files: 'projectFiles',
  raidItems: 'projectRaidItems',
  changeRequests: 'projectChangeRequests'
};

const cleanup = (value) =>
  value === undefined || value === null ? undefined : String(value).slice(0, 500);

function rowFrom(entity, boardId, userId, position, now) {
  return {
    boardId,
    userId,
    entityId: String(entity.entityId),
    position,
    title: cleanup(entity.title),
    status: cleanup(entity.status),
    owner: cleanup(entity.owner),
    date: cleanup(entity.date),
    dataJson: String(entity.dataJson || '{}'),
    updatedAt: entity.updatedAt || now
  };
}

/** Upsert + prune one section. Returns how many rows were written/removed. */
async function syncSection(ctx, tableName, boardId, userId, entities, now) {
  const existing = await ctx.db
    .query(tableName)
    .withIndex('by_board', (q) => q.eq('boardId', boardId))
    .collect();

  const stale = new Map(existing.map((doc) => [doc.entityId, doc]));
  let inserted = 0;
  let patched = 0;
  let removed = 0;

  for (let i = 0; i < entities.length; i++) {
    const doc = rowFrom(entities[i], boardId, userId, i, now);
    const previous = stale.get(doc.entityId);
    if (!previous) {
      await ctx.db.insert(tableName, doc);
      inserted++;
      continue;
    }
    stale.delete(doc.entityId);
    const changed =
      previous.dataJson !== doc.dataJson ||
      previous.position !== doc.position ||
      previous.title !== doc.title ||
      previous.status !== doc.status ||
      previous.owner !== doc.owner ||
      previous.date !== doc.date ||
      previous.userId !== doc.userId;
    if (changed) {
      await ctx.db.patch(previous._id, doc);
      patched++;
    }
  }

  for (const leftover of stale.values()) {
    await ctx.db.delete(leftover._id);
    removed++;
  }

  return { inserted, patched, removed };
}

/** GET-style query: the plan snapshot for a board. */
export const get = query({
  args: { secret: v.string(), userId: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const plan = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    // Someone else's plan is indistinguishable from a missing one.
    if (!plan || !owns(plan, userId)) return null;

    const sections = {};
    for (const [key, table] of Object.entries(SECTIONS)) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_board', (q) => q.eq('boardId', args.boardId))
        .collect();
      sections[key] = rows
        .sort((a, b) => a.position - b.position)
        .map((row) => {
          try {
            return JSON.parse(row.dataJson);
          } catch {
            return { id: row.entityId };
          }
        });
    }

    let snapshot = null;
    try {
      snapshot = JSON.parse(plan.snapshotJson);
    } catch {
      snapshot = null;
    }

    return { plan: { ...plan, snapshot }, sections };
  }
});

/** Dashboard-friendly summary of every stored plan. */
export const list = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const rows = await ctx.db
      .query('projectPlans')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.map((row) => ({
      boardId: row.boardId,
      projectName: row.projectName,
      projectCode: row.projectCode,
      taskCount: row.taskCount,
      milestoneCount: row.milestoneCount,
      resourceCount: row.resourceCount,
      updatedAt: row.updatedAt
    }));
  }
});

/**
 * Replace a board's plan. Sections are optional so a metadata-only save does not
 * wipe tasks the caller did not send.
 */
export const save = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    boardId: v.string(),
    projectName: v.string(),
    projectCode: v.optional(v.string()),
    activeSprint: v.optional(v.string()),
    baseBudget: v.optional(v.number()),
    currency: v.optional(v.string()),
    owner: v.optional(v.string()),
    status: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    stateVersion: v.optional(v.number()),
    snapshotJson: v.string(),
    phases: v.optional(v.array(ENTITY_INPUT)),
    tasks: v.optional(v.array(ENTITY_INPUT)),
    milestones: v.optional(v.array(ENTITY_INPUT)),
    resources: v.optional(v.array(ENTITY_INPUT)),
    timesheets: v.optional(v.array(ENTITY_INPUT)),
    wikiPages: v.optional(v.array(ENTITY_INPUT)),
    files: v.optional(v.array(ENTITY_INPUT)),
    raidItems: v.optional(v.array(ENTITY_INPUT)),
    changeRequests: v.optional(v.array(ENTITY_INPUT))
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const now = Date.now();
    const sections = {};
    for (const key of Object.keys(SECTIONS)) sections[key] = args[key] || [];

    const counts = {
      taskCount: sections.tasks.length,
      milestoneCount: sections.milestones.length,
      resourceCount: sections.resources.length
    };

    const existing = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();

    // A plan that already belongs to someone else can never be overwritten.
    if (existing && !owns(existing, userId)) throw new ConvexError('Forbidden');

    const planFields = {
      boardId: args.boardId,
      userId,
      projectName: args.projectName,
      projectCode: cleanup(args.projectCode),
      activeSprint: cleanup(args.activeSprint),
      baseBudget: typeof args.baseBudget === 'number' ? args.baseBudget : 0,
      currency: cleanup(args.currency),
      owner: cleanup(args.owner),
      status: cleanup(args.status),
      startDate: cleanup(args.startDate),
      endDate: cleanup(args.endDate),
      stateVersion: args.stateVersion || 1,
      snapshotJson: args.snapshotJson,
      ...counts,
      updatedAt: now
    };

    if (existing) await ctx.db.patch(existing._id, planFields);
    else await ctx.db.insert('projectPlans', planFields);

    const stats = {};
    for (const [key, table] of Object.entries(SECTIONS)) {
      stats[key] = await syncSection(ctx, table, args.boardId, userId, sections[key], now);
    }

    return {
      boardId: args.boardId,
      updatedAt: now,
      counts,
      stats
    };
  }
});

/** Delete a plan and every entity row that belongs to it. */
export const remove = mutation({
  args: { secret: v.string(), userId: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const plan = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    if (!plan) return true;
    if (!owns(plan, userId)) throw new ConvexError('Forbidden');

    for (const table of Object.values(SECTIONS)) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_board', (q) => q.eq('boardId', args.boardId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    await ctx.db.delete(plan._id);
    return true;
  }
});
