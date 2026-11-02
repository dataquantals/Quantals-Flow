import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';

export const findByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();
  }
});

export const upsertUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    externalId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();

    const now = Date.now();
    if (!existing) {
      const id = await ctx.db.insert('users', {
        email: normalized,
        name: args.name,
        role: args.role || 'member',
        passwordHash: args.passwordHash,
        clerkId: args.clerkId,
        externalId: args.externalId,
        createdAt: now
      });
      return await ctx.db.get(id);
    }

    await ctx.db.patch(existing._id, {
      name: args.name || existing.name,
      role: args.role || existing.role,
      passwordHash: args.passwordHash !== undefined ? args.passwordHash : existing.passwordHash,
      clerkId: args.clerkId !== undefined ? args.clerkId : existing.clerkId,
      externalId: args.externalId !== undefined ? args.externalId : existing.externalId
    });
    return await ctx.db.get(existing._id);
  }
});
