import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

/* ------------------------------------------------------------------ *
 * Folders
 * ------------------------------------------------------------------ */

export const listFolders = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    return await ctx.db
      .query('userFolders')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  }
});

export const upsertFolder = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    folderId: v.string(),
    name: v.string(),
    parentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userFolders')
      .withIndex('by_user_folder', (q) =>
        q.eq('userId', userId).eq('folderId', args.folderId)
      )
      .first();

    const doc = {
      folderId: args.folderId,
      userId,
      name: args.name,
      parentId: args.parentId || undefined,
      createdAt: existing ? existing.createdAt : args.createdAt,
      updatedAt: args.updatedAt
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert('userFolders', doc);
  }
});

export const deleteFolder = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    folderId: v.string()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userFolders')
      .withIndex('by_user_folder', (q) =>
        q.eq('userId', userId).eq('folderId', args.folderId)
      )
      .first();
    if (!existing) return { deleted: false };

    const newParent = existing.parentId || undefined;
    const now = Date.now();

    // Reparent child folders up one level
    const childFolders = await ctx.db
      .query('userFolders')
      .withIndex('by_user_parent', (q) =>
        q.eq('userId', userId).eq('parentId', args.folderId)
      )
      .collect();
    for (const cf of childFolders) {
      await ctx.db.patch(cf._id, { parentId: newParent, updatedAt: now });
    }

    // Reparent child files up one level
    const childFiles = await ctx.db
      .query('userFiles')
      .withIndex('by_user_folder', (q) =>
        q.eq('userId', userId).eq('folderId', args.folderId)
      )
      .collect();
    for (const file of childFiles) {
      await ctx.db.patch(file._id, { folderId: newParent, updatedAt: now });
    }

    await ctx.db.delete(existing._id);
    return { deleted: true };
  }
});

/* ------------------------------------------------------------------ *
 * Files
 * ------------------------------------------------------------------ */

export const listFiles = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    return await ctx.db
      .query('userFiles')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  }
});

export const upsertFile = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    fileId: v.string(),
    folderId: v.optional(v.string()),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    extension: v.string(),
    url: v.string(),
    publicId: v.optional(v.string()),
    resourceType: v.optional(v.string()),
    visibility: v.string(),
    uploadedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userFiles')
      .withIndex('by_user_file', (q) =>
        q.eq('userId', userId).eq('fileId', args.fileId)
      )
      .first();

    const doc = {
      fileId: args.fileId,
      userId,
      folderId: args.folderId || undefined,
      name: args.name,
      mimeType: args.mimeType,
      size: args.size,
      extension: args.extension,
      url: args.url,
      publicId: args.publicId || undefined,
      resourceType: args.resourceType || undefined,
      visibility: args.visibility,
      uploadedBy: args.uploadedBy,
      createdAt: existing ? existing.createdAt : args.createdAt,
      updatedAt: args.updatedAt
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert('userFiles', doc);
  }
});

export const moveFile = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    fileId: v.string(),
    folderId: v.optional(v.string()),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userFiles')
      .withIndex('by_user_file', (q) =>
        q.eq('userId', userId).eq('fileId', args.fileId)
      )
      .first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      folderId: args.folderId || undefined,
      updatedAt: args.updatedAt
    });
    return existing._id;
  }
});

export const deleteFile = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    fileId: v.string()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userFiles')
      .withIndex('by_user_file', (q) =>
        q.eq('userId', userId).eq('fileId', args.fileId)
      )
      .first();
    if (!existing) return { deleted: false };
    await ctx.db.delete(existing._id);
    return { deleted: true };
  }
});

/* ------------------------------------------------------------------ *
 * Custom File Ordering
 * ------------------------------------------------------------------ */

export const getFileOrder = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    folderId: v.string()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    return await ctx.db
      .query('userFileOrders')
      .withIndex('by_user_folder', (q) =>
        q.eq('userId', userId).eq('folderId', args.folderId)
      )
      .first();
  }
});

export const upsertFileOrder = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    folderId: v.string(),
    orderJson: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userFileOrders')
      .withIndex('by_user_folder', (q) =>
        q.eq('userId', userId).eq('folderId', args.folderId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        orderJson: args.orderJson,
        updatedAt: args.updatedAt
      });
      return existing._id;
    }
    return await ctx.db.insert('userFileOrders', {
      userId,
      folderId: args.folderId,
      orderJson: args.orderJson,
      updatedAt: args.updatedAt
    });
  }
});

/* ------------------------------------------------------------------ *
 * User Preferences (Grid/List View Mode & Sort Order)
 * ------------------------------------------------------------------ */

export const getPreferences = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    return await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
  }
});

export const upsertPreferences = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    filesViewMode: v.string(),
    filesSortBy: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        filesViewMode: args.filesViewMode,
        filesSortBy: args.filesSortBy,
        updatedAt: args.updatedAt
      });
      return existing._id;
    }
    return await ctx.db.insert('userPreferences', {
      userId,
      filesViewMode: args.filesViewMode,
      filesSortBy: args.filesSortBy,
      updatedAt: args.updatedAt
    });
  }
});
