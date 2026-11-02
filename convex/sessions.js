import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
    if (!session) return null;
    if (session.expiresAt <= Date.now()) return null;
    return session;
  }
});

export const create = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    expiresAt: v.number()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    const id = await ctx.db.insert('sessions', {
      token: args.token,
      userId: args.userId,
      email: args.email,
      name: args.name,
      role: args.role,
      createdAt: Date.now(),
      expiresAt: args.expiresAt
    });
    return await ctx.db.get(id);
  }
});

export const removeByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  }
});
