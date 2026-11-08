import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';
import { assertServer } from './authHelpers';

// A session token is a bearer credential, so every function here is gated by the
// server-only secret. Without it a caller could read or forge sessions.

export const getByToken = query({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
    if (!session) return null;
    if (session.expiresAt <= Date.now()) return null;
    const user = session.email
      ? await ctx.db
          .query('users')
          .withIndex('by_email', (q) => q.eq('email', session.email.trim().toLowerCase()))
          .first()
      : null;
    return {
      ...session,
      userId: user?.externalId || session.userId,
      name: user?.name || session.name,
      role: user?.role || session.role,
      title: user?.title ?? session.title ?? '',
      company: user?.company ?? session.company ?? '',
      bio: user?.bio ?? session.bio ?? '',
      avatarUrl: user?.avatarUrl ?? session.avatarUrl ?? '',
      avatarStorageId: user?.avatarStorageId ?? session.avatarStorageId ?? ''
    };
  }
});

export const create = mutation({
  args: {
    secret: v.string(),
    token: v.string(),
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.string()),
    expiresAt: v.number()
  },
  handler: async (ctx, args) => {
    assertServer(args.secret);
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
      title: args.title,
      company: args.company,
      bio: args.bio,
      avatarUrl: args.avatarUrl,
      avatarStorageId: args.avatarStorageId,
      createdAt: Date.now(),
      expiresAt: args.expiresAt
    });
    return await ctx.db.get(id);
  }
});

export const removeByToken = mutation({
  args: { secret: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const existing = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  }
});

export const removeByUserId = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }
    return sessions.length;
  }
});
