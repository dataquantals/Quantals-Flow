import { mutation } from './_generated/server.js';
import { v } from 'convex/values';
import { assertServer } from './authHelpers';

export const createLead = mutation({
  args: {
    secret: v.string(),
    source: v.union(v.literal('hero'), v.literal('enterprise_contact')),
    email: v.string(),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    teamSize: v.optional(v.string()),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    assertServer(args.secret);
    const now = Date.now();
    const id = await ctx.db.insert('contactLeads', {
      source: args.source,
      email: args.email.trim().toLowerCase(),
      name: args.name ? args.name.trim().slice(0, 120) : undefined,
      company: args.company ? args.company.trim().slice(0, 120) : undefined,
      teamSize: args.teamSize ? args.teamSize.trim().slice(0, 40) : undefined,
      message: args.message ? args.message.trim().slice(0, 2000) : undefined,
      createdAt: now
    });
    return { id, createdAt: now };
  }
});
