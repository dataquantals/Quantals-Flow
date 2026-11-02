import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server.js';
import { api } from './_generated/api.js';

const http = httpRouter();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        ok: true,
        service: 'quantals-flow-convex',
        cloudUrl: 'https://agreeable-starfish-202.convex.cloud',
        siteUrl: 'https://agreeable-starfish-202.convex.site'
      }),
      { status: 200, headers: corsHeaders }
    );
  })
});

http.route({
  path: '/api/boards',
  method: 'GET',
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (id) {
      const board = await ctx.runQuery(api.boards.getByBoardId, { boardId: id });
      if (!board) {
        return new Response(JSON.stringify({ error: 'Board not found.' }), { status: 404, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ board }), { status: 200, headers: corsHeaders });
    }
    const query = url.searchParams.get('q') || '';
    const starredOnly = url.searchParams.get('starred') === '1';
    const boards = await ctx.runQuery(api.boards.list, { query, starredOnly });
    return new Response(JSON.stringify({ boards }), { status: 200, headers: corsHeaders });
  })
});

http.route({
  path: '/api/boards',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const body = await req.json();
    const board = await ctx.runMutation(api.boards.upsert, {
      boardId: String(body.id || body.boardId || 'untitled-board'),
      userId: body.userId ? String(body.userId) : undefined,
      title: body.title,
      category: body.category,
      starred: body.starred,
      stateJson: body.state ? JSON.stringify(body.state) : body.stateJson
    });
    return new Response(JSON.stringify({ board }), { status: 200, headers: corsHeaders });
  })
});

http.route({
  path: '/api/boards',
  method: 'DELETE',
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    const removed = await ctx.runMutation(api.boards.remove, { boardId: id });
    return new Response(JSON.stringify({ ok: removed }), { status: removed ? 200 : 404, headers: corsHeaders });
  })
});

export default http;
