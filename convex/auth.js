import { query, mutation } from './_generated/server.js';
import { v } from 'convex/values';
import { SECTIONS } from './projectPlanning.js';

/**
 * Convex Auth & Session Engine (`convex/auth.js`)
 *
 * Provides native Convex authentication, session management, and session-scoped
 * data access so both the Node/Vercel API layer and the browser client can
 * authenticate directly against Convex Cloud without relying on ephemeral
 * serverless disk state.
 */

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const BLANK_PP_BOARD_ID = 'project-planning-workspace';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- Base64url helpers (Web standard, no Node Buffer required) ---------- */
function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const base64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/* ---------- RFC 7914 scrypt (WebCrypto PBKDF2-SHA256 + Salsa20/8 ROMix) ---------- */
function salsa20_8(B) {
  const x = new Int32Array(16);
  for (let i = 0; i < 16; i++) x[i] = B[i];
  for (let i = 8; i > 0; i -= 2) {
    let u = (x[0] + x[12]) | 0; x[4] ^= (u << 7) | (u >>> 25);
    u = (x[4] + x[0]) | 0; x[8] ^= (u << 9) | (u >>> 23);
    u = (x[8] + x[4]) | 0; x[12] ^= (u << 13) | (u >>> 19);
    u = (x[12] + x[8]) | 0; x[0] ^= (u << 18) | (u >>> 14);

    u = (x[5] + x[1]) | 0; x[9] ^= (u << 7) | (u >>> 25);
    u = (x[9] + x[5]) | 0; x[13] ^= (u << 9) | (u >>> 23);
    u = (x[13] + x[9]) | 0; x[1] ^= (u << 13) | (u >>> 19);
    u = (x[1] + x[13]) | 0; x[5] ^= (u << 18) | (u >>> 14);

    u = (x[10] + x[6]) | 0; x[14] ^= (u << 7) | (u >>> 25);
    u = (x[14] + x[10]) | 0; x[2] ^= (u << 9) | (u >>> 23);
    u = (x[2] + x[14]) | 0; x[6] ^= (u << 13) | (u >>> 19);
    u = (x[6] + x[2]) | 0; x[10] ^= (u << 18) | (u >>> 14);

    u = (x[15] + x[11]) | 0; x[3] ^= (u << 7) | (u >>> 25);
    u = (x[3] + x[15]) | 0; x[7] ^= (u << 9) | (u >>> 23);
    u = (x[7] + x[3]) | 0; x[11] ^= (u << 13) | (u >>> 19);
    u = (x[11] + x[7]) | 0; x[15] ^= (u << 18) | (u >>> 14);

    u = (x[0] + x[3]) | 0; x[1] ^= (u << 7) | (u >>> 25);
    u = (x[1] + x[0]) | 0; x[2] ^= (u << 9) | (u >>> 23);
    u = (x[2] + x[1]) | 0; x[3] ^= (u << 13) | (u >>> 19);
    u = (x[3] + x[2]) | 0; x[0] ^= (u << 18) | (u >>> 14);

    u = (x[5] + x[4]) | 0; x[6] ^= (u << 7) | (u >>> 25);
    u = (x[6] + x[5]) | 0; x[7] ^= (u << 9) | (u >>> 23);
    u = (x[7] + x[6]) | 0; x[4] ^= (u << 13) | (u >>> 19);
    u = (x[4] + x[7]) | 0; x[5] ^= (u << 18) | (u >>> 14);

    u = (x[10] + x[9]) | 0; x[11] ^= (u << 7) | (u >>> 25);
    u = (x[11] + x[10]) | 0; x[8] ^= (u << 9) | (u >>> 23);
    u = (x[8] + x[11]) | 0; x[9] ^= (u << 13) | (u >>> 19);
    u = (x[9] + x[8]) | 0; x[10] ^= (u << 18) | (u >>> 14);

    u = (x[15] + x[14]) | 0; x[12] ^= (u << 7) | (u >>> 25);
    u = (x[12] + x[15]) | 0; x[13] ^= (u << 9) | (u >>> 23);
    u = (x[13] + x[12]) | 0; x[14] ^= (u << 13) | (u >>> 19);
    u = (x[14] + x[13]) | 0; x[15] ^= (u << 18) | (u >>> 14);
  }
  for (let i = 0; i < 16; i++) B[i] = (B[i] + x[i]) | 0;
}

