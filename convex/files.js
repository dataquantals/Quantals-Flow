import { mutation, query } from './_generated/server.js';
import { v, ConvexError } from 'convex/values';
import { assertServer, requireUser } from './authHelpers';

// Storage ids are unguessable, but upload URLs and file URLs are still gated by
// the server-only secret so a stranger cannot fill storage or resolve ids.

export const generateUploadUrl = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    requireUser(args);
    return await ctx.storage.generateUploadUrl();
  }
});

export const getFileUrl = query({
  args: { secret: v.string(), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    return await ctx.storage.getUrl(args.storageId);
  }
});

export const saveAvatar = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    email: v.string(),
    storageId: v.id('_storage')
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const normalized = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();

    // The avatar may only be written onto the caller's own user row.
    if (existing && existing.externalId !== userId) throw new ConvexError('Forbidden');

    const url = await ctx.storage.getUrl(args.storageId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        avatarUrl: url || undefined,
        avatarStorageId: String(args.storageId)
      });
    }
    return { url, storageId: String(args.storageId) };
  }
});
