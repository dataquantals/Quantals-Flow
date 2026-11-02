import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  }
});

export const getFileUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  }
});

export const saveAvatar = mutation({
  args: {
    email: v.string(),
    storageId: v.id('_storage')
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    const normalized = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        avatarUrl: url || undefined,
        avatarStorageId: String(args.storageId)
      });
    }
    return { url, storageId: String(args.storageId) };
  }
});