function blockMix(B, Y, r) {
  const X = new Int32Array(16);
  const blockOffset = (2 * r - 1) * 16;
  for (let i = 0; i < 16; i++) X[i] = B[blockOffset + i];
  for (let i = 0; i < 2 * r; i++) {
    const off = i * 16;
    for (let j = 0; j < 16; j++) X[j] ^= B[off + j];
    salsa20_8(X);
    const dest = ((i & 1) ? (r + (i >> 1)) : (i >> 1)) * 16;
    for (let j = 0; j < 16; j++) Y[dest + j] = X[j];
  }
  for (let i = 0; i < 32 * r; i++) B[i] = Y[i];
}

async function pbkdf2One(passBytes, saltBytes, dkLen) {
  const key = await crypto.subtle.importKey('raw', passBytes, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 1 },
    key,
    dkLen * 8
  );
  return new Uint8Array(bits);
}

async function scryptDerive(password, saltBytes, N, r, p, dkLen) {
  const passBytes = new TextEncoder().encode(password);
  const Bbytes = await pbkdf2One(passBytes, saltBytes, p * 128 * r);
  const B32 = new Int32Array(32 * r);
  const Y = new Int32Array(32 * r);
  const V = new Int32Array(32 * r * N);
  const view = new DataView(Bbytes.buffer, Bbytes.byteOffset, Bbytes.byteLength);

  for (let k = 0; k < p; k++) {
    const base = k * 128 * r;
    for (let i = 0; i < 32 * r; i++) B32[i] = view.getInt32(base + i * 4, true);
    for (let i = 0; i < N; i++) {
      V.set(B32, i * 32 * r);
      blockMix(B32, Y, r);
    }
    for (let i = 0; i < N; i++) {
      const j = B32[(2 * r - 1) * 16] & (N - 1);
      const vOff = j * 32 * r;
      for (let m = 0; m < 32 * r; m++) B32[m] ^= V[vOff + m];
      blockMix(B32, Y, r);
    }
    for (let i = 0; i < 32 * r; i++) view.setInt32(base + i * 4, B32[i], true);
  }
  return await pbkdf2One(passBytes, Bbytes, dkLen);
}

async function hashScryptPassword(password) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await scryptDerive(password, salt, N, r, p, 64);
  return ['scrypt', N, r, p, toBase64Url(salt), toBase64Url(key)].join('$');
}

async function verifyScryptPassword(password, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    const salt = fromBase64Url(saltB64);
    const expected = fromBase64Url(hashB64);
    const actual = await scryptDerive(password, salt, N, r, p, expected.length);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function publicUserFromDoc(doc, fallbackId = '1') {
  const rawId = doc.externalId || fallbackId;
  const numericId = Number(rawId);
  return {
    id: Number.isFinite(numericId) && numericId > 0 ? numericId : String(rawId),
    email: doc.email,
    name: doc.name,
    role: doc.role || 'member',
    title: doc.title || '',
    company: doc.company || '',
    bio: doc.bio || '',
    avatar_url: doc.avatarUrl || '',
    avatar_storage_id: doc.avatarStorageId || '',
    created_at: doc.createdAt || Date.now()
  };
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function scopeBoardId(boardId, userId) {
  const raw = String(boardId || '');
  if (raw === BLANK_PP_BOARD_ID || raw === 'new-project-planning-workspace') {
    return `${BLANK_PP_BOARD_ID}~${userId}`;
  }
  return raw;
}

function publicBoardId(boardId) {
  return String(boardId || '').split('~')[0];
}

async function resolveSessionUser(ctx, token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;
  const session = await ctx.db
    .query('sessions')
    .withIndex('by_token', (q) => q.eq('token', cleanToken))
    .first();
  if (!session || session.expiresAt <= Date.now()) return null;

  const user = await ctx.db
    .query('users')
    .withIndex('by_email', (q) => q.eq('email', session.email.trim().toLowerCase()))
    .first();
  if (!user) return null;

  const userId = String(user.externalId || session.userId || '1');
  return { session, user, userId, publicUser: publicUserFromDoc(user, userId) };
}

async function ensureBlankWorkspace(ctx, userId) {
  const internalId = `${BLANK_PP_BOARD_ID}~${userId}`;
  const existing = await ctx.db
    .query('boards')
    .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
    .first();
  if (!existing) {
    const now = Date.now();
    await ctx.db.insert('boards', {
      boardId: internalId,
      userId: String(userId),
      title: 'New Project Planning Workspace',
      category: 'AI & Product Strategy',
      starred: false,
      stateJson: JSON.stringify({ workspaceMode: 'project-planning' }),
      createdAt: now,
      updatedAt: now
    });
  }
}

/* ---------- Convex Auth Endpoints ---------- */

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    const email = String(args.email || '').trim().toLowerCase();
    const password = String(args.password || '');
    if (!email || !password) {
      return { ok: false, status: 400, error: 'Email and password are required.' };
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (!user || !user.passwordHash) {
      return { ok: false, status: 401, error: 'Incorrect email or password.' };
    }

    const valid = await verifyScryptPassword(password, user.passwordHash);
    if (!valid) {
      return { ok: false, status: 401, error: 'Incorrect email or password.' };
    }

    const userId = String(user.externalId || '1');
    if (!user.externalId) {
      await ctx.db.patch(user._id, { externalId: userId });
    }

    await ensureBlankWorkspace(ctx, userId);

    const token = randomToken(32);
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;

    await ctx.db.insert('sessions', {
      token,
      userId,
      email: user.email,
      name: user.name,
      role: user.role || 'member',
      title: user.title,
      company: user.company,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      avatarStorageId: user.avatarStorageId,
      createdAt: now,
      expiresAt
    });

    return {
      ok: true,
      status: 200,
      token,
      expiresAt,
      user: publicUserFromDoc(user, userId)
    };
  }
});

