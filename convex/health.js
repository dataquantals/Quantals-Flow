import { query } from './_generated/server.js';
import { v } from 'convex/values';
import { assertServer } from './authHelpers';

/**
 * Authenticated health probe called by `server/convex.js:checkConvexConnection()`.
 *
 * Verifies not only HTTP edge reachability, but also:
 *   1. Functions are deployed on this Convex deployment,
 *   2. `SYNC_SECRET` is configured and matches between the Node server and Convex,
 *   3. Convex DB read path is responsive.
 */
export const ping = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const sampleUser = await ctx.db.query('users').first();
    return {
      ok: true,
      hasUsers: Boolean(sampleUser),
      timestamp: Date.now()
    };
  }
});
