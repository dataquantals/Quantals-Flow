import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

/** Retrieve the authenticated user's CRM workspace state. */
export const getWorkspace = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('crmWorkspaces')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!existing) return null;
    return {
      dataJson: existing.dataJson,
      updatedAt: existing.updatedAt
    };
  }
});

/** Upsert the authenticated user's CRM workspace state. */
export const saveWorkspace = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    dataJson: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('crmWorkspaces')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    const now = args.updatedAt || Date.now();
    const doc = {
      userId,
      dataJson: args.dataJson,
      updatedAt: now
    };
    const id = existing
      ? (await ctx.db.patch(existing._id, doc), existing._id)
      : await ctx.db.insert('crmWorkspaces', doc);
    return { id, updatedAt: now };
  }
});