export const register = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string()
  },
  handler: async (ctx, args) => {
    const email = String(args.email || '').trim().toLowerCase();
    const name = String(args.name || '').trim();
    const password = String(args.password || '');
    const errors = {};

    if (!email) errors.email = 'Email is required.';
    else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
    if (!name) errors.name = 'Name is required.';
    else if (name.length > 80) errors.name = 'Name must be 80 characters or fewer.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
    else if (password.length > 200) errors.password = 'Password must be 200 characters or fewer.';

    if (Object.keys(errors).length > 0) {
      return { ok: false, status: 400, error: 'Please check the highlighted fields.', fields: errors };
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();
    if (existing) {
      return { ok: false, status: 409, error: 'An account with that email already exists.' };
    }

    const allUsers = await ctx.db.query('users').collect();
    const maxExtId = allUsers.reduce((max, u) => {
      const n = Number(u.externalId);
      return Number.isFinite(n) && n > max ? n : max;
    }, 4);
    const externalId = String(maxExtId + 1);
    const passwordHash = await hashScryptPassword(password);
    const now = Date.now();

    const docId = await ctx.db.insert('users', {
      email,
      name,
      role: 'member',
      passwordHash,
      externalId,
      createdAt: now
    });
    const user = await ctx.db.get(docId);

    await ensureBlankWorkspace(ctx, externalId);

    const token = randomToken(32);
    const expiresAt = now + SESSION_TTL_MS;
    await ctx.db.insert('sessions', {
      token,
      userId: externalId,
      email,
      name,
      role: 'member',
      createdAt: now,
      expiresAt
    });

    return {
      ok: true,
      status: 201,
      token,
      expiresAt,
      user: publicUserFromDoc(user, externalId)
    };
  }
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };
    return { ok: true, status: 200, user: resolved.publicUser };
  }
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const cleanToken = String(args.token || '').trim();
    if (cleanToken) {
      const existing = await ctx.db
        .query('sessions')
        .withIndex('by_token', (q) => q.eq('token', cleanToken))
        .first();
      if (existing) await ctx.db.delete(existing._id);
    }
    return { ok: true, status: 200 };
  }
});

export const updateProfile = mutation({
  args: {
    token: v.string(),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    bio: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    const patch = {};
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (!n) return { ok: false, status: 400, error: 'Name cannot be empty.' };
      if (n.length > 80) return { ok: false, status: 400, error: 'Name must be 80 characters or fewer.' };
      patch.name = n;
    }
    if (args.title !== undefined) {
      if (args.title.length > 100) return { ok: false, status: 400, error: 'Job title must be 100 characters or fewer.' };
      patch.title = args.title.trim();
    }
    if (args.company !== undefined) {
      if (args.company.length > 100) return { ok: false, status: 400, error: 'Company must be 100 characters or fewer.' };
      patch.company = args.company.trim();
    }
    if (args.bio !== undefined) {
      if (args.bio.length > 500) return { ok: false, status: 400, error: 'Bio must be 500 characters or fewer.' };
      patch.bio = args.bio.trim();
    }

    await ctx.db.patch(resolved.user._id, patch);
    const updated = await ctx.db.get(resolved.user._id);
    return {
      ok: true,
      status: 200,
      user: publicUserFromDoc(updated, resolved.userId),
      message: 'Profile updated successfully.'
    };
  }
});

