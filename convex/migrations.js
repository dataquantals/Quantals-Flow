import { mutation } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser, assertServer } from './authHelpers';
import { SECTIONS } from './projectPlanning.js';

/**
 * One-off, idempotent backfill for rows created before ownership existed.
 * Rows with no `userId` are invisible to everyone (see `owns`), so this assigns
 * them to the account that should keep them. Server-secret gated; safe to re-run
 * because it only touches rows that still have no owner.
 */
export const claimLegacy = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const counts = {};
    const tables = ['boards', 'projectPlans', ...Object.values(SECTIONS)];
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      let claimed = 0;
      for (const row of rows) {
        if (!row.userId) {
          await ctx.db.patch(row._id, { userId });
          claimed++;
        }
      }
      counts[table] = claimed;
    }
    return counts;
  }
});

/**
 * Realign ownership of a board to match the SQLite source of truth.
 */
export const realignBoard = mutation({
  args: { secret: v.string(), boardId: v.string(), targetUserId: v.string() },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const board = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    if (!board) return false;
    await ctx.db.patch(board._id, { userId: args.targetUserId });

    const plan = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', args.boardId))
      .first();
    if (plan) {
      await ctx.db.patch(plan._id, { userId: args.targetUserId });
    }

    for (const table of Object.values(SECTIONS)) {
      const items = await ctx.db
        .query(table)
        .withIndex('by_board', (q) => q.eq('boardId', args.boardId))
        .collect();
      for (const item of items) {
        await ctx.db.patch(item._id, { userId: args.targetUserId });
      }
    }
    return true;
  }
});

/**
 * Prune boards from Convex that no longer exist in SQLite.
 */
export const pruneBoards = mutation({
  args: { secret: v.string(), keepBoardIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const keep = new Set(args.keepBoardIds);
    const allBoards = await ctx.db.query('boards').collect();
    let deleted = 0;
    for (const b of allBoards) {
      if (!keep.has(b.boardId)) {
        await ctx.db.delete(b._id);
        deleted++;
      }
    }
    return { deleted };
  }
});
