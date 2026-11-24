import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

export const getHub = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('knowledgeHubs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!existing) return null;
    return { stateJson: existing.stateJson, updatedAt: existing.updatedAt };
  }
});

export const saveHub = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    stateJson: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('knowledgeHubs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    const now = args.updatedAt || Date.now();
    const doc = { userId, stateJson: args.stateJson, updatedAt: now };
    const id = existing
      ? (await ctx.db.patch(existing._id, doc), existing._id)
      : await ctx.db.insert('knowledgeHubs', doc);
    return { id, updatedAt: now };
  }
});
