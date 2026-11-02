import { mutation } from './_generated/server.js';

export const seedWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Ensure Owner User exists in `users` table
    const ownerEmail = 'dataquantals@gmail.com';
    const existingOwner = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', ownerEmail))
      .first();

    let ownerId;
    if (!existingOwner) {
      ownerId = await ctx.db.insert('users', {
        email: ownerEmail,
        name: 'Owner',
        role: 'owner',
        createdAt: now
      });
    } else {
      ownerId = existingOwner._id;
    }

    // 2. Ensure default workspace boards exist in `boards` table
    const defaultBoards = [
      {
        boardId: 'q4-intelligent-canvas',
        title: 'Q4 Intelligent Canvas & Architecture',
        category: 'AI & Product Strategy',
        starred: true,
        stateJson: '{}'
      },
      {
        boardId: 'system-architecture-flow',
        title: 'Microservices & MCP Agent Flow',
        category: 'Engineering & Delivery',
        starred: true,
        stateJson: '{}'
      },
      {
        boardId: 'sprint-42-kanban',
        title: 'Sprint 42 Planning & Kanban',
        category: 'Engineering & Delivery',
        starred: false,
        stateJson: '{}'
      },
      {
        boardId: 'customer-journey-2026',
        title: 'Enterprise Onboarding Journey Map',
        category: 'UX & Discovery',
        starred: false,
        stateJson: '{}'
      },
      {
        boardId: 'ai-transformation-roadmap',
        title: '2026 AI Transformation Roadmap',
        category: 'AI & Product Strategy',
        starred: true,
        stateJson: '{}'
      },
      {
        boardId: 'sprint-retro-workshop',
        title: 'Product & Design Retro Workshop',
        category: 'UX & Discovery',
        starred: false,
        stateJson: '{}'
      }
    ];

    let insertedBoards = 0;
    for (let i = 0; i < defaultBoards.length; i++) {
      const b = defaultBoards[i];
      const existing = await ctx.db
        .query('boards')
        .withIndex('by_board_id', (q) => q.eq('boardId', b.boardId))
        .first();
      if (!existing) {
        await ctx.db.insert('boards', {
          boardId: b.boardId,
          userId: String(ownerId),
          title: b.title,
          category: b.category,
          starred: b.starred,
          stateJson: b.stateJson,
          createdAt: now - i * 3600000,
          updatedAt: now - i * 1800000
        });
        insertedBoards++;
      }
    }

    return {
      ok: true,
      ownerEmail,
      insertedBoards,
      totalDefaultBoards: defaultBoards.length
    };
  }
});
