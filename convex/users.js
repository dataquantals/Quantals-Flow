import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';
import { assertServer } from './authHelpers';

// Credentials live here, so every function is gated by the server-only secret.
// Nothing in this file may be callable by an unauthenticated stranger.

export const findByEmail = query({
  args: { secret: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const normalized = args.email.trim().toLowerCase();
    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();
  }
});

export const upsertUser = mutation({
  args: {
    secret: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.optional(v.string()),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    bio: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    externalId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    assertServer(args.secret);
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
        title: args.title,
        company: args.company,
        bio: args.bio,
        passwordHash: args.passwordHash,
        clerkId: args.clerkId,
        externalId: args.externalId,
        avatarUrl: args.avatarUrl,
        avatarStorageId: args.avatarStorageId,
        createdAt: now
      });
      return await ctx.db.get(id);
    }

    await ctx.db.patch(existing._id, {
      name: args.name || existing.name,
      role: args.role || existing.role,
      title: args.title !== undefined ? args.title : existing.title,
      company: args.company !== undefined ? args.company : existing.company,
      bio: args.bio !== undefined ? args.bio : existing.bio,
      passwordHash: args.passwordHash !== undefined ? args.passwordHash : existing.passwordHash,
      clerkId: args.clerkId !== undefined ? args.clerkId : existing.clerkId,
      externalId: args.externalId !== undefined ? args.externalId : existing.externalId,
      avatarUrl: args.avatarUrl !== undefined ? args.avatarUrl : existing.avatarUrl,
      avatarStorageId: args.avatarStorageId !== undefined ? args.avatarStorageId : existing.avatarStorageId
    });
    return await ctx.db.get(existing._id);
  }
});

export const updatePassword = mutation({
  args: { secret: v.string(), email: v.string(), passwordHash: v.string() },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const normalized = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();
    if (!existing) return false;
    await ctx.db.patch(existing._id, { passwordHash: args.passwordHash });
    return true;
  }
});
