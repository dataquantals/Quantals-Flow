import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Entity row shared by every project-planning collection.
 *
 * `entityId` is the client-side id (e.g. TSK-101, res-3, MS-1) and is stable
 * across saves, so re-syncing a plan upserts rows instead of duplicating them.
 * `dataJson` keeps the full original object so nothing is lost if the client
 * adds fields, while the typed columns below make the data queryable from the
 * Convex dashboard and from server-side helpers.
 */
const planningEntity = {
  boardId: v.string(),
  entityId: v.string(),
  position: v.number(),
  title: v.optional(v.string()),
  status: v.optional(v.string()),
  owner: v.optional(v.string()),
  date: v.optional(v.string()),
  dataJson: v.string(),
  updatedAt: v.number()
};

const planningIndexes = (table) =>
  table.index('by_board', ['boardId']).index('by_board_entity', ['boardId', 'entityId']);

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.string(),
    passwordHash: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    externalId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_email', ['email'])
    .index('by_clerk_id', ['clerkId']),

  sessions: defineTable({
    token: v.string(),
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    createdAt: v.number(),
    expiresAt: v.number()
  })
    .index('by_token', ['token'])
    .index('by_expires', ['expiresAt']),

  boards: defineTable({
    boardId: v.string(),
    userId: v.optional(v.string()),
    title: v.string(),
    category: v.string(),
    starred: v.boolean(),
    stateJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_board_id', ['boardId'])
    .index('by_updated_at', ['updatedAt']),

  /* ------------------------------------------------------------------ *
   * Project Planning workspace (one row per board, plus one collection
   * per plan section). Mirrors SQLite `project_plans` and the browser
   * plan so the data is queryable in Convex instead of living only in
   * a stateJson blob / localStorage.
   * ------------------------------------------------------------------ */
  projectPlans: defineTable({
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
    // Authoritative full snapshot, so a client with a cold cache can restore
    // the exact plan (including UI state) in one read.
    snapshotJson: v.string(),
    taskCount: v.number(),
    milestoneCount: v.number(),
    resourceCount: v.number(),
    updatedAt: v.number()
  })
    .index('by_board_id', ['boardId'])
    .index('by_updated_at', ['updatedAt']),

  projectPhases: planningIndexes(defineTable(planningEntity)),
  projectTasks: planningIndexes(defineTable(planningEntity)),
  projectMilestones: planningIndexes(defineTable(planningEntity)),
  projectResources: planningIndexes(defineTable(planningEntity)),
  projectTimesheets: planningIndexes(defineTable(planningEntity)),
  projectWikiPages: planningIndexes(defineTable(planningEntity)),
  projectFiles: planningIndexes(defineTable(planningEntity)),
  projectRaidItems: planningIndexes(defineTable(planningEntity)),
  projectChangeRequests: planningIndexes(defineTable(planningEntity))
});
