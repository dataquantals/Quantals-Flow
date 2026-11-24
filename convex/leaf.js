import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

/** Retrieve the authenticated user's Leaf workspace (spaces + pages). */
export const getWorkspace = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('leafWorkspaces')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!existing) return null;
    return {
      spacesJson: existing.spacesJson,
      pagesJson: existing.pagesJson,
      curPageId: existing.curPageId,
      curSpaceId: existing.curSpaceId,
      uid: existing.uid,
      cid: existing.cid,
      updatedAt: existing.updatedAt
    };
  }
});

/** Upsert the authenticated user's Leaf workspace. */
export const saveWorkspace = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    spacesJson: v.string(),
    pagesJson: v.string(),
    curPageId: v.optional(v.string()),
    curSpaceId: v.optional(v.string()),
    uid: v.optional(v.number()),
    cid: v.optional(v.number()),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('leafWorkspaces')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    const now = args.updatedAt || Date.now();
    const doc = {
      userId,
      spacesJson: args.spacesJson,
      pagesJson: args.pagesJson,
      curPageId: args.curPageId,
      curSpaceId: args.curSpaceId,
      uid: args.uid,
      cid: args.cid,
      updatedAt: now
    };

    const id = existing
      ? (await ctx.db.patch(existing._id, doc), existing._id)
      : await ctx.db.insert('leafWorkspaces', doc);

    return { id, updatedAt: now };
  }
});
