import { getRedisClient } from './redis.js';

/**
 * Redis OM (Object Mapping) + RediSearch + RedisJSON Layer (`server/redis-om.js`)
 *
 * Defines strongly-typed JSON schemas and RediSearch repositories for:
 *  1. Boards (`qf:board`)        — instant full-text search across board titles & categories
 *  2. CRM Contacts (`qf:crm_contact`) — fast full-text + status/tag search without hitting Convex
 *  3. Leaf Pages (`qf:leaf_page`) — instant full-text search across Leaf collaborative docs
 *
 * `redis-om` (and, transitively, `redis`) is loaded lazily so that an absent or
 * partially-installed optional Redis layer never prevents the server — and its
 * SQLite + Convex path — from booting. See server/redis.js for the same policy.
 */

let redisOm = null;
let redisOmLoadFailed = false;

async function loadRedisOm() {
  if (redisOm) return redisOm;
  if (redisOmLoadFailed) return null;
  try {
    redisOm = await import('redis-om');
    return redisOm;
  } catch (err) {
    redisOmLoadFailed = true;
    console.warn('[redis-om] redis-om module unavailable — Redis search disabled:', err && err.message);
    return null;
  }
}

const BOARD_FIELDS = {
  boardId: { type: 'string' },
  userId: { type: 'string' },
  title: { type: 'text' },
  category: { type: 'text' },
  starred: { type: 'boolean' },
  updatedAt: { type: 'number', sortable: true }
};

const CRM_CONTACT_FIELDS = {
  contactId: { type: 'string' },
  userId: { type: 'string' },
  name: { type: 'text' },
  company: { type: 'text' },
  email: { type: 'string' },
  phone: { type: 'string' },
  status: { type: 'string' },
  source: { type: 'string' },
  owner: { type: 'string' },
  score: { type: 'number', sortable: true },
  tags: { type: 'string[]' },
  updatedAt: { type: 'number', sortable: true }
};

const LEAF_PAGE_FIELDS = {
  pageId: { type: 'string' },
  userId: { type: 'string' },
  spaceId: { type: 'string' },
  title: { type: 'text' },
  status: { type: 'string' },
  snippet: { type: 'text' },
  updatedAt: { type: 'number', sortable: true }
};

const OM_GLOBAL_KEY = '__qfRedisOm';

function getOmState() {
  if (!globalThis[OM_GLOBAL_KEY]) {
    globalThis[OM_GLOBAL_KEY] = {
      repos: null,
      indexesReady: false,
      indexPromise: null
    };
  }
  return globalThis[OM_GLOBAL_KEY];
}

/** Build the redis-om schemas on first use (requires the lazily loaded module). */
function buildSchemas() {
  const { Schema } = redisOm;
  return {
    board: new Schema('qf:board', BOARD_FIELDS, { dataStructure: 'JSON' }),
    crmContact: new Schema('qf:crm_contact', CRM_CONTACT_FIELDS, { dataStructure: 'JSON' }),
    leafPage: new Schema('qf:leaf_page', LEAF_PAGE_FIELDS, { dataStructure: 'JSON' })
  };
}

async function ensureIndex(client, repo, schema, fields) {
  try {
    await repo.createIndex();
    return true;
  } catch (err) {
    const msg = String(err && err.message ? err.message : '');
    if (/Index already exists/i.test(msg)) return true;
    if (!/SEARCH_INDEX_NOT_FOUND|Index not found/i.test(msg)) {
      return false;
    }
    // Redis 8 / Redis Cloud changed FT.INFO missing-index error from "Unknown Index name"
    // to "SEARCH_INDEX_NOT_FOUND", so create the exact JSON index that redis-om expects.
    try {
      const args = ['FT.CREATE', schema.indexName, 'ON', 'JSON', 'PREFIX', '1', `${schema.schemaName}:`, 'SCHEMA'];
      for (const [field, def] of Object.entries(fields)) {
        if (def.type === 'string[]') {
          args.push(`$.${field}[*]`, 'AS', field, 'TAG');
        } else {
          args.push(`$.${field}`, 'AS', field);
          if (def.type === 'text') args.push('TEXT');
          else if (def.type === 'number') args.push('NUMERIC');
          else if (def.type === 'boolean') args.push('TAG');
          else args.push('TAG', 'SEPARATOR', '|');
        }
        if (def.sortable) args.push('SORTABLE');
      }
      await client.sendCommand(args);
      return true;
    } catch (createErr) {
      return /Index already exists/i.test(String(createErr && createErr.message));
    }
  }
}

export async function getRepositories() {
  const client = await getRedisClient();
  if (!client) return null;

  const om = await loadRedisOm();
  if (!om) return null;

  const state = getOmState();
  if (!state.repos || state.repos._client !== client) {
    const { Repository } = om;
    const schemas = buildSchemas();
    state.repos = {
      _client: client,
      schemas,
      boards: new Repository(schemas.board, client),
      crmContacts: new Repository(schemas.crmContact, client),
      leafPages: new Repository(schemas.leafPage, client)
    };
    state.indexesReady = false;
  }

  if (!state.indexesReady) {
    if (!state.indexPromise) {
      const schemas = state.repos.schemas;
      state.indexPromise = Promise.allSettled([
        ensureIndex(client, state.repos.boards, schemas.board, BOARD_FIELDS),
        ensureIndex(client, state.repos.crmContacts, schemas.crmContact, CRM_CONTACT_FIELDS),
        ensureIndex(client, state.repos.leafPages, schemas.leafPage, LEAF_PAGE_FIELDS)
      ])
        .then(() => { state.indexesReady = true; })
        .catch(() => {})
        .finally(() => { state.indexPromise = null; });
    }
    await state.indexPromise;
  }

  return state.repos;
}

