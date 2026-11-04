import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  findUserByEmail,
  createUser,
  createSession,
  getSessionUser,
  getSessionUserWithConvexFallback,
  deleteSession,
  publicUser,
  findOrCreateClerkUser
} from './auth.js';
import {
  listBoards,
  getBoardById,
  findBoardBySlug,
  upsertBoard,
  removeBoard,
  updateUser,
  updateUserAvatar,
  updateUserPassword,
  getProjectPlan,
  saveProjectPlan,
  removeProjectPlan,
  db
} from './db.js';
import {
  checkConvexConnection,
  syncUserToConvex,
  getConvexUserByEmail,
  generateConvexUploadUrl,
  getConvexFileUrl,
  saveConvexAvatar,
  uploadBufferToConvex,
  fetchProjectPlanFromConvex
} from './convex.js';
import {
  readJson,
  readBuffer,
  sendJson,
  parseCookies,
  buildSessionCookie,
  buildClearCookie,
  getClientIp
} from './http.js';
import { config } from './config.js';
import { verifyClerkSessionToken, fetchClerkIdentity } from './clerk.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;
const MAX_PASSWORD = 200;
const MAX_NAME = 80;

/**
 * Board canvases and project plans are documents, not form posts. The default
 * 16KB JSON cap in http.js is right for auth/profile payloads but far too small
 * for a canvas or a WBS with a hundred tasks, so document endpoints get their
 * own ceiling (the same one db.js enforces before writing).
 */
const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;

/** Validate and normalize registration input. */
function validateRegistration(body) {
  const errors = {};

  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const password = String(body.password || '');

  if (!email) errors.email = 'Email is required.';
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  if (!name) errors.name = 'Name is required.';
  else if (name.length > MAX_NAME) errors.name = `Name must be ${MAX_NAME} characters or fewer.`;

  if (!password) errors.password = 'Password is required.';
  else if (password.length < MIN_PASSWORD) errors.password = `Password must be at least ${MIN_PASSWORD} characters.`;
  else if (password.length > MAX_PASSWORD) errors.password = `Password must be ${MAX_PASSWORD} characters or fewer.`;

  return { errors, email, name, password, valid: Object.keys(errors).length === 0 };
}