export const changePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string()
  },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    if (!args.currentPassword) return { ok: false, status: 400, error: 'Current password is required.' };
    if (!args.newPassword || args.newPassword.length < 6) {
      return { ok: false, status: 400, error: 'New password must be at least 6 characters.' };
    }

    const match = await verifyScryptPassword(args.currentPassword, resolved.user.passwordHash);
    if (!match) return { ok: false, status: 400, error: 'Current password is incorrect.' };

    const passwordHash = await hashScryptPassword(args.newPassword);
    await ctx.db.patch(resolved.user._id, { passwordHash });
    return { ok: true, status: 200, message: 'Password changed successfully.' };
  }
});

/* ---------- Session-Scoped Boards & Project Plans ---------- */

function presentBoard(row) {
  let state = null;
  try {
    state = row.stateJson ? JSON.parse(row.stateJson) : null;
    if (state && Object.keys(state).length === 0) state = null;
  } catch {
    state = null;
  }
  return {
    id: publicBoardId(row.boardId),
    title: row.title,
    category: row.category,
    starred: Boolean(row.starred),
    state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasSavedState: Boolean(row.stateJson && row.stateJson !== '{}')
  };
}

export const listBoards = mutation({
  args: {
    token: v.string(),
    query: v.optional(v.string()),
    starredOnly: v.optional(v.boolean()),
    slug: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    await ensureBlankWorkspace(ctx, resolved.userId);

    const mine = await ctx.db
      .query('boards')
      .withIndex('by_user', (q) => q.eq('userId', resolved.userId))
      .collect();
    mine.sort((a, b) => b.updatedAt - a.updatedAt);

    if (args.slug) {
      const targetSlug = slugify(args.slug);
      const match = mine.find(
        (b) => slugify(b.title) === targetSlug || publicBoardId(b.boardId) === args.slug
      );
      if (!match) return { ok: false, status: 404, error: 'Board not found.' };
      const presented = presentBoard(match);
      return { ok: true, status: 200, board: presented, boards: [presented] };
    }

    const q = (args.query || '').trim().toLowerCase();
    const boards = mine
      .filter((b) => {
        if (args.starredOnly && !b.starred) return false;
        if (q) return b.title.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
        return true;
      })
      .map(presentBoard);

    return { ok: true, status: 200, boards };
  }
});

export const getBoard = mutation({
  args: { token: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    await ensureBlankWorkspace(ctx, resolved.userId);

    const internalId = scopeBoardId(args.boardId, resolved.userId);
    let row = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();

    if (!row || row.userId !== resolved.userId) {
      const targetSlug = slugify(args.boardId);
      const mine = await ctx.db
        .query('boards')
        .withIndex('by_user', (q) => q.eq('userId', resolved.userId))
        .collect();
      row = mine.find((b) => slugify(b.title) === targetSlug || publicBoardId(b.boardId) === args.boardId);
    }

    if (!row || row.userId !== resolved.userId) {
      return { ok: false, status: 404, error: 'Board not found.' };
    }
    return { ok: true, status: 200, board: presentBoard(row) };
  }
});