/* ------------------------------------------------------------------ *
 * Boards — JSON Indexing & RediSearch
 * ------------------------------------------------------------------ */

export async function indexBoardInRedis(userId, board, ttlSeconds = 3600) {
  if (!userId || !board || !board.id) return false;
  const repos = await getRepositories();
  if (!repos) return false;
  try {
    const entityId = `${userId}:${board.id}`;
    await repos.boards.save(entityId, {
      boardId: String(board.id),
      userId: String(userId),
      title: String(board.title || 'Untitled Board'),
      category: String(board.category || 'Strategy & Planning'),
      starred: Boolean(board.starred),
      updatedAt: Number(board.updatedAt || Date.now())
    });
    if (ttlSeconds > 0) await repos.boards.expire(entityId, ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

export async function removeBoardFromRedis(userId, boardId) {
  if (!userId || !boardId) return false;
  const repos = await getRepositories();
  if (!repos) return false;
  try {
    await repos.boards.remove(`${userId}:${boardId}`);
    return true;
  } catch {
    return false;
  }
}

export async function searchBoardsInRedis(userId, query = '', starredOnly = false) {
  if (!userId) return null;
  const repos = await getRepositories();
  if (!repos) return null;
  try {
    let q = repos.boards.search().where('userId').equals(String(userId));
    if (starredOnly) q = q.and('starred').true();
    const clean = String(query || '').trim();
    if (clean) {
      q = q.and((sub) => sub.where('title').matches(clean).or('category').matches(clean));
    }
    const results = await q.sortDescending('updatedAt').return.all();
    return results.map((r) => ({
      id: r.boardId,
      title: r.title,
      category: r.category,
      starred: Boolean(r.starred),
      updatedAt: r.updatedAt
    }));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * CRM Contacts — JSON Indexing & RediSearch
 * ------------------------------------------------------------------ */

export async function indexCrmContactsInRedis(userId, contacts, ttlSeconds = 3600) {
  if (!userId || !Array.isArray(contacts)) return false;
  const repos = await getRepositories();
  if (!repos) return false;
  try {
    const now = Date.now();
    await Promise.all(
      contacts.slice(0, 200).map(async (c) => {
        if (!c || !c.id) return;
        const entityId = `${userId}:${c.id}`;
        await repos.crmContacts.save(entityId, {
          contactId: String(c.id),
          userId: String(userId),
          name: String(c.name || ''),
          company: String(c.company || ''),
          email: String(c.email || ''),
          phone: String(c.phone || ''),
          status: String(c.status || 'Lead'),
          source: String(c.source || 'Website'),
          owner: String(c.owner || 'Owner'),
          score: Number(c.score) || 0,
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          updatedAt: now
        });
        if (ttlSeconds > 0) await repos.crmContacts.expire(entityId, ttlSeconds);
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function searchCrmContactsInRedis(userId, query = '', status = '', tag = '') {
  if (!userId) return null;
  const repos = await getRepositories();
  if (!repos) return null;
  try {
    let q = repos.crmContacts.search().where('userId').equals(String(userId));
    if (status) q = q.and('status').equals(String(status));
    if (tag) q = q.and('tags').contains(String(tag));
    const clean = String(query || '').trim();
    if (clean) {
      q = q.and((sub) => sub.where('name').matches(clean).or('company').matches(clean));
    }
    return await q.sortDescending('updatedAt').return.all();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Leaf Pages — JSON Indexing & RediSearch
 * ------------------------------------------------------------------ */

export async function indexLeafPagesInRedis(userId, pagesObj, ttlSeconds = 3600) {
  if (!userId || !pagesObj || typeof pagesObj !== 'object') return false;
  const repos = await getRepositories();
  if (!repos) return false;
  try {
    const entries = Object.values(pagesObj).slice(0, 200);
    await Promise.all(
      entries.map(async (p) => {
        if (!p || !p.id) return;
        const entityId = `${userId}:${p.id}`;
        const plain = String(p.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
        await repos.leafPages.save(entityId, {
          pageId: String(p.id),
          userId: String(userId),
          spaceId: String(p.space || 'kb'),
          title: String(p.title || 'Untitled'),
          status: String(p.status || 'Draft'),
          snippet: plain,
          updatedAt: p.updated ? new Date(p.updated).getTime() || Date.now() : Date.now()
        });
        if (ttlSeconds > 0) await repos.leafPages.expire(entityId, ttlSeconds);
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function searchLeafPagesInRedis(userId, query = '', spaceId = '') {
  if (!userId) return null;
  const repos = await getRepositories();
  if (!repos) return null;
  try {
    let q = repos.leafPages.search().where('userId').equals(String(userId));
    if (spaceId) q = q.and('spaceId').equals(String(spaceId));
    const clean = String(query || '').trim();
    if (clean) {
      q = q.and((sub) => sub.where('title').matches(clean).or('snippet').matches(clean));
    }
    return await q.sortDescending('updatedAt').return.all();
  } catch {
    return null;
  }
}
