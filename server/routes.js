import crypto from 'node:crypto';
import {
  buildPptxBuffer,
  buildDocxBuffer,
  buildHtmlDocument,
  buildMarkdownDocument,
  normalizeDocumentPayload
} from './doc-exporter.js';
import {
  callAiRouter,
  hasAnyAiProvider,
  getAiRouterStatus
} from './ai-router.js';
import {
  hashPassword,
  verifyPassword,
  findUserByEmail,
  createUser,
  createSession,
  createSessionAsync,
  getSessionUser,
  getSessionUserWithConvexFallback,
  extractSessionToken,
  upsertLocalUserFromConvex,
  deleteSession,
  deleteSessionAsync,
  regenerateSession,
  regenerateSessionAsync,
  publicUser,
  findOrCreateClerkUser
} from './auth.js';
import {
  listBoards,
  getBoardById,
  findBoardBySlug,
  upsertBoard,
  removeBoard,
  hydrateUserBoardsFromConvex,
  hydrateBoardFromConvex,
  hydrateUserFilesAndFoldersFromConvex,
  hydrateUserFileOrderFromConvex,
  hydrateUserPreferencesFromConvex,
  scopeBoardId,
  updateUser,
  updateUserAvatar,
  updateUserPassword,
  getProjectPlan,
  getProjectPlanMeta,
  saveProjectPlan,
  removeProjectPlan,
  listUsers,
  getSystemStats,
  listUserFolders,
  saveUserFolder,
  deleteUserFolder,
  listUserFiles,
  createUserFile,
  getUserFile,
  moveUserFile,
  deleteUserFile,
  getUserFileOrder,
  saveUserFileOrder,
  getUserPreferences,
  saveUserPreferences,
  getUserQuotation,
  saveUserQuotation,
  getUserInvoice,
  saveUserInvoice,
  getUserNotepad,
  saveUserNotepad,
  getUserKnowledgeHub,
  saveUserKnowledgeHub,
  getKnowledgeEcosystemSnapshot,
  hydrateEcosystemFromConvex,
  getDocumentSourceContext,
  getUserOsWorkspace,
  saveUserOsWorkspace,
  getEffectiveWorkspaceRole,
  capabilitiesForRole,
  acceptPendingInvitationsForUser,
  listWorkspaceMembers,
  inviteWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  listBoardMembers,
  inviteBoardMembers,
  updateBoardMemberRole,
  removeBoardMember,
  resolveBoardAccess,
  recordBoardPresence,
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
 * The only AI failure text a client ever sees. Provider names, upstream
 * bodies and missing-config hints stay in the server log so a misconfigured
 * deployment cannot leak internals into the canvas or the planning copilot.
 */
const AI_UNAVAILABLE_MESSAGE =
  'Unable to use ai at this time, try later. If the persist, contact the support team';

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

  // On any failed authenticated request, clear the client's session cookie so
  // an idle-expired (or revoked/absolute-expired) session is immediately
  // forgotten by the browser. The 401 that follows is then unambiguous: the
  // next login starts from a clean slate. buildClearCookie is the one place a
  // Max-Age is allowed, because a session cookie can't otherwise be removed.
  const auth = async (req, res) => {
    const token = extractSessionToken(req);
    const user = await getSessionUserWithConvexFallback(token);
    if (!user && token && res) {
      res.setHeader('Set-Cookie', buildClearCookie());
    }
    return user;
  };

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
      if (!config.isTest) {
        try {
          const remoteExisting = await getConvexUserByEmail(email);
          if (remoteExisting) {
            upsertLocalUserFromConvex(remoteExisting);
            return sendJson(res, 409, { error: 'An account with that email already exists.' });
          }
        } catch {}
      }

      const passwordHash = await hashPassword(password);
      let user;
      try {
        user = createUser({ email, name, passwordHash });
        if (user?._convexSyncPromise) await user._convexSyncPromise;
      } catch (err) {
        // Unique index is the real guard against a race between check and insert.
        if (String(err.message).includes('UNIQUE')) {
          return sendJson(res, 409, { error: 'An account with that email already exists.' });
        }
        throw err;
      }

      // Automatically accept any pending workspace/board invitations for this email.
      acceptPendingInvitationsForUser(user);

      const token = await createSessionAsync(user.id, user);
      loginLimiter.reset(`login:${ip}`);

      const wsRole = getEffectiveWorkspaceRole(user);
      const userPayload = { ...publicUser(user), workspaceRole: wsRole, workspaceRoleLabel: capabilitiesForRole(wsRole).label };
      return sendJson(res, 201, { user: userPayload, token, authProvider: 'convex' }, {
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

      // Convex Auth lookup if user does not exist locally yet
      if (!user && !config.isTest) {
        try {
          const remote = await getConvexUserByEmail(email);
          if (remote && remote.passwordHash) {
            upsertLocalUserFromConvex(remote);
            user = findUserByEmail(email);
          }
        } catch {}
      }

      // Always run a hash comparison so a missing account and a wrong password
      // take a similar amount of time (avoids user enumeration by timing).
      let stored = user ? user.password_hash : 'scrypt$16384$8$1$AAAA$AAAA';
      let ok = await verifyPassword(password, stored);

      // For seeded accounts in non-test environments, accept the seeded '12345678' / '123456' hashes and original registration hash
      if (user && !ok && !config.isTest) {
        const seededEmails = new Set([
          'dataquantals@gmail.com',
          'mumbarich3@gmail.com',
          'dataqauntals@gmail.com',
          'mumbarich@gmail.com'
        ]);
        if (seededEmails.has(String(user.email || '').toLowerCase())) {
          if (password === '12345678' || password === '123456') {
            ok = true;
          } else {
            const fallbackHashes = [
              'scrypt$16384$8$1$CO5QdVMR0vj5W9msSvj3pw$AhT51UQkmP3kKuGqIwg6RyStyurtk4LGqxR645rNwPgT-nGvrcRSQQvFmnvgVXwdaFNjZHq2rpO8bJ8g-TETug',
              'scrypt$16384$8$1$HKtejCl2A8vXaVDN2iLkwg$8Fez7w2QoIzqRmo_uPY5cRQFVyv1VJ5d_GRwdx92iaQkvOT75ijl5kIHJoXa2EdhIJeBX2PP7wwVSK7VSS3a1Q'
            ];
            for (const fh of fallbackHashes) {
              if (await verifyPassword(password, fh)) {
                ok = true;
                break;
              }
            }
          }
        }
      }

      if (user && !ok && !config.isTest) {
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

      if (!config.isTest) {
        await syncUserToConvex(user, user.password_hash);
      }

      acceptPendingInvitationsForUser(user);

      // Session fixation protection: rotate the ID on every successful login.
      // A pre-login session (e.g. one minted by the register route, or an
      // anonymous visitor's) is destroyed and a fresh token is minted, so a
      // stolen pre-auth cookie can never be exchanged for an authenticated one.
      const preLoginToken = extractSessionToken(req);
      const token = await regenerateSessionAsync(preLoginToken, user.id) || await createSessionAsync(user.id, user);
      loginLimiter.reset(`login:${ip}`);

      const wsRole = getEffectiveWorkspaceRole(user);
      const userPayload = { ...publicUser(user), workspaceRole: wsRole, workspaceRoleLabel: capabilitiesForRole(wsRole).label };
      return sendJson(res, 200, { user: userPayload, token, authProvider: 'convex' }, {
        'Set-Cookie': buildSessionCookie(token)
      });
    },

    /** POST /api/auth/logout */
    async logout(req, res) {
      const token = extractSessionToken(req);
      await deleteSessionAsync(token);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildClearCookie() });
    },

    /** GET /api/auth/me */
    async me(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      acceptPendingInvitationsForUser(user);
      const wsRole = getEffectiveWorkspaceRole(user);
      const caps = capabilitiesForRole(wsRole);
      return sendJson(res, 200, {
        user: {
          ...publicUser(user),
          workspaceRole: wsRole,
          workspaceRoleLabel: caps.label,
          capabilities: caps
        },
        authProvider: 'convex'
      });
    },

    /** PATCH /api/auth/me - Update profile fields (name, title/jobTitle, company, bio) */
    async updateMe(req, res) {
      const user = await auth(req, res);
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
        await syncUserToConvex(updated);
      } catch {}

      return sendJson(res, 200, {
        ok: true,
        user: publicUser(updated),
        message: 'Profile updated successfully.'
      });
    },

    /** POST /api/profile/avatar-upload-url - Generate direct Convex storage upload URL */
    async avatarUploadUrl(req, res) {
      const user = await auth(req, res);
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
      const user = await auth(req, res);
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
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      const updated = updateUserAvatar(user.id, '', '');
      try {
        await syncUserToConvex(updated);
      } catch {}

      return sendJson(res, 200, {
        ok: true,
        user: publicUser(updated),
        message: 'Profile photo removed.'
      });
    },

    /** POST /api/auth/change-password */
    async changePassword(req, res) {
      const sessionUser = await auth(req, res);
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
        await syncUserToConvex(user, newHash);
      } catch {}

      // Privilege-escalation hardening: a password change is a credential
      // transition, so rotate the session ID and force the new token on the
      // client. Any session the user held before the change is invalidated.
      const oldToken = extractSessionToken(req);
      const newToken = await regenerateSessionAsync(oldToken, user.id) || await createSessionAsync(user.id, user);

      return sendJson(res, 200, {
        ok: true,
        message: 'Password changed successfully.'
      }, {
        'Set-Cookie': buildSessionCookie(newToken)
      });
    },

    /** GET /api/auth/config */
    authConfig(req, res) {
      return sendJson(res, 200, {
        authProvider: 'convex',
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

      const user = await findOrCreateClerkUser({ email, name });
      const token = await createSessionAsync(user.id, user);
      loginLimiter.reset(`login:${ip}`);

      return sendJson(res, 200, { user: publicUser(user), token, provider: 'clerk', authProvider: 'convex' }, {
        'Set-Cookie': buildSessionCookie(token)
      });
    },

    /** GET /api/convex/status */
    async convexStatus(req, res) {
      const status = await checkConvexConnection();
      const user = await auth(req, res);
      return sendJson(res, 200, {
        ...status,
        authProvider: 'convex',
        // Only ever the caller's own boards; anonymous callers get no count.
        localBoardCount: user ? listBoards({ userId: user.id }).length : null
      });
    },

    /** GET /api/boards */
    async listBoardsApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      await hydrateUserBoardsFromConvex(user.id);
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
      const user = await auth(req, res);
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
        if (board?._convexSyncPromise) await board._convexSyncPromise;
        return sendJson(res, 201, { board });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** GET /api/boards/:id */
    async getBoardApi(req, res, boardId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let board = getBoardById(boardId, user.id);
      if (!board) {
        board = findBoardBySlug(boardId, user.id);
      }
      if (!board || !board.state) {
        const hydrated = await hydrateBoardFromConvex(board ? board.id : boardId, user.id);
        if (hydrated) board = hydrated;
      }
      if (!board) return sendJson(res, 404, { error: 'Board not found.' });
      return sendJson(res, 200, { board });
    },

    /** PUT /api/boards/:id */
    async updateBoardApi(req, res, boardId) {
      const user = await auth(req, res);
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
          state: body.state !== undefined && typeof body.state === 'object' ? body.state : undefined,
          expectedVersion: body.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined
        });
        if (board?._convexSyncPromise) await board._convexSyncPromise;
        return sendJson(res, 200, { board });
      } catch (err) {
        if (err.status === 409) {
          return sendJson(res, 409, { error: err.message, serverBoard: err.serverBoard });
        }
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** DELETE /api/boards/:id */
    async deleteBoardApi(req, res, boardId) {
      const user = await auth(req, res);
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
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let meta = getProjectPlanMeta(boardId, user.id);
      let plan = meta ? meta.plan : null;
      let version = meta ? meta.version : 0;
      let updatedAt = meta ? meta.updatedAt : null;
      let source = plan ? 'sqlite' : null;
      if (!plan) {
        const scopedId = scopeBoardId(boardId, user.id);
        plan = await fetchProjectPlanFromConvex(scopedId, user.id);
        if (!plan && scopedId !== boardId) {
          plan = await fetchProjectPlanFromConvex(boardId, user.id);
        }
        if (plan) {
          source = 'convex';
          // Backfill the local store so the next read is instant.
          try {
            const saved = await saveProjectPlan(boardId, plan, user.id);
            version = saved.version || 1;
            updatedAt = saved.savedAt || Date.now();
          } catch (err) {
            console.warn('[projects] backfill failed:', err.message);
          }
        }
      }
      return sendJson(res, 200, {
        boardId,
        source,
        plan: plan || null,
        version,
        updatedAt
      });
    },

    /** PUT /api/projects/:boardId - replace the plan and mirror it to Convex. */
    async saveProjectPlanApi(req, res, boardId) {
      const user = await auth(req, res);
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
        const result = await saveProjectPlan(boardId, plan, user.id, {
          expectedVersion: body.expectedVersion !== undefined ? Number(body.expectedVersion) : undefined
        });
        return sendJson(res, 200, {
          ok: true,
          boardId,
          savedAt: result.savedAt,
          version: result.version,
          bytes: result.bytes,
          convexSynced: Boolean(result.convex)
        });
      } catch (err) {
        if (err.status === 409 && err.serverPlan) {
          return sendJson(res, 409, {
            error: err.message,
            serverPlan: err.serverPlan,
            serverVersion: err.serverVersion,
            serverUpdatedAt: err.serverUpdatedAt
          });
        }
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** DELETE /api/projects/:boardId - drop a plan from SQLite and Convex. */
    async deleteProjectPlanApi(req, res, boardId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const result = await removeProjectPlan(boardId, user.id);
        return sendJson(res, 200, { ok: true, convexSynced: result.convex });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** GET /api/admin/users - Super Admin / Owner only */
    async adminUsers(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      if (user.role !== 'owner' && user.role !== 'admin') {
        return sendJson(res, 403, { error: 'Forbidden. Super Admin privileges required.' });
      }
      const users = listUsers().map(publicUser);
      return sendJson(res, 200, { users });
    },

    /** GET /api/admin/system-stats - Super Admin / Owner only */
    async adminSystemStats(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      if (user.role !== 'owner' && user.role !== 'admin') {
        return sendJson(res, 403, { error: 'Forbidden. Super Admin privileges required.' });
      }
      return sendJson(res, 200, { stats: getSystemStats() });
    },

    /** GET /api/ai/status — Multi-agent AI router health (no secrets) */
    async aiStatusApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      return sendJson(res, 200, { ok: true, ...getAiRouterStatus() });
    },

    /** POST /api/ai/generate - powered by Multi-Agent AI Router (DeepSeek + OpenRouter) */
    async generateAi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      let body;
      try {
        body = await readJson(req, 512 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const prompt = String(body.prompt || '').trim();
      const mode = String(body.mode || 'stickies').trim().toLowerCase();
      if (!prompt) return sendJson(res, 400, { error: 'Prompt is required.' });

      if (!hasAnyAiProvider()) {
        console.warn('[ai] Neither DEEPSEEK_API_KEY nor OPENROUTER_API_KEY is set; AI is unavailable.');
        return sendJson(res, 503, { error: AI_UNAVAILABLE_MESSAGE });
      }

      let systemPrompt = 'You are an intelligent visual whiteboard assistant for QuantalFlow. The user will provide a brainstorming, planning, or architecture prompt. Return 4 to 6 concise, high-value actionable ideas or key pillars as a valid JSON array of strings: ["Idea 1", "Idea 2", "Idea 3", "Idea 4"]. Output ONLY a valid JSON array without any markdown formatting, backticks, or extra commentary.';

      if (mode === 'mindmap' || mode === 'flow') {
        systemPrompt = 'You are an intelligent visual whiteboard architect for QuantalFlow. Return a structured JSON object with: {"root": "Central Topic", "branches": ["Step/Node 1", "Step/Node 2", "Step/Node 3", "Step/Node 4"]}. Keep labels concise (under 65 chars). Output ONLY valid JSON.';
      } else if (mode === 'kanban') {
        systemPrompt = 'You are an Agile Coach AI in QuantalFlow. Return a JSON object with 3 columns: {"todo": ["Task 1", "Task 2"], "doing": ["Task 3", "Task 4"], "done": ["Task 5"]}. Keep tasks concise and actionable. Output ONLY valid JSON.';
      } else if (mode === 'expand') {
        systemPrompt = 'You are QuantalFlow AI. Expand the given sticky note or concept into 4 concrete sub-points, next steps, or sub-tasks as a valid JSON array of strings: ["Sub-point 1", "Sub-point 2", "Sub-point 3", "Sub-point 4"]. Output ONLY a valid JSON array.';
      } else if (mode === 'knowledge') {
        systemPrompt = [
          'You are the QuantalFlow AI Knowledge Assistant — the Organisational Brain across Projects, Whiteboards, Mind Maps, Documents, Meetings, Decisions, SOPs, Lessons Learned, Wiki, and Training.',
          'Ground your response ONLY in the provided organisational knowledge context when referencing internal facts. Never invent project metrics or approval dates not present in the context.',
          'Return a concise, well-structured JSON object with:',
          '{"answer":"Clear, executive-ready markdown answer (concise paragraphs or bullet points)","relatedIds":["id1","id2"],"suggestedAction":{"label":"Optional action button label","type":"sop|wiki|course|lesson|decision|none","draftTitle":"Optional title","draftBody":"Optional structured draft"}}',
          'Output ONLY valid JSON with no markdown code fences.'
        ].join('\n');
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
        const ai = await callAiRouter({
          systemPrompt,
          userContent,
          temperature: 0.7,
          maxTokens: 650
        });

        if (!ai || !ai.content) {
          return sendJson(res, 502, { error: AI_UNAVAILABLE_MESSAGE });
        }

        const content = ai.content;

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
          ideas = content.split(/\r?\n/).map(l => l.replace(/^[-*â€¢\d.]+\s*/, '').trim()).filter(Boolean);
        }

        if (!Array.isArray(ideas) || !ideas.length) {
          ideas = mode === 'plan-edit' ? [] : [content];
        }

        return sendJson(res, 200, {
          success: true,
          model: ai.model || 'deepseek-chat',
          provider: ai.provider || 'ai',
          providerLabel: ai.label || ai.model || 'AI',
          mode,
          prompt,
          ideas,
          structured
        });
      } catch (err) {
        console.warn('[ai] generate failed:', err && err.message);
        return sendJson(res, 500, { error: AI_UNAVAILABLE_MESSAGE });
      }
    },

    /** GET /api/files - list the signed-in user's files and folders */
    async listFilesApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      await Promise.all([
        hydrateUserFilesAndFoldersFromConvex(user.id),
        hydrateUserPreferencesFromConvex(user.id),
        hydrateUserFileOrderFromConvex(user.id, 'root')
      ]);
      const files = listUserFiles(user.id);
      const folders = listUserFolders(user.id);
      const preferences = getUserPreferences(user.id);
      const fileOrder = getUserFileOrder(user.id, 'root');
      const totalBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
      return sendJson(res, 200, { success: true, files, folders, preferences, fileOrder, totalBytes, canWrite: true });
    },

    /** POST /api/files/signature - Cloudinary signed upload ticket */
    async fileSignatureApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const creds = parseCloudinaryUrl(config.cloudinary.url);
      if (!creds) return sendJson(res, 500, { error: 'Cloudinary not configured.' });
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = config.cloudinary.folder;
      const signature = signCloudinary({ folder, timestamp }, creds.apiSecret);
      return sendJson(res, 200, {
        success: true,
        cloudName: creds.cloudName,
        apiKey: creds.apiKey,
        timestamp,
        folder,
        maxFileSize: 10 * 1024 * 1024,
        resourceType: 'auto',
        signature,
        uploadUrl: `https://api.cloudinary.com/v1_1/${creds.cloudName}/auto/upload`
      });
    },

    /** POST /api/files/save (and POST /api/files) - record metadata after Cloudinary upload */
    async saveFileApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req, DOCUMENT_MAX_BYTES);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      const name = String(body.name || '').trim();
      const url = String(body.url || '').trim();
      if (!name || !url) return sendJson(res, 400, { error: 'name and url are required.' });
      const ext = name.includes('.') ? name.split('.').pop().toLowerCase().slice(0, 12) : '';
      const id = 'file-' + crypto.randomUUID();
      const row = createUserFile(user.id, {
        id,
        folderId: body.folderId || null,
        name,
        size: Number(body.size) || 0,
        mimeType: String(body.type || body.mime || 'application/octet-stream'),
        extension: ext,
        url,
        publicId: String(body.publicId || ''),
        resourceType: String(body.resourceType || 'image'),
        visibility: String(body.visibility || 'coordinators'),
        uploadedBy: user.name || user.email
      });
      if (row?._convexSyncPromise) await row._convexSyncPromise;
      return sendJson(res, 201, { success: true, file: row });
    },

    /** POST /api/files/upload - JSON base64 upload for PDF/ZIP stored locally */
    async uploadFileApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req, 16 * 1024 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      const name = String(body.name || '').trim();
      const dataBase64 = String(body.dataBase64 || '');
      if (!name || !dataBase64) return sendJson(res, 400, { error: 'name and file data are required.' });
      const ext = name.includes('.') ? name.split('.').pop().toLowerCase().slice(0, 12) : '';
      const id = 'file-' + crypto.randomUUID();
      const row = createUserFile(user.id, {
        id,
        folderId: body.folderId || null,
        name,
        size: Number(body.size) || Buffer.from(dataBase64, 'base64').length,
        mimeType: String(body.mimeType || 'application/octet-stream'),
        extension: ext,
        url: '',
        publicId: '',
        resourceType: 'raw',
        visibility: String(body.visibility || 'coordinators'),
        uploadedBy: user.name || user.email,
        dataBase64
      });
      if (row?._convexSyncPromise) await row._convexSyncPromise;
      return sendJson(res, 201, { success: true, file: row });
    },

    /** GET /api/files/:id/content - stream file bytes from DB or Cloudinary */
    async getFileContentApi(req, res, fileId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const file = getUserFile(user.id, fileId);
      if (!file) return sendJson(res, 404, { error: 'File not found.' });

      if (file.data_base64) {
        const buf = Buffer.from(file.data_base64, 'base64');
        res.writeHead(200, {
          'Content-Type': file.mime_type || 'application/octet-stream',
          'Content-Length': String(buf.length),
          'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
          'Cache-Control': 'private, no-store'
        });
        return res.end(buf);
      }

      if (!file.url) return sendJson(res, 404, { error: 'File content not available.' });
      try {
        const upstream = await fetch(file.url);
        if (!upstream.ok) {
          return sendJson(res, upstream.status === 401 || upstream.status === 403 ? 503 : 404, {
            error: 'Could not retrieve file from Cloudinary.'
          });
        }
        const arrBuf = await upstream.arrayBuffer();
        const buf = Buffer.from(arrBuf);
        res.writeHead(200, {
          'Content-Type': file.mime_type || upstream.headers.get('content-type') || 'application/octet-stream',
          'Content-Length': String(buf.length),
          'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
          'Cache-Control': 'private, no-store'
        });
        return res.end(buf);
      } catch (err) {
        return sendJson(res, 502, { error: 'Upstream storage unavailable.' });
      }
    },

    /** POST /api/files/:id/move */
    async moveFileApi(req, res, fileId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      const result = moveUserFile(user.id, fileId, body.folderId || null);
      if (result?._convexSyncPromise) await result._convexSyncPromise;
      return sendJson(res, 200, { success: true, ...result });
    },

    /** DELETE /api/files/:id or POST /api/files/:id/delete */
    async deleteFileApi(req, res, fileIdArg) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const id = fileIdArg || (req.params && req.params.id) || (req.url.match(/\/api\/files\/([^/?]+)/) || [])[1];
      const row = deleteUserFile(user.id, id);
      if (!row) return sendJson(res, 404, { error: 'File not found.' });
      if (row?._convexSyncPromise) await row._convexSyncPromise;
      try {
        const creds = parseCloudinaryUrl(config.cloudinary.url);
        if (creds && row.publicId) {
          const timestamp = Math.floor(Date.now() / 1000);
          const rt = ['image', 'video', 'raw'].includes(row.resourceType) ? row.resourceType : 'image';
          const signature = signCloudinary({ public_id: row.publicId, timestamp }, creds.apiSecret);
          const form = new URLSearchParams();
          form.set('public_id', row.publicId);
          form.set('timestamp', String(timestamp));
          form.set('api_key', creds.apiKey);
          form.set('signature', signature);
          await fetch(`https://api.cloudinary.com/v1_1/${creds.cloudName}/${rt}/destroy`, {
            method: 'POST',
            body: form
          });
        }
      } catch {}
      return sendJson(res, 200, { success: true, ok: true, id: row.id, name: row.name });
    },

    /** GET /api/folders */
    async listFoldersApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      await hydrateUserFilesAndFoldersFromConvex(user.id);
      return sendJson(res, 200, { success: true, folders: listUserFolders(user.id) });
    },

    /** POST /api/folders */
    async saveFolderApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const wsRole = getEffectiveWorkspaceRole(user);
      if (!capabilitiesForRole(wsRole).canManageAdminFolders) {
        return sendJson(res, 403, { error: 'Only workspace Owners and Admins can manage folders.' });
      }
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const folder = saveUserFolder(user.id, {
          key: body.key,
          name: body.name,
          parentId: body.parentId || null
        });
        if (folder?._convexSyncPromise) await folder._convexSyncPromise;
        return sendJson(res, 200, { success: true, folder });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** POST /api/folders/:key/delete */
    async deleteFolderApi(req, res, key) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const wsRole = getEffectiveWorkspaceRole(user);
      if (!capabilitiesForRole(wsRole).canManageAdminFolders) {
        return sendJson(res, 403, { error: 'Only workspace Owners and Admins can delete folders.' });
      }
      const result = deleteUserFolder(user.id, key);
      if (result?._convexSyncPromise) await result._convexSyncPromise;
      return sendJson(res, 200, { success: true, ...result });
    },

    /** GET /api/files/order?folderId=... */
    async getFileOrderApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const urlObj = new URL(req.url, 'http://localhost');
      const folderId = urlObj.searchParams.get('folderId') || 'root';
      await hydrateUserFileOrderFromConvex(user.id, folderId);
      const order = getUserFileOrder(user.id, folderId);
      return sendJson(res, 200, { success: true, folderId, order });
    },

    /** PUT /api/files/order */
    async saveFileOrderApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      const folderId = String(body.folderId || 'root').trim() || 'root';
      const order = saveUserFileOrder(user.id, folderId, body.order || {});
      if (order?._convexSyncPromise) await order._convexSyncPromise;
      return sendJson(res, 200, { success: true, folderId, order });
    },

    /** GET /api/preferences */
    async getPreferencesApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      await hydrateUserPreferencesFromConvex(user.id);
      const preferences = getUserPreferences(user.id);
      return sendJson(res, 200, { success: true, preferences });
    },

    /** PATCH /api/preferences (and PUT /api/preferences) */
    async savePreferencesApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      const preferences = saveUserPreferences(user.id, body);
      if (preferences?._convexSyncPromise) await preferences._convexSyncPromise;
      return sendJson(res, 200, { success: true, preferences });
    },
    /** GET /api/quotation */
    async getQuotationApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const saved = await getUserQuotation(user.id);
        return sendJson(res, 200, { success: true, quotation: saved ? saved.data : null, updatedAt: saved ? saved.updatedAt : null });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message || 'Failed to load quotation.' });
      }
    },

    /** PUT /api/quotation */
    async saveQuotationApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = await saveUserQuotation(user.id, body && body.quotation);
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** POST /api/quotation/logo - Upload quotation logo image to Convex Cloud Storage (<= 5MB) */
    async uploadQuotationLogoApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      const rawContentType = (req.headers['content-type'] || '').toLowerCase();
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
        return sendJson(res, 200, {
          ok: true,
          logoUrl: url || '',
          storageId: storageId || '',
          message: 'Quotation logo uploaded to Convex.'
        });
      } catch (err) {
        return sendJson(res, 502, {
          error: 'Failed to upload logo to Convex: ' + (err.message || 'Unknown error')
        });
      }
    },

    /** GET /api/invoice */
    async getInvoiceApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const saved = await getUserInvoice(user.id);
        return sendJson(res, 200, { success: true, invoice: saved ? saved.data : null, updatedAt: saved ? saved.updatedAt : null });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message || 'Failed to load invoice.' });
      }
    },

    /** PUT /api/invoice */
    async saveInvoiceApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = await saveUserInvoice(user.id, body && body.invoice);
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** POST /api/invoice/logo - Upload invoice logo image to Convex Cloud Storage (<= 5MB) */
    async uploadInvoiceLogoApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      const rawContentType = (req.headers['content-type'] || '').toLowerCase();
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
        return sendJson(res, 200, {
          ok: true,
          logoUrl: url || '',
          storageId: storageId || '',
          message: 'Invoice logo uploaded to Convex.'
        });
      } catch (err) {
        return sendJson(res, 502, {
          error: 'Failed to upload logo to Convex: ' + (err.message || 'Unknown error')
        });
      }
    },

    /** GET /api/notepad */
    async getNotepadApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const saved = await getUserNotepad(user.id);
        return sendJson(res, 200, { success: true, notes: saved ? saved.notes : [], updatedAt: saved ? saved.updatedAt : null });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message || 'Failed to load notes.' });
      }
    },

    /** PUT /api/notepad */
    async saveNotepadApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req, 4 * 1024 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = await saveUserNotepad(user.id, body && body.notes);
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** GET /api/knowledge */
    async getKnowledgeHubApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        await hydrateEcosystemFromConvex(user.id);
        const saved = getUserKnowledgeHub(user.id);
        const ecosystem = getKnowledgeEcosystemSnapshot(user.id);
        return sendJson(res, 200, {
          success: true,
          state: saved ? saved.state : null,
          updatedAt: saved ? saved.updatedAt : null,
          ecosystem
        });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message || 'Failed to load Knowledge Hub.' });
      }
    },

    /** PUT /api/knowledge */
    async saveKnowledgeHubApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req, 4 * 1024 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = saveUserKnowledgeHub(user.id, body && body.state);
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** GET /api/os */
    async getOsWorkspaceApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        await hydrateEcosystemFromConvex(user.id);
        const saved = getUserOsWorkspace(user.id);
        const ecosystem = getKnowledgeEcosystemSnapshot(user.id);
        const knowledge = getUserKnowledgeHub(user.id);
        return sendJson(res, 200, {
          success: true,
          state: saved ? saved.state : null,
          updatedAt: saved ? saved.updatedAt : null,
          ecosystem,
          knowledgeSummary: knowledge && knowledge.state ? {
            objectsCount: Array.isArray(knowledge.state.objects) ? knowledge.state.objects.length : 0,
            decisionsCount: Array.isArray(knowledge.state.decisions) ? knowledge.state.decisions.length : 0,
            sopsCount: Array.isArray(knowledge.state.sops) ? knowledge.state.sops.length : 0
          } : null
        });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message || 'Failed to load Organisational OS.' });
      }
    },

    /** PUT /api/os */
    async saveOsWorkspaceApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req, 4 * 1024 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = saveUserOsWorkspace(user.id, body && body.state);
        return sendJson(res, 200, { success: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** POST /api/documents/generate — AI-powered document & slide synthesis */
    async generateDocumentApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      let body;
      try {
        body = await readJson(req, 256 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const docType = String(body.type || 'Project Charter').trim();
      const sourceCategory = String(body.source || '').trim();
      const sourceLabel = String(body.sourceLabel || 'Projects').trim();
      const rawSourceItems = Array.isArray(body.sourceItems) && body.sourceItems.length
        ? body.sourceItems
        : (Array.isArray(body.items) ? body.items : []);
      const items = rawSourceItems
        .map((x) => (typeof x === 'object' && x ? String(x.title || x.label || x.id || '').trim() : String(x || '').trim()))
        .filter(Boolean);
      const audience = String(body.audience || 'Executive team').trim();
      const length = Math.max(1, Math.min(3, Number(body.length || 2)));
      const notes = String(body.notes || '').trim();
      const clientContext = String(body.sourceContext || '').trim();
      const requestedTitle = String(body.title || '').trim();
      const defaultSections = Array.isArray(body.defaultSections) && body.defaultSections.length
        ? body.defaultSections.map((s) => String(s))
        : ['Executive Summary', 'Context & Scope', 'Strategy & Plan', 'Risks & Mitigation', 'Next Steps'];

      if (!rawSourceItems.length && !notes && !clientContext) {
        return sendJson(res, 400, {
          error: 'Please select at least one item from the source list (or provide instructions in Notes) before generating.'
        });
      }

      if (rawSourceItems.length) {
        const requestedBoardIds = rawSourceItems
          .map((x) => {
            if (!x || typeof x !== 'object') return '';
            if (x.boardId) return String(x.boardId).trim();
            const idStr = String(x.id || '').trim();
            if (idStr.startsWith('doc:')) return idStr.split(':')[1] || '';
            if (idStr.startsWith('ECO-BRD-')) return idStr.slice('ECO-BRD-'.length);
            return idStr;
          })
          .filter(Boolean);
        await hydrateEcosystemFromConvex(user.id, requestedBoardIds);
      }

      const sourceCtx = rawSourceItems.length
        ? getDocumentSourceContext(user.id, sourceCategory, rawSourceItems)
        : { items: [], missingOrEmptyTitles: [], combinedContext: '' };

      const primaryContext = [sourceCtx.combinedContext, clientContext].filter(Boolean).join('\n\n').trim();

      if (rawSourceItems.length && !primaryContext) {
        const missingList = sourceCtx.missingOrEmptyTitles.length
          ? sourceCtx.missingOrEmptyTitles.join(', ')
          : items.join(', ');
        return sendJson(res, 422, {
          error: `The selected source item (${missingList}) could not be loaded or contains no content yet. Add notes, cards, or tasks to it first, or select a different item.`
        });
      }

      const srcDisplay = items.length ? items.join(', ') : sourceLabel;
      const fallbackTitle = requestedTitle || `${docType}: ${items[0] || sourceLabel}`;

      const contextSnippets = primaryContext
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*-\s*/, '').trim())
        .filter((l) => l && !/^===/.test(l) && !/^Workspace Title:/i.test(l))
        .slice(0, 18);

      const buildFallback = () => ({
        title: fallbackTitle,
        aiProvider: 'local-engine',
        sections: defaultSections.map((h, idx) => {
          const snippet = contextSnippets[idx % Math.max(1, contextSnippets.length)] || srcDisplay;
          const paragraphs = [
            `Grounded in ${srcDisplay} (${sourceLabel}): ${snippet}. Written for ${audience.toLowerCase()} as part of ${h.toLowerCase()}.`
          ];
          if (length >= 2) {
            paragraphs.push(notes
              ? `Key operational focus: ${notes}`
              : `Additional context from ${srcDisplay}: ${contextSnippets.slice(0, 3).join('; ') || snippet}.`);
          }
          if (length >= 3) {
            paragraphs.push(`Cross-functional dependencies and governance reviews ensure ${srcDisplay} meets target quality, timeline, and compliance standards.`);
          }
          return {
            heading: h,
            kicker: `SECTION ${String(idx + 1).padStart(2, '0')}`,
            paragraphs,
            bullets: contextSnippets.length
              ? contextSnippets.slice(idx * 2, idx * 2 + 3).concat(contextSnippets.slice(0, 3)).slice(0, 3)
              : [
                  `Primary objective for ${h.toLowerCase()} grounded in ${items[0] || sourceLabel}`,
                  `Assigned owner and review checkpoint for ${audience.toLowerCase()}`,
                  `Key risk mitigation and measurable success indicator`
                ],
            speakerNotes: `Present ${h} to ${audience}: highlight ${snippet}.`
          };
        })
      });

      if (!hasAnyAiProvider()) {
        return sendJson(res, 200, { success: true, document: buildFallback() });
      }

      const parseAiDocumentResponse = (raw) => {
        if (!raw || typeof raw !== 'string') return null;
        let text = raw
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```\s*$/i, '')
          .trim();

        const tryParse = (candidate) => {
          if (!candidate) return null;
          try {
            const p = JSON.parse(candidate);
            if (p && Array.isArray(p.sections) && p.sections.length) return p;
          } catch {}
          // Repair common LLM JSON glitches: trailing commas and unescaped control chars inside strings
          try {
            let fixed = candidate.replace(/,\s*([}\]])/g, '$1');
            // Escape raw newlines/tabs inside JSON string literals
            let inStr = false;
            let escNext = false;
            let rebuilt = '';
            for (let i = 0; i < fixed.length; i += 1) {
              const ch = fixed[i];
              if (escNext) {
                rebuilt += ch;
                escNext = false;
                continue;
              }
              if (ch === '\\') {
                rebuilt += ch;
                escNext = true;
                continue;
              }
              if (ch === '"') {
                inStr = !inStr;
                rebuilt += ch;
                continue;
              }
              if (inStr && ch === '\n') {
                rebuilt += '\\n';
                continue;
              }
              if (inStr && ch === '\r') {
                continue;
              }
              if (inStr && ch === '\t') {
                rebuilt += ' ';
                continue;
              }
              rebuilt += ch;
            }
            const p2 = JSON.parse(rebuilt);
            if (p2 && Array.isArray(p2.sections) && p2.sections.length) return p2;
          } catch {}
          return null;
        };

        // 1. Direct parse
        let parsed = tryParse(text);
        if (parsed) return parsed;

        // 2. Find JSON object containing "sections"
        const secIdx = text.indexOf('"sections"');
        if (secIdx !== -1) {
          const startIdx = text.lastIndexOf('{', secIdx);
          const endIdx = text.lastIndexOf('}');
          if (startIdx !== -1 && endIdx > startIdx) {
            parsed = tryParse(text.slice(startIdx, endIdx + 1));
            if (parsed) return parsed;
          }
        }

        // 3. Outermost braces fallback
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          parsed = tryParse(text.slice(firstBrace, lastBrace + 1));
          if (parsed) return parsed;
        }

        // 4. Fallback: extract markdown headings if model returned markdown instead of JSON
        const mdBlocks = text.split(/\n(?=#{1,3}\s+)/).map((b) => b.trim()).filter(Boolean);
        if (mdBlocks.length >= 2 && /^#{1,3}\s+/.test(mdBlocks[0])) {
          const mdSections = [];
          let mdTitle = fallbackTitle;
          for (const block of mdBlocks) {
            const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            const hMatch = lines[0].match(/^(#{1,3})\s+(.+)/);
            if (!hMatch) continue;
            if (hMatch[1] === '#' && mdSections.length === 0) {
              mdTitle = hMatch[2].replace(/\*\*/g, '').trim();
              continue;
            }
            const heading = hMatch[2].replace(/\*\*/g, '').trim();
            const paragraphs = [];
            const bullets = [];
            for (const ln of lines.slice(1)) {
              if (/^[-*•]\s+/.test(ln)) bullets.push(ln.replace(/^[-*•]\s+/, '').trim());
              else paragraphs.push(ln.replace(/\*\*/g, '').trim());
            }
            if (paragraphs.length || bullets.length) {
              mdSections.push({
                heading,
                kicker: `SECTION ${String(mdSections.length + 1).padStart(2, '0')}`,
                paragraphs: paragraphs.slice(0, 3),
                bullets: bullets.slice(0, 5),
                speakerNotes: `Present ${heading} to ${audience}.`
              });
            }
          }
          if (mdSections.length) return { title: mdTitle, sections: mdSections };
        }

        return null;
      };

      const systemPrompt = [
        'You are a Principal Enterprise Document & Presentation Architect for QuantalFlow.',
        'Generate a crisp, boardroom-ready business document that exports cleanly to PDF, DOCX, PPTX, HTML, and Markdown.',
        'CRITICAL GROUNDING RULE: You MUST strictly rely on, reference, and synthesize the actual facts, ideas, numbers, examples, sticky notes, nodes, tasks, decisions, and content inside the SOURCE CONTENT provided in the user prompt.',
        'Do NOT invent unrelated topics, generic business platitudes, or placeholder text. Every section must directly reflect and cite the specific items from the SOURCE CONTENT.',
        'Return ONLY valid, strictly escaped JSON with no markdown code fences and no commentary before or after:',
        '{"title":"string","sections":[{"heading":"string","kicker":"SHORT UPPERCASE EYEBROW","paragraphs":["1-2 concise executive paragraphs"],"bullets":["3-4 concrete, scannable takeaways"],"speakerNotes":"1-2 sentence presenter note for PPTX slides"}]}',
        `Use these exact section headings: ${defaultSections.join(', ')}.`,
        'Inside JSON strings, never use unescaped double quotes or raw line breaks.'
      ].join('\n');

      const userPrompt = [
        `Document Type: ${docType}`,
        `Title preference: ${requestedTitle || `Create a strong executive title grounded in "${items[0] || sourceLabel}"`}`,
        `Source Category: ${sourceLabel}`,
        `Selected Source Item(s): ${srcDisplay}`,
        `Audience: ${audience}`,
        `Detail Level: ${length === 1 ? 'Brief (1 paragraph + 3 concise bullets per section)' : length === 3 ? 'Detailed (2-3 rich paragraphs + 4 bullets per section)' : 'Standard (1-2 sharp paragraphs + 3-4 bullets per section)'}`,
        notes ? `Additional Instructions: ${notes}` : '',
        primaryContext ? `\nSOURCE CONTENT (PRIMARY GROUNDING DATA — SYNTHESIZE STRICTLY FROM THIS):\n${primaryContext.slice(0, 18000)}` : ''
      ].filter(Boolean).join('\n');

      let lastAiError = '';
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const ai = await callAiRouter({
            systemPrompt,
            userContent: attempt === 0
              ? userPrompt
              : `${userPrompt}\n\nIMPORTANT: Return ONLY valid JSON matching {"title":"...","sections":[...]}.`,
            temperature: attempt === 0 ? 0.35 : 0.2,
            maxTokens: 3200
          });

          const parsed = ai && ai.content ? parseAiDocumentResponse(ai.content) : null;
          if (parsed && Array.isArray(parsed.sections) && parsed.sections.length) {
            return sendJson(res, 200, {
              success: true,
              document: {
                title: String(parsed.title || fallbackTitle).trim(),
                aiProvider: ai.label,
                sections: parsed.sections.map((s, idx) => ({
                  heading: String(s.heading || defaultSections[idx] || `Section ${idx + 1}`).trim(),
                  kicker: String(s.kicker || `SECTION ${String(idx + 1).padStart(2, '0')}`).trim(),
                  paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map((p) => String(p).trim()).filter(Boolean) : [],
                  bullets: Array.isArray(s.bullets) ? s.bullets.map((b) => String(b).trim()).filter(Boolean) : [],
                  speakerNotes: String(s.speakerNotes || '').trim()
                }))
              }
            });
          }
          lastAiError = `Unparseable AI response from ${ai ? ai.label : 'provider'}`;
          console.warn(`[documents/generate] Attempt ${attempt + 1} returned unparseable output from ${ai ? ai.label : 'unknown'}`);
        } catch (err) {
          lastAiError = err.message || 'AI provider error';
          console.warn(`[documents/generate] Attempt ${attempt + 1} error:`, err.message);
        }
      }

      return sendJson(res, 200, {
        success: true,
        aiWarning: lastAiError || 'AI providers unavailable — configure OPENROUTER_API_KEY or DEEPSEEK_API_KEY in deployment environment.',
        document: buildFallback()
      });
    },

    /** POST /api/documents/ai-edit — AI inline rewrite (Shorten / Expand / Grammar) */
    async aiEditDocumentApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const action = String(body.action || 'Fix grammar').trim();
      const title = String(body.title || 'Document').trim();
      const html = String(body.html || '').trim();
      if (!html) return sendJson(res, 400, { error: 'Document content is empty.' });

      if (hasAnyAiProvider()) {
        try {
          const ai = await callAiRouter({
            systemPrompt: 'You are an executive editor. Transform the provided HTML document according to the instruction while preserving clean <h2>, <p>, <ul>, <li> structure. Output ONLY the updated inner HTML with no markdown fences or outer <html> tags.',
            userContent: `Instruction: ${action}\nDocument Title: ${title}\n\nHTML:\n${html.slice(0, 12000)}`,
            temperature: 0.4,
            maxTokens: 2000
          });
          if (ai && ai.content) {
            const out = ai.content
              .replace(/^```html?\s*/i, '')
              .replace(/\s*```$/i, '')
              .trim();
            if (out && out.includes('<')) {
              return sendJson(res, 200, { success: true, html: out, aiProvider: ai.label });
            }
          }
        } catch {}
      }

      // Deterministic local refinement fallback
      const norm = normalizeDocumentPayload({ title, html });
      const refined = norm.sections.map((s) => {
        let paras = s.paragraphs.slice();
        let bullets = s.bullets.slice();
        if (/short/i.test(action)) {
          paras = paras.slice(0, 1).map((p) => p.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '));
          bullets = bullets.slice(0, 3);
        } else if (/expand/i.test(action)) {
          paras.push(`Additional operational detail for ${s.heading.toLowerCase()}: confirm milestone owners, governance sign-off criteria, and measurable KPI targets.`);
          if (!bullets.length) bullets.push(`Key deliverable for ${s.heading}`, 'Owner & target date', 'Success metric');
        } else {
          paras = paras.map((p) => p.replace(/\s+/g, ' ').trim().replace(/^[a-z]/, (c) => c.toUpperCase()));
        }
        return `<h2>${s.heading}</h2>` +
          paras.map((p) => `<p>${p}</p>`).join('') +
          (bullets.length ? `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : '');
      }).join('');

      return sendJson(res, 200, { success: true, html: refined, aiProvider: 'local-engine' });
    },

    /** POST /api/documents/export — Binary PPTX, DOCX, HTML, and Markdown generator */
    async exportDocumentApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });

      let body;
      try {
        body = await readJson(req, 2 * 1024 * 1024);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }

      const format = String(body.format || 'pptx').toLowerCase().trim();
      const doc = body.document || body;
      const safeName = String(doc.title || 'QuantalFlow_Document').replace(/[^\w-]+/g, '_').slice(0, 72) || 'QuantalFlow_Document';

      try {
        let buf;
        let mime;
        let ext;
        if (format === 'pptx') {
          buf = buildPptxBuffer(doc);
          mime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          ext = 'pptx';
        } else if (format === 'docx') {
          buf = buildDocxBuffer(doc);
          mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          ext = 'docx';
        } else if (format === 'html') {
          buf = Buffer.from(buildHtmlDocument(doc), 'utf8');
          mime = 'text/html; charset=utf-8';
          ext = 'html';
        } else if (format === 'md' || format === 'markdown') {
          buf = Buffer.from(buildMarkdownDocument(doc), 'utf8');
          mime = 'text/markdown; charset=utf-8';
          ext = 'md';
        } else {
          return sendJson(res, 400, { error: 'Unsupported export format.' });
        }

        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': buf.length,
          'Content-Disposition': `attachment; filename="${safeName}.${ext}"`,
          'Cache-Control': 'no-store'
        });
        return res.end(buf);
      } catch (err) {
        console.error('[documents/export] failed:', err);
        return sendJson(res, 500, { error: 'Export failed: ' + (err.message || 'Unknown error') });
      }
    },

    /* ---------------- Workspace & Board Member Collaboration ---------------- */

    /** GET /api/workspace/members */
    async listWorkspaceMembersApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const data = listWorkspaceMembers(user.id);
        return sendJson(res, 200, { ok: true, ...data });
      } catch (err) {
        return sendJson(res, err.status || 500, { error: err.message });
      }
    },

    /** POST /api/workspace/invitations */
    async inviteWorkspaceMembersApi(req, res) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = inviteWorkspaceMembers({
          actorUserId: user.id,
          emails: body.emails !== undefined ? body.emails : body.email,
          permission: body.permission || 'editor'
        });
        return sendJson(res, 201, { ok: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** PATCH /api/workspace/members/:id */
    async updateWorkspaceMemberApi(req, res, memberId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = updateWorkspaceMemberRole({
          actorUserId: user.id,
          memberId,
          permission: body.permission
        });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** DELETE /api/workspace/members/:id */
    async removeWorkspaceMemberApi(req, res, memberId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const result = removeWorkspaceMember({ actorUserId: user.id, memberId });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** GET /api/boards/:id/members */
    async listBoardMembersApi(req, res, boardId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const result = listBoardMembers({ boardId, actorUserId: user.id });
        return sendJson(res, 200, { ok: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 404, { error: err.message });
      }
    },

    /** POST /api/boards/:id/invitations */
    async inviteBoardMembersApi(req, res, boardId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = inviteBoardMembers({
          boardId,
          actorUserId: user.id,
          emails: body.emails !== undefined ? body.emails : body.email,
          permission: body.permission || 'editor'
        });
        return sendJson(res, 201, { ok: true, ...result });
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** PATCH /api/boards/:id/members/:memberId */
    async updateBoardMemberApi(req, res, boardId, memberId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      let body;
      try {
        body = await readJson(req);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
      try {
        const result = updateBoardMemberRole({
          boardId,
          actorUserId: user.id,
          memberId,
          permission: body.permission
        });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** DELETE /api/boards/:id/members/:memberId */
    async removeBoardMemberApi(req, res, boardId, memberId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      try {
        const result = removeBoardMember({ boardId, actorUserId: user.id, memberId });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, err.status || 400, { error: err.message });
      }
    },

    /** GET /api/boards/:id/access - Live presence heartbeat + real-time permission enforcement */
    async getBoardAccessApi(req, res, boardId) {
      const user = await auth(req, res);
      if (!user) return sendJson(res, 401, { error: 'Not authenticated.' });
      const access = resolveBoardAccess(boardId, user.id);
      if (!access) {
        return sendJson(res, 403, { error: 'Access to this board has been revoked.', revoked: true });
      }
      const presence = recordBoardPresence(access.internalId, user, access.role);
      return sendJson(res, 200, {
        ok: true,
        permission: access.role,
        capabilities: capabilitiesForRole(access.role),
        presence
      });
    }
  };
}

function parseCloudinaryUrl(url) {
  const m = String(url || '').match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return null;
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

function signCloudinary(params, secret) {
  const keys = Object.keys(params).sort();
  const str = keys.map((k) => `${k}=${params[k]}`).join('&') + (secret || '');
  return crypto.createHash('sha1').update(str).digest('hex');
}
