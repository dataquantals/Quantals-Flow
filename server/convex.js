import { config } from './config.js';

/**
 * Lightweight Node native fetch client for Convex Cloud.
 *
 * Cloud URL:      https://agreeable-starfish-202.convex.cloud
 * HTTP Actions:   https://agreeable-starfish-202.convex.site
 *
 * Auth note: the configured key is a *preview* deploy key
 * (`preview:<team>:<project>|...`). Preview deployments expose their public
 * functions, and a preview key is not a valid `Authorization: Convex <key>`
 * bearer token, so it is deliberately not sent on /api/query and /api/mutation
 * calls (sending it just makes Convex reject the request). Production keys are
 * sent as a bearer token.
 *
 * Failures used to be swallowed silently, which made a broken sync look like a
 * healthy one. They now log a warning so a missing table or a bad schema deploy
 * shows up in the server console instead of only being visible in the Convex
 * dashboard.
 */

const TIMEOUT_MS = 20000;

function authHeaders() {
  const key = config.convex.deployKey;
  if (!key || key.startsWith('preview:')) return {};
  return { Authorization: `Convex ${key}` };
}

async function postConvex(kind, path, args = {}) {
  if (!config.convex.cloudUrl || config.isTest) return null;
  // Every Convex function rejects calls without the shared secret. If it is
  // missing, fail closed here instead of sending a request that cannot succeed.
  const secret = config.convex.syncSecret;
  if (!secret) {
    console.warn(`[convex] SYNC_SECRET is not set; skipping ${path} (Convex functions are locked).`);
    return null;
  }
  try {
    const res = await fetch(`${config.convex.cloudUrl}/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ path, args: { ...args, secret }, format: 'json' }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`[convex] ${kind} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`[convex] ${kind} ${path} -> unparsable response: ${text.slice(0, 200)}`);
      return null;
    }
    if (data.status !== 'success') {
      console.warn(
        `[convex] ${kind} ${path} -> ${data.status || 'error'}: ` +
        `${data.errorMessage || data.error || 'unknown error'}`
      );
      return null;
    }
    return data.value;
  } catch (err) {
    console.warn(`[convex] ${kind} ${path} -> ${err.message}`);
    return null;
  }
}

export async function convexQuery(path, args = {}) {
  return postConvex('query', path, args);
}

export async function convexMutation(path, args = {}) {
  return postConvex('mutation', path, args);
}

export async function generateConvexUploadUrl(userId) {
  return await convexMutation('files:generateUploadUrl', { userId: String(userId) });
}

export async function getConvexFileUrl(storageId) {
  if (!storageId) return null;
  return await convexQuery('files:getFileUrl', { storageId });
}

export async function saveConvexAvatar(email, storageId, userId) {
  if (!email || !storageId) return null;
  return await convexMutation('files:saveAvatar', { email, storageId, userId: String(userId) });
}

export async function uploadBufferToConvex(buffer, contentType = 'image/png', userId) {
  const uploadUrl = await generateConvexUploadUrl(userId);
  if (!uploadUrl) throw new Error('Failed to generate Convex upload URL.');
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: buffer,
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Convex storage upload failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const fileUrl = await getConvexFileUrl(data.storageId);
  return { storageId: data.storageId, url: fileUrl };
}

/* ------------------------------------------------------------------ *
 * Boards
 * ------------------------------------------------------------------ */

export function syncBoardToConvex(board, userId, convexBoardId) {
  if (!board || !userId || config.isTest) return;
  convexMutation('boards:upsert', {
    userId: String(userId),
    boardId: String(convexBoardId || board.id),
    title: board.title || 'New Collaborative Board',
    category: board.category || 'Strategy & Planning',
    starred: Boolean(board.starred),
    stateJson: board.state ? JSON.stringify(board.state) : '{}'
  }).catch((err) => console.warn('[convex] board sync failed:', err.message));
}

export function deleteBoardFromConvex(boardId, userId) {
  if (!boardId || !userId || config.isTest) return Promise.resolve(false);
  return convexMutation('boards:remove', {
    userId: String(userId),
    boardId: String(boardId)
  })
    .then(() => true)
    .catch((err) => {
      console.warn('[convex] board delete failed:', err.message);
      return false;
    });
}

/* ------------------------------------------------------------------ *
 * Convex Auth & User Mirroring
 * ------------------------------------------------------------------ */

export function syncUserToConvex(user, passwordHash) {
  if (!user || config.isTest) return Promise.resolve(null);
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role || 'member',
    externalId: String(user.id)
  };
  if (passwordHash) payload.passwordHash = passwordHash;
  if (user.avatar_url) payload.avatarUrl = user.avatar_url;
  if (user.avatar_storage_id) payload.avatarStorageId = user.avatar_storage_id;

  return convexMutation('users:upsertUser', payload).catch((err) => {
    console.warn('[convex] user sync failed:', err.message);
    return null;
  });
}

export async function getConvexUserByEmail(email) {
  if (!email || config.isTest) return null;
  return await convexQuery('users:findByEmail', { email: String(email).trim().toLowerCase() });
}

export async function updateConvexUserPassword(email, passwordHash) {
  if (!email || !passwordHash || config.isTest) return null;
  return await convexMutation('users:updatePassword', {
    email: String(email).trim().toLowerCase(),
    passwordHash
  });
}

