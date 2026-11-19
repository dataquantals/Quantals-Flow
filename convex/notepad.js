import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

/**
 * Retrieve the saved notepad notes array for the authenticated user.
 */
export const getNotes = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('userNotepads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    if (!existing) return null;
    return {
      notesJson: existing.notesJson,
      noteCount: existing.noteCount,
      updatedAt: existing.updatedAt
    };
  }
});

/**
 * Upsert the notepad notes JSON for the authenticated user.
 */
export const saveNotes = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    notesJson: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    let parsed = [];
    try {
      const raw = JSON.parse(args.notesJson || '[]');
      parsed = Array.isArray(raw) ? raw : [];
    } catch {
      parsed = [];
    }

    const existing = await ctx.db
      .query('userNotepads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    const now = args.updatedAt || Date.now();
    const doc = {
      userId,
      notesJson: args.notesJson,
      noteCount: parsed.length,
      updatedAt: now
    };

    let id;
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      id = existing._id;
    } else {
      id = await ctx.db.insert('userNotepads', doc);
    }

    return {
      id,
      noteCount: parsed.length,
      updatedAt: now
    };
  }
});
