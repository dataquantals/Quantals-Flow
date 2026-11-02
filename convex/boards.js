import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';

export const list = query({
  args: {
    query: v.optional(v.string()),
    starredOnly: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('boards')
      .withIndex('by_updated_at')
      .order('desc')
      .collect();

    const q = (args.query || '').trim().toLowerCase();
    return all
      .filter((b) => {
        if (args.starredOnly && !b.starred) return false;
        if (q) {
          return (
            b.title.toLowerCase().includes(q) ||
            b.category.toLowerCase().includes(q)
          );
        }
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
  args: { boardId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();

    if (!row) return null;
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
});

export const upsert = mutation({
  args: {
    boardId: v.string(),
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    starred: v.optional(v.boolean()),
    stateJson: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();

    if (!existing) {
      await ctx.db.insert('boards', {
        boardId: args.boardId,
        userId: args.userId,
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

    let state = null;
    try {
      state = updated?.stateJson ? JSON.parse(updated.stateJson) : null;
      if (state && Object.keys(state).length === 0) state = null;
    } catch {
      state = null;
    }

    return {
      id: updated.boardId,
      title: updated.title,
      category: updated.category,
      starred: Boolean(updated.starred),
      state,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }
});

export const remove = mutation({
  args: { boardId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  }
});