export async function createConvexSession({ token, userId, email, name, role, expiresAt }) {
  if (!token || config.isTest) return null;
  return await convexMutation('sessions:create', {
    token,
    userId: String(userId),
    email: email || '',
    name: name || '',
    role: role || 'member',
    expiresAt
  });
}

export async function getConvexSession(token) {
  if (!token || config.isTest) return null;
  return await convexQuery('sessions:getByToken', { token });
}

export async function removeConvexSession(token) {
  if (!token || config.isTest) return false;
  return await convexMutation('sessions:removeByToken', { token });
}

export async function removeConvexSessionsByUserId(userId) {
  if (!userId || config.isTest) return false;
  return await convexMutation('sessions:removeByUserId', { userId: String(userId) });
}

/* ------------------------------------------------------------------ *
 * Project planning plans
 *
 * The browser plan is one object with nine list sections. Convex stores the
 * snapshot on `projectPlans` and each section in its own table so the data is
 * queryable rather than buried in a JSON string.
 * ------------------------------------------------------------------ */

/** Plan-state key -> Convex table alias used by convex/projectPlanning.js. */
const PLAN_SECTIONS = {
  phases: 'wbsPhases',
  tasks: 'tasks',
  milestones: 'milestones',
  resources: 'resources',
  timesheets: 'timesheets',
  wikiPages: 'wikiPages',
  files: 'sharedFiles',
  raidItems: 'raidItems',
  changeRequests: 'changeRequests'
};

function text(value, max = 500) {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).slice(0, max);
}

function toEntity(item, index, prefix) {
  const source = item && typeof item === 'object' ? item : { value: item };
  const rawId = source.id ?? source.wbs ?? source.key ?? source.name;
  const entityId = text(rawId, 120) || `${prefix}-${index + 1}`;
  return {
    entityId,
    position: index,
    title: text(source.title ?? source.name),
    status: text(source.status ?? source.type),
    owner: text(
      source.owner ??
      source.assignee ??
      source.uploadedBy ??
      source.requestedBy ??
      source.resourceId ??
      source.ownerId
    ),
    date: text(source.date ?? source.submittedAt ?? source.dueDate ?? source.startDate ??
      (source.day !== undefined ? `day ${source.day}` : undefined)),
    dataJson: JSON.stringify(source),
    updatedAt: Date.now()
  };
}

/** Build the Convex `projectPlanning:save` payload from a plan state object. */
export function buildProjectPlanPayload(boardId, plan, userId) {
  const payload = {
    userId: String(userId),
    boardId: String(boardId),
    projectName: text(plan.projectName, 200) || 'Untitled Project',
    projectCode: text(plan.projectCode, 60),
    activeSprint: text(plan.activeSprint, 120),
    baseBudget: Number.isFinite(Number(plan.baseBudget)) ? Number(plan.baseBudget) : 0,
    currency: text(plan.currency, 12),
    owner: text(plan.owner ?? plan.projectOwner, 120),
    status: text(plan.status, 60),
    startDate: text(plan.startDate),
    endDate: text(plan.endDate),
    stateVersion: Number(plan.stateVersion) || 1,
    snapshotJson: JSON.stringify(plan)
  };

  for (const [alias, stateKey] of Object.entries(PLAN_SECTIONS)) {
    const list = Array.isArray(plan[stateKey]) ? plan[stateKey] : [];
    payload[alias] = list.map((item, index) => toEntity(item, index, stateKey));
  }
  return payload;
}

/** Push a plan to Convex. Resolves to the sync result, or null when it failed. */
export async function syncProjectPlanToConvex(boardId, plan, userId) {
  if (!boardId || !plan || !userId || config.isTest) return null;
  return await convexMutation('projectPlanning:save', buildProjectPlanPayload(boardId, plan, userId));
}

/** Read a plan back from Convex (used when a browser has no local copy). */
export async function fetchProjectPlanFromConvex(boardId, userId) {
  if (!boardId || !userId || config.isTest) return null;
  const result = await convexQuery('projectPlanning:get', { userId: String(userId), boardId: String(boardId) });
  if (!result || !result.plan) return null;
  if (result.plan.snapshot && typeof result.plan.snapshot === 'object') return result.plan.snapshot;

  // Snapshot missing/corrupt: rebuild a usable plan from the section rows.
  const rebuilt = {};
  for (const [alias, stateKey] of Object.entries(PLAN_SECTIONS)) {
    rebuilt[stateKey] = Array.isArray(result.sections?.[alias]) ? result.sections[alias] : [];
  }
  rebuilt.projectName = result.plan.projectName;
  rebuilt.projectCode = result.plan.projectCode || '';
  return rebuilt;
}

export function deleteProjectPlanFromConvex(boardId, userId) {
  if (!boardId || !userId || config.isTest) return Promise.resolve(false);
  return convexMutation('projectPlanning:remove', { userId: String(userId), boardId: String(boardId) })
    .then(() => true)
    .catch((err) => {
      console.warn('[convex] plan delete failed:', err.message);
      return false;
    });
}

export async function checkConvexConnection() {
  const info = {
    configured: Boolean(config.convex.cloudUrl),
    cloudUrl: config.convex.cloudUrl,
    siteUrl: config.convex.siteUrl,
    deployment: 'preview:data-quantals:quantals-flow',
    reachable: false
  };
  if (config.isTest) return info;
  try {
    const res = await fetch(config.convex.cloudUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    info.reachable = res.status < 500;
  } catch {
    info.reachable = false;
  }
  return info;
}