export const upsertBoard = mutation({
  args: {
    token: v.string(),
    boardId: v.string(),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    starred: v.optional(v.boolean()),
    stateJson: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    const internalId = scopeBoardId(args.boardId, resolved.userId);
    const existing = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();

    if (existing && existing.userId !== resolved.userId) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }

    const now = Date.now();
    if (!existing) {
      await ctx.db.insert('boards', {
        boardId: internalId,
        userId: resolved.userId,
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
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();
    return { ok: true, status: existing ? 200 : 201, board: presentBoard(updated) };
  }
});

export const deleteBoard = mutation({
  args: { token: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    const internalId = scopeBoardId(args.boardId, resolved.userId);
    const existing = await ctx.db
      .query('boards')
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();
    if (!existing || existing.userId !== resolved.userId) {
      return { ok: false, status: 404, error: 'Board not found.' };
    }
    await ctx.db.delete(existing._id);

    const plan = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();
    if (plan && plan.userId === resolved.userId) {
      for (const table of Object.values(SECTIONS)) {
        const rows = await ctx.db
          .query(table)
          .withIndex('by_board', (q) => q.eq('boardId', internalId))
          .collect();
        for (const r of rows) await ctx.db.delete(r._id);
      }
      await ctx.db.delete(plan._id);
    }

    return { ok: true, status: 200, convexSynced: true };
  }
});

export const getProjectPlan = query({
  args: { token: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    const internalId = scopeBoardId(args.boardId, resolved.userId);
    const plan = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();

    if (!plan || plan.userId !== resolved.userId) {
      return { ok: true, status: 200, boardId: args.boardId, source: 'convex', plan: null, updatedAt: null };
    }

    let snapshot = null;
    try {
      snapshot = JSON.parse(plan.snapshotJson);
    } catch {
      snapshot = null;
    }

    return {
      ok: true,
      status: 200,
      boardId: args.boardId,
      source: 'convex',
      plan: snapshot,
      updatedAt: plan.updatedAt
    };
  }
});

export const saveProjectPlan = mutation({
  args: {
    token: v.string(),
    boardId: v.string(),
    planJson: v.string()
  },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    let plan;
    try {
      plan = JSON.parse(args.planJson);
    } catch {
      return { ok: false, status: 400, error: 'Invalid plan JSON.' };
    }
    if (!plan || typeof plan !== 'object') {
      return { ok: false, status: 400, error: 'A plan object is required.' };
    }

    const publicId = publicBoardId(args.boardId);
    if (
      (publicId === BLANK_PP_BOARD_ID || publicId === 'new-project-planning-workspace') &&
      (plan.projectCode === 'WBS-2026' ||
        plan.projectCode === 'PRJ-2026-Q4' ||
        /Construction of a House/i.test(String(plan.projectName || '')) ||
        /Enterprise Release/i.test(String(plan.projectName || '')))
    ) {
      return { ok: false, status: 409, error: 'Refusing to store a demo plan in the blank workspace.' };
    }

    const internalId = scopeBoardId(args.boardId, resolved.userId);
    const existing = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();

    if (existing && existing.userId !== resolved.userId) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }

    const now = Date.now();
    const fields = {
      boardId: internalId,
      userId: resolved.userId,
      projectName: String(plan.projectName || 'Untitled Project').slice(0, 200),
      projectCode: plan.projectCode ? String(plan.projectCode).slice(0, 60) : undefined,
      activeSprint: plan.activeSprint ? String(plan.activeSprint).slice(0, 120) : undefined,
      baseBudget: Number.isFinite(Number(plan.baseBudget)) ? Number(plan.baseBudget) : 0,
      stateVersion: Number(plan.stateVersion) || 2,
      snapshotJson: args.planJson,
      taskCount: Array.isArray(plan.tasks) ? plan.tasks.length : 0,
      milestoneCount: Array.isArray(plan.milestones) ? plan.milestones.length : 0,
      resourceCount: Array.isArray(plan.resources) ? plan.resources.length : 0,
      updatedAt: now
    };

    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert('projectPlans', fields);

    return {
      ok: true,
      status: 200,
      boardId: args.boardId,
      savedAt: now,
      bytes: args.planJson.length,
      convexSynced: true
    };
  }
});

export const deleteProjectPlan = mutation({
  args: { token: v.string(), boardId: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveSessionUser(ctx, args.token);
    if (!resolved) return { ok: false, status: 401, error: 'Not authenticated.' };

    const internalId = scopeBoardId(args.boardId, resolved.userId);
    const existing = await ctx.db
      .query('projectPlans')
      .withIndex('by_board_id', (q) => q.eq('boardId', internalId))
      .first();
    if (existing && existing.userId === resolved.userId) {
      for (const table of Object.values(SECTIONS)) {
        const rows = await ctx.db
          .query(table)
          .withIndex('by_board', (q) => q.eq('boardId', internalId))
          .collect();
        for (const r of rows) await ctx.db.delete(r._id);
      }
      await ctx.db.delete(existing._id);
    }
    return { ok: true, status: 200, convexSynced: true };
  }
});