export function createApi(limiter) {
  const loginLimiter = limiter;

  const auth = (req) => getSessionUser(parseCookies(req)[config.session.cookie]);

  const guard = (res, limiterKey) => {
    const result = loginLimiter.check(limiterKey);
    if (!result.allowed) {
      sendJson(res, 429, {
        error: 'Too many attempts. Please try again later.',
        retryAfterMs: result.retryAfterMs
      }, { 'Retry-After': Math.ceil(result.retryAfterMs / 1000) });
      return false;
    }
    return true;
  };

  return {
    /** POST /api/auth/register */
    async register(req, res) {
      const ip = getClientIp(req);
      if (!guard(res, `register:${ip}`)) return;

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const { errors, email, name, password, valid } = validateRegistration(body);
      if (!valid) return sendJson(res, 400, { error: 'Please check the highlighted fields.', fields: errors });

      if (findUserByEmail(email)) {
        return sendJson(res, 409, { error: 'An account with that email already exists.' });
      }

      const passwordHash = await hashPassword(password);
      let user;
      try {
        user = createUser({ email, name, passwordHash });
      } catch (err) {
        // Unique index is the real guard against a race between check and insert.
        if (String(err.message).includes('UNIQUE')) {
          return sendJson(res, 409, { error: 'An account with that email already exists.' });
        }
        throw err;
      }

      const token = createSession(user.id);
      loginLimiter.reset(`login:${ip}`);

      return sendJson(res, 201, { user: publicUser(user) }, {
        'Set-Cookie': buildSessionCookie(token)
      });
    },

    /** POST /api/auth/login */
    async login(req, res) {
      const ip = getClientIp(req);
      if (!guard(res, `login:${ip}`)) return;

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password are required.' });
      }

      let user = findUserByEmail(email);

      // Convex Auth fallback / lookup if user does not exist locally yet
      if (!user) {
        try {
          const remote = await getConvexUserByEmail(email);
          if (remote && remote.passwordHash) {
            db.prepare(
              `INSERT OR REPLACE INTO users (email, name, role, password_hash, created_at)
               VALUES (?, ?, ?, ?, ?)`
            ).run(
              remote.email,
              remote.name || remote.email.split('@')[0],
              remote.role || 'member',
              remote.passwordHash,
              remote.createdAt || Date.now()
            );
            user = findUserByEmail(email);
          }
        } catch {}
      }

      // Always run a hash comparison so a missing account and a wrong password
      // take a similar amount of time (avoids user enumeration by timing).
      let stored = user ? user.password_hash : 'scrypt$16384$8$1$AAAA$AAAA';
      let ok = await verifyPassword(password, stored);

      if (user && !ok) {
        try {
          const remote = await getConvexUserByEmail(email);
          if (remote && remote.passwordHash && remote.passwordHash !== user.password_hash) {
            const remoteOk = await verifyPassword(password, remote.passwordHash);
            if (remoteOk) {
              updateUserPassword(user.id, remote.passwordHash);
              user.password_hash = remote.passwordHash;
              ok = true;
            }
          }
        } catch {}
      }

      if (!user || !ok) {
        return sendJson(res, 401, { error: 'Incorrect email or password.' });
      }

      const token = createSession(user.id);
      loginLimiter.reset(`login:${ip}`);

      return sendJson(res, 200, { user: publicUser(user) }, {
        'Set-Cookie': buildSessionCookie(token)
      });
    },

    /** POST /api/auth/logout */
    logout(req, res) {
      const token = parseCookies(req)[config.session.cookie];
      deleteSession(token);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildClearCookie() });
    },

    /** GET /api/auth/me */
    me(req, res) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      return sendJson(res, 200, { user: publicUser(user) });
    },

    /** PATCH /api/auth/me - Update profile fields (name, title/jobTitle, company, bio) */
    async updateMe(req, res) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const name = body.name !== undefined ? String(body.name).trim() : undefined;
      const title = body.title !== undefined ? String(body.title).trim() : (body.jobTitle !== undefined ? String(body.jobTitle).trim() : undefined);
      const company = body.company !== undefined ? String(body.company).trim() : undefined;
      const bio = body.bio !== undefined ? String(body.bio).trim() : undefined;

      if (name !== undefined) {
        if (!name) return sendJson(res, 400, { error: 'Name cannot be empty.' });
        if (name.length > 80) return sendJson(res, 400, { error: 'Name must be 80 characters or fewer.' });
      }
      if (title !== undefined && title.length > 100) {
        return sendJson(res, 400, { error: 'Job title must be 100 characters or fewer.' });
      }
      if (company !== undefined && company.length > 100) {
        return sendJson(res, 400, { error: 'Company must be 100 characters or fewer.' });
      }
      if (bio !== undefined && bio.length > 500) {
        return sendJson(res, 400, { error: 'Bio must be 500 characters or fewer.' });
      }

      const updated = updateUser(user.id, { name, title, company, bio });
      if (!updated) return sendJson(res, 404, { error: 'User not found.' });

      try {
        syncUserToConvex(updated);
      } catch {}

      return sendJson(res, 200, {
        ok: true,
        user: publicUser(updated),
        message: 'Profile updated successfully.'
      });
    },

    /** POST /api/profile/avatar-upload-url - Generate direct Convex storage upload URL */
    async avatarUploadUrl(req, res) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const uploadUrl = await generateConvexUploadUrl(user.id);
        if (!uploadUrl) return sendJson(res, 502, { error: 'Failed to generate Convex upload URL.' });
        return sendJson(res, 200, { ok: true, uploadUrl });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    },

    /** POST /api/profile/avatar - Upload profile image to Convex storage (<= 5MB) */
    async uploadAvatar(req, res) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      const rawContentType = (req.headers['content-type'] || '').toLowerCase();

      // Case 1: Client uploaded directly to Convex and posted the storageId
      if (rawContentType.includes('application/json')) {
        let body;
        try {
          body = await readJson(req);
        } catch (err) {
          return sendJson(res, err.status || 400, { error: err.message });
        }
        const storageId = String(body.storageId || '').trim();
        if (!storageId) return sendJson(res, 400, { error: 'Missing storageId parameter.' });

        let avatarUrl = '';
        try {
          avatarUrl = await getConvexFileUrl(storageId);
          await saveConvexAvatar(user.email, storageId, user.id);
        } catch {}

        const updated = updateUserAvatar(user.id, avatarUrl || '', storageId);
        return sendJson(res, 200, {
          ok: true,
          avatarUrl: updated.avatar_url,
          storageId,
          user: publicUser(updated),
          message: 'Profile image updated successfully.'
        });
      }

      // Case 2: Direct binary image upload to server -> streams to Convex Cloud Storage
      const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
      const mimeType = rawContentType.split(';')[0].trim();
      if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
        return sendJson(res, 400, {
          error: 'Invalid file format. Please upload a PNG, JPG, WebP, GIF, or SVG image.'
        });
      }

      let buffer;
      try {
        buffer = await readBuffer(req, 5 * 1024 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, {
          error: err.message || 'File size exceeds 5MB limit. Please upload an image 5MB or below.'
        });
      }

      if (!buffer || buffer.length === 0) {
        return sendJson(res, 400, { error: 'No image data provided.' });
      }

      if (buffer.length > 5 * 1024 * 1024) {
        return sendJson(res, 413, {
          error: 'File size exceeds the 5MB limit. Please upload an image 5MB or below.'
        });
      }

      try {
        const { storageId, url } = await uploadBufferToConvex(buffer, mimeType, user.id);
        try {
          await saveConvexAvatar(user.email, storageId, user.id);
        } catch {}

        const updated = updateUserAvatar(user.id, url || '', storageId);
        return sendJson(res, 200, {
          ok: true,
          avatarUrl: updated.avatar_url,
          storageId,
          user: publicUser(updated),
          message: 'Profile image uploaded and saved.'
        });
      } catch (err) {
        return sendJson(res, 502, {
          error: 'Failed to upload photo: ' + (err.message || 'Unknown error')
        });
      }
    },

    /** DELETE /api/profile/avatar - Remove profile photo */
    async removeAvatar(req, res) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      const updated = updateUserAvatar(user.id, '', '');
      try {
        syncUserToConvex(updated);
      } catch {}

      return sendJson(res, 200, {
        ok: true,
        user: publicUser(updated),
        message: 'Profile photo removed.'
      });
    },

    /** POST /api/auth/change-password */
    async changePassword(req, res) {
      const sessionUser = auth(req);
      if (!sessionUser) return sendJson(res, 401, { error: 'Not authenticated.' });

      const ip = getClientIp(req);
      if (!guard(res, `change-pass:${sessionUser.id}:${ip}`)) return;

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const currentPassword = String(body.currentPassword || body.current_password || '');
      const newPassword = String(body.newPassword || body.new_password || '');

      if (!currentPassword) {
        return sendJson(res, 400, { error: 'Current password is required.' });
      }
      if (!newPassword) {
        return sendJson(res, 400, { error: 'New password is required.' });
      }
      if (newPassword.length < MIN_PASSWORD) {
        return sendJson(res, 400, { error: `New password must be at least ${MIN_PASSWORD} characters.` });
      }
      if (newPassword.length > MAX_PASSWORD) {
        return sendJson(res, 400, { error: `New password must be ${MAX_PASSWORD} characters or fewer.` });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sessionUser.id);
      if (!user) return sendJson(res, 404, { error: 'User not found.' });

      const match = await verifyPassword(currentPassword, user.password_hash);
      if (!match) {
        return sendJson(res, 400, { error: 'Current password is incorrect.' });
      }

      const newHash = await hashPassword(newPassword);
      updateUserPassword(user.id, newHash);

      try {
        syncUserToConvex(user, newHash);
      } catch {}

      return sendJson(res, 200, {
        ok: true,
        message: 'Password changed successfully.'
      });
    },

    /** GET /api/auth/config */
    authConfig(req, res) {
      return sendJson(res, 200, {
        clerkAppId: config.clerk.appId,
        clerkPublishableKey: config.clerk.publishableKey || null,
        convexCloudUrl: config.convex.cloudUrl,
        convexSiteUrl: config.convex.siteUrl
      });
    },

    /** POST /api/auth/clerk-sync */
    async clerkSync(req, res) {
      const ip = getClientIp(req);
      if (!guard(res, `clerk-sync:${ip}`)) return;

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      // Identity comes from the verified token + Clerk's own records. Any email or
      // name in the request body is ignored in production: trusting it let anyone sign in as anyone.
      let identity;
      if (config.isTest && !body.token && body.email) {
        identity = { email: body.email, name: body.name || body.email.split('@')[0] };
      } else {
        const clerkToken = String(body.token || '').trim();
        if (!clerkToken) {
          return sendJson(res, 400, { error: 'A Clerk session token is required.' });
        }
        try {
          const claims = await verifyClerkSessionToken(clerkToken);
          identity = await fetchClerkIdentity(claims.sub);
        } catch (err) {
          return sendJson(res, 401, { error: 'Clerk session could not be verified.' });
        }
      }

      const email = identity.email;
      const name = (identity.name || email.split('@')[0] || 'Clerk User').trim().slice(0, MAX_NAME);

      if (!email || !EMAIL_RE.test(email)) {
        return sendJson(res, 400, { error: 'Valid email is required for Clerk session sync.' });
      }

      const user = findOrCreateClerkUser({ email, name });
      const token = createSession(user.id);
      loginLimiter.reset(`login:${ip}`);

      return sendJson(res, 200, { user: publicUser(user), provider: 'clerk' }, {
        'Set-Cookie': buildSessionCookie(token)
      });
    },

    /** GET /api/convex/status */
    async convexStatus(req, res) {
      const status = await checkConvexConnection();
      const user = auth(req);
      return sendJson(res, 200, {
        ...status,
        // Only ever the caller's own boards; anonymous callers get no count.
        localBoardCount: user ? listBoards({ userId: user.id }).length : null
      });
    },

    /** GET /api/boards */
    listBoardsApi(req, res) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const query = (url.searchParams.get('q') || '').trim();
      const starredOnly = url.searchParams.get('starred') === '1';
      const slug = (url.searchParams.get('slug') || '').trim();

      // Pretty URLs carry the board title, not its id: /app/data-quantals-plan
      if (slug) {
        const board = findBoardBySlug(slug, user.id);
        if (!board) return sendJson(res, 404, { error: 'Board not found.' });
        return sendJson(res, 200, { board, boards: [board] });
      }

      const boards = listBoards({ query, starredOnly, userId: user.id });
      return sendJson(res, 200, { boards });
    },

    /** POST /api/boards */
    async createBoardApi(req, res) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body = {};
      try {
        body = await readJson(req, DOCUMENT_MAX_BYTES);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      const rawTitle = String(body.title || 'Untitled Board').trim().slice(0, 120) || 'Untitled Board';
      const slug = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'board';
      const id = String(body.id || `${slug}-${crypto.randomBytes(3).toString('hex')}`);
      const category = String(body.category || 'Strategy & Planning').trim().slice(0, 60);
      const starred = Boolean(body.starred);
      const state = body.state && typeof body.state === 'object' ? body.state : {};

      try {
        const board = upsertBoard({
          id,
          userId: user.id,
          title: rawTitle,
          category,
          starred,
          state
        });
        return sendJson(res, 201, { board });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** GET /api/boards/:id */
    getBoardApi(req, res, boardId) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const board = getBoardById(boardId, user.id);
      if (!board) return sendJson(res, 404, { error: 'Board not found.' });
      return sendJson(res, 200, { board });
    },

    /** PUT /api/boards/:id */
    async updateBoardApi(req, res, boardId) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body = {};
      try {
        body = await readJson(req, DOCUMENT_MAX_BYTES);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const board = upsertBoard({
          id: boardId,
          userId: user.id,
          title: body.title !== undefined ? String(body.title).trim().slice(0, 120) || 'Untitled Board' : undefined,
          category: body.category !== undefined ? String(body.category).trim().slice(0, 60) : undefined,
          starred: body.starred !== undefined ? Boolean(body.starred) : undefined,
          state: body.state !== undefined && typeof body.state === 'object' ? body.state : undefined
        });
        return sendJson(res, 200, { board });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** DELETE /api/boards/:id */
    async deleteBoardApi(req, res, boardId) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const result = await removeBoard(boardId, user.id);
      if (!result.removed) return sendJson(res, 404, { error: 'Board not found.' });
      return sendJson(res, 200, { ok: true, convexSynced: result.convex });
    },

    /* ----------------------- Project Planning ----------------------- *
     * The planning workspace keeps its plan in SQLite `project_plans` and
     * mirrors it into Convex (projectPlans + nine section tables). The
     * browser still caches a copy in localStorage for instant first paint,
     * but the server copy is what survives a cleared cache or another
     * device.
     * ---------------------------------------------------------------- */

    /** GET /api/projects/:boardId - plan for a board (SQLite, then Convex). */
    async getProjectPlanApi(req, res, boardId) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let plan = getProjectPlan(boardId, user.id);
      let source = plan ? 'sqlite' : null;
      if (!plan) {
        plan = await fetchProjectPlanFromConvex(boardId, user.id);
        if (plan) {
          source = 'convex';
          // Backfill the local store so the next read is instant.
          try {
            await saveProjectPlan(boardId, plan, user.id);
          } catch (err) {
            console.warn('[projects] backfill failed:', err.message);
          }
        }
      }
      return sendJson(res, 200, {
        boardId,
        source,
        plan: plan || null,
        updatedAt: null
      });
    },

    /** PUT /api/projects/:boardId - replace the plan and mirror it to Convex. */
    async saveProjectPlanApi(req, res, boardId) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body = {};
      try {
        body = await readJson(req, DOCUMENT_MAX_BYTES);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      const plan = body.plan;
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
        return sendJson(res, 400, { error: 'A plan object is required.' });
      }
      try {
        const result = await saveProjectPlan(boardId, plan, user.id);
        return sendJson(res, 200, {
          ok: true,
          boardId,
          savedAt: result.savedAt,
          bytes: result.bytes,
          convexSynced: Boolean(result.convex)
        });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** DELETE /api/projects/:boardId - drop a plan from SQLite and Convex. */
    async deleteProjectPlanApi(req, res, boardId) {
      const user = auth(req);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const result = await removeProjectPlan(boardId, user.id);
        return sendJson(res, 200, { ok: true, convexSynced: result.convex });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** POST /api/ai/generate - powered by DeepSeek AI */
    async generateAi(req, res) {
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const prompt = String(body.prompt || '').trim();
      const mode = String(body.mode || 'stickies').trim().toLowerCase();
      if (!prompt) return sendJson(res, 400, { error: 'Prompt is required.' });

      const apiKey = config.deepseekApiKey;
      if (!apiKey) {
        return sendJson(res, 503, {
          error: 'AI is not configured on this deployment. Set DEEPSEEK_API_KEY on the API host.'
        });
      }

      let systemPrompt = 'You are an intelligent visual whiteboard assistant for QuantalFlow. The user will provide a brainstorming, planning, or architecture prompt. Return 4 to 6 concise, high-value actionable ideas or key pillars as a valid JSON array of strings: ["Idea 1", "Idea 2", "Idea 3", "Idea 4"]. Output ONLY a valid JSON array without any markdown formatting, backticks, or extra commentary.';

      if (mode === 'mindmap' || mode === 'flow') {
        systemPrompt = 'You are an intelligent visual whiteboard architect for QuantalFlow. Return a structured JSON object with: {"root": "Central Topic", "branches": ["Step/Node 1", "Step/Node 2", "Step/Node 3", "Step/Node 4"]}. Keep labels concise (under 65 chars). Output ONLY valid JSON.';
      } else if (mode === 'kanban') {
        systemPrompt = 'You are an Agile Coach AI in QuantalFlow. Return a JSON object with 3 columns: {"todo": ["Task 1", "Task 2"], "doing": ["Task 3", "Task 4"], "done": ["Task 5"]}. Keep tasks concise and actionable. Output ONLY valid JSON.';
      } else if (mode === 'expand') {
        systemPrompt = 'You are QuantalFlow AI. Expand the given sticky note or concept into 4 concrete sub-points, next steps, or sub-tasks as a valid JSON array of strings: ["Sub-point 1", "Sub-point 2", "Sub-point 3", "Sub-point 4"]. Output ONLY a valid JSON array.';
      } else if (mode === 'plan-edit') {
        systemPrompt = [
          'You are the planning copilot inside a project-planning workspace.',
          'The user gives one instruction. Translate it into the smallest set of edits that satisfies it against the CURRENT PLAN provided.',
          'Return ONLY this JSON shape, with no markdown or commentary:',
          '{"summary":"one short sentence describing the change","operations":[...]}',
          'Allowed operations (use the exact keys):',
          '  {"op":"rename_project","title":"New project name"}',
          '  {"op":"add_phase","title":"Phase name"}',
          '  {"op":"rename_phase","wbs":"2.0","title":"Phase name"}',
          '  {"op":"add_task","phaseWbs":"1.0","title":"Deliverable name","status":"todo","durationDays":5}',
          '  {"op":"update_task","id":"TSK-101","title":"optional","status":"todo|in-progress|review|done|backlog","startDay":1,"durationDays":5,"progress":0}',
          '  {"op":"delete_task","id":"TSK-102"}',
          'Rules: only reference phase wbs codes and task ids that exist in CURRENT PLAN; when adding a deliverable pick the phase the user named, otherwise the first phase; status must be one of the five listed values; startDay 1-34; durationDays 1-25; never invent ids; emit at most 20 operations; if the instruction is ambiguous return an empty operations array and explain in summary.'
        ].join('\n');
      }

      const planContext = body.plan ? JSON.stringify(body.plan).slice(0, 14000) : '';
      const userContent = planContext
        ? 'Instruction: ' + prompt + '\n\nCURRENT PLAN JSON:\n' + planContext
        : prompt;

      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userContent
              }
            ],
            temperature: 0.7,
            max_tokens: 450
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return sendJson(res, 502, { error: 'DeepSeek API error', details: errText });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        let ideas = [];
        let structured = null;

        try {
          const objMatch = content.match(/\{[\s\S]*\}/);
          const arrMatch = content.match(/\[[\s\S]*\]/);
          if (mode === 'plan-edit') {
            if (objMatch) structured = JSON.parse(objMatch[0]);
          } else if ((mode === 'mindmap' || mode === 'flow' || mode === 'kanban') && objMatch) {
            structured = JSON.parse(objMatch[0]);
            if (structured.branches && Array.isArray(structured.branches)) {
              ideas = structured.branches;
            } else if (structured.todo || structured.doing || structured.done) {
              ideas = [
                ...(structured.todo || []),
                ...(structured.doing || []),
                ...(structured.done || [])
              ];
            }
          } else if (arrMatch) {
            ideas = JSON.parse(arrMatch[0]);
          }
        } catch {
          ideas = content.split(/\r?\n/).map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(Boolean);
        }

        if (!Array.isArray(ideas) || !ideas.length) {
          ideas = mode === 'plan-edit' ? [] : [content];
        }

        return sendJson(res, 200, {
          success: true,
          model: data.model || 'deepseek-chat',
          mode,
          prompt,
          ideas,
          structured
        });
      } catch (err) {
        return sendJson(res, 500, { error: 'Failed to communicate with DeepSeek AI: ' + err.message });
      }
    }
  };
}
