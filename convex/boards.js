import { query, mutation } from './_generated/server.js';
import { v, ConvexError } from 'convex/values';
import { requireUser, owns } from './authHelpers';

function present(row) {
  let state = null;
  try {
    state = row.stateJson ? JSON.parse(row.stateJson) : null;
    if (state && Object.keys(state).length === 0) state = null;
  } catch {
    state = null;
  }
  return {
    id: row.boardId,
    title: row.title,
    category: row.category,
    starred: Boolean(row.starred),
    state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export const list = query({
  args: {
    secret: v.string(),
    userId: v.string(),
    query: v.optional(v.string()),
    starredOnly: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const mine = await ctx.db
      .query('boards')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    mine.sort((a, b) => b.updatedAt - a.updatedAt);

    const q = (args.query || '').trim().toLowerCase();
    return mine
      .filter((b) => {
        if (args.starredOnly && !b.starred) return false;
        if (q) return b.title.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
        return true;
      })
      .map((row) => ({
        id: row.boardId,
        title: row.title,
        category: row.category,
        starred: Boolean(row.starred),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        hasSavedState: Boolean(row.stateJson && row.stateJson !== '{}')
      }));
  }
});

export const getByBoardId = query({
  args: { secret: v.string(), userId: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const row = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    // Someone else's board is indistinguishable from a missing one.
    if (!row || !owns(row, userId)) return null;
    return present(row);
  }
});

export const upsert = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    boardId: v.string(),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    starred: v.optional(v.boolean()),
    stateJson: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const now = Date.now();
    const existing = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();

    if (existing && !owns(existing, userId)) throw new ConvexError('Forbidden');

    if (!existing) {
      // Ownership always comes from the authenticated caller, never from args.
      await ctx.db.insert('boards', {
        boardId: args.boardId,
        userId,
        title: args.title || 'New Collaborative Board',
        category: args.category || 'Strategy & Planning',
        starred: Boolean(args.starred),
        stateJson: args.stateJson || '{}',
        createdAt: now,
        updatedAt: now
      });
    } else {
      await ctx.db.patch(existing._id, {
        title: args.title !== undefined ? args.title : existing.title,
        category: args.category !== undefined ? args.category : existing.category,
        starred: args.starred !== undefined ? Boolean(args.starred) : existing.starred,
        stateJson: args.stateJson !== undefined ? args.stateJson : existing.stateJson,
        updatedAt: now
      });
    }

    const updated = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    return present(updated);
  }
});

export const remove = mutation({
  args: { secret: v.string(), userId: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const existing = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    if (!existing) return false;
    if (!owns(existing, userId)) throw new ConvexError('Forbidden');
    await ctx.db.delete(existing._id);
    return true;
  }
});
