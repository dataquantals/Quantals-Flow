import crypto from 'node:crypto';
import { db } from './db.js';
import { createClerkOrganization, inviteClerkOrganizationMember } from './clerk.js';

/**
 * Multi-Tenant Enterprise Organisation Engine (`server/orgs.js`)
 *
 * Hierarchy:
 *   User Account -> Multiple Organisations (Clerk Organizations synced)
 *     -> Departments -> Teams -> Members (6-Role RBAC)
 *     -> Isolated Workspaces, Invitations, Skills/Expert Finder, Analytics,
 *        Billing Plans, and Organisational Memory.
 */

export const ORG_ROLES = ['OWNER', 'ADMINISTRATOR', 'MANAGER', 'MEMBER', 'VIEWER', 'GUEST'];

export const ORG_TYPES = [
  'Business',
  'University',
  'Government',
  'NGO',
  'Consultancy',
  'Healthcare',
  'Research Institute',
  'Educational Institution',
  'Personal Workspace'
];

export const ORG_MODULES = [
  'Projects',
  'Knowledge Hub',
  'Document Studio',
  'Whiteboards',
  'Mind Maps',
  'Workflow Studio',
  'Analytics',
  'Learning Centre'
];

export const BILLING_PLANS = {
  free: { id: 'free', name: 'Starter Free', priceMonthly: 0, seatLimit: 5, storageGb: 5, sso: false },
  pro: { id: 'pro', name: 'Pro Team', priceMonthly: 18, seatLimit: 25, storageGb: 100, sso: false },
  business: { id: 'business', name: 'Business Scale', priceMonthly: 39, seatLimit: 250, storageGb: 1000, sso: true },
  enterprise: { id: 'enterprise', name: 'Enterprise', priceMonthly: 89, seatLimit: 10000, storageGb: 10000, sso: true }
};

export const ROLE_PERMISSIONS = {
  OWNER: {
    label: 'Owner',
    canManageUsers: true,
    canManageBilling: true,
    canConfigureOrg: true,
    canManageSecurity: true,
    canManageDepartments: true,
    canManageTeams: true,
    canManageRoles: true,
    canDeleteOrg: true,
    canTransferOwnership: true,
    canApproveDocs: true,
    canEditContent: true,
    canViewAnalytics: true,
    canViewInternal: true
  },
  ADMINISTRATOR: {
    label: 'Administrator',
    canManageUsers: true,
    canManageBilling: false,
    canConfigureOrg: true,
    canManageSecurity: true,
    canManageDepartments: true,
    canManageTeams: true,
    canManageRoles: true,
    canDeleteOrg: false,
    canTransferOwnership: false,
    canApproveDocs: true,
    canEditContent: true,
    canViewAnalytics: true,
    canViewInternal: true
  },
  MANAGER: {
    label: 'Manager',
    canManageUsers: false,
    canManageBilling: false,
    canConfigureOrg: false,
    canManageSecurity: false,
    canManageDepartments: false,
    canManageTeams: true,
    canManageRoles: false,
    canDeleteOrg: false,
    canTransferOwnership: false,
    canApproveDocs: true,
    canEditContent: true,
    canViewAnalytics: true,
    canViewInternal: true
  },
  MEMBER: {
    label: 'Member',
    canManageUsers: false,
    canManageBilling: false,
    canConfigureOrg: false,
    canManageSecurity: false,
    canManageDepartments: false,
    canManageTeams: false,
    canManageRoles: false,
    canDeleteOrg: false,
    canTransferOwnership: false,
    canApproveDocs: false,
    canEditContent: true,
    canViewAnalytics: false,
    canViewInternal: true
  },
  VIEWER: {
    label: 'Viewer',
    canManageUsers: false,
    canManageBilling: false,
    canConfigureOrg: false,
    canManageSecurity: false,
    canManageDepartments: false,
    canManageTeams: false,
    canManageRoles: false,
    canDeleteOrg: false,
    canTransferOwnership: false,
    canApproveDocs: false,
    canEditContent: false,
    canViewAnalytics: false,
    canViewInternal: true
  },
  GUEST: {
    label: 'Guest',
    canManageUsers: false,
    canManageBilling: false,
    canConfigureOrg: false,
    canManageSecurity: false,
    canManageDepartments: false,
    canManageTeams: false,
    canManageRoles: false,
    canDeleteOrg: false,
    canTransferOwnership: false,
    canApproveDocs: false,
    canEditContent: false,
    canViewAnalytics: false,
    canViewInternal: false
  }
};

export function normalizeOrgRole(role) {
  const r = String(role || 'MEMBER').trim().toUpperCase();
  if (r === 'ADMIN') return 'ADMINISTRATOR';
  return ORG_ROLES.includes(r) ? r : 'MEMBER';
}

export function getOrgPermissions(role) {
  const norm = normalizeOrgRole(role);
  return { role: norm, ...(ROLE_PERMISSIONS[norm] || ROLE_PERMISSIONS.MEMBER) };
}

/* ---------------- Schema Initialization ---------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id            TEXT    PRIMARY KEY,
    clerk_org_id  TEXT    DEFAULT '',
    name          TEXT    NOT NULL,
    slug          TEXT    NOT NULL UNIQUE,
    logo_url      TEXT    DEFAULT '',
    org_type      TEXT    NOT NULL DEFAULT 'Business',
    industry      TEXT    DEFAULT '',
    country       TEXT    DEFAULT '',
    timezone      TEXT    DEFAULT 'UTC',
    team_size     TEXT    DEFAULT '1-10',
    website       TEXT    DEFAULT '',
    description   TEXT    DEFAULT '',
    modules_json  TEXT    NOT NULL DEFAULT '[]',
    plan          TEXT    NOT NULL DEFAULT 'free',
    seat_limit    INTEGER NOT NULL DEFAULT 5,
    billing_email TEXT    DEFAULT '',
    settings_json TEXT    NOT NULL DEFAULT '{}',
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS org_departments (
    id           TEXT    PRIMARY KEY,
    org_id       TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    description  TEXT    DEFAULT '',
    head_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    goals_json   TEXT    NOT NULL DEFAULT '[]',
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS org_teams (
    id            TEXT    PRIMARY KEY,
    org_id        TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id TEXT    REFERENCES org_departments(id) ON DELETE SET NULL,
    name          TEXT    NOT NULL,
    description   TEXT    DEFAULT '',
    lead_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS org_memberships (
    id            TEXT    PRIMARY KEY,
    org_id        TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          TEXT    NOT NULL DEFAULT 'MEMBER',
    department_id TEXT    DEFAULT '',
    team_id       TEXT    DEFAULT '',
    job_title     TEXT    DEFAULT '',
    skills_json   TEXT    NOT NULL DEFAULT '{}',
    availability  TEXT    NOT NULL DEFAULT 'Available',
    workload      INTEGER NOT NULL DEFAULT 50,
    location      TEXT    DEFAULT '',
    joined_at     INTEGER NOT NULL,
    UNIQUE(org_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS org_invitations (
    id            TEXT    PRIMARY KEY,
    org_id        TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email         TEXT    DEFAULT '',
    role          TEXT    NOT NULL DEFAULT 'MEMBER',
    department_id TEXT    DEFAULT '',
    team_id       TEXT    DEFAULT '',
    token         TEXT    NOT NULL UNIQUE,
    invite_type   TEXT    NOT NULL DEFAULT 'email',
    invited_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status        TEXT    NOT NULL DEFAULT 'pending',
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS org_memory_items (
    id          TEXT    PRIMARY KEY,
    org_id      TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_type TEXT    NOT NULL DEFAULT 'document',
    title       TEXT    NOT NULL,
    summary     TEXT    DEFAULT '',
    link        TEXT    DEFAULT '',
    author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    tags_json   TEXT    NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_active_org (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id     TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    updated_at INTEGER NOT NULL
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_memberships(org_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_memberships(user_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_org_depts_org ON org_departments(org_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_org_teams_org ON org_teams(org_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_org_invites_org ON org_invitations(org_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_org_memory_org ON org_memory_items(org_id, created_at DESC)');

// Multi-tenant isolation columns on core tenant-scoped tables (idempotent)
try { db.exec("ALTER TABLE boards ADD COLUMN org_id TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE files ADD COLUMN org_id TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE activity_logs ADD COLUMN org_id TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN clerk_user_id TEXT DEFAULT ''"); } catch {}

function safeJson(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function slugify(text) {
  return String(text || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'org';
}

function hydrateOrg(row, membership = null) {
  if (!row) return null;
  const planMeta = BILLING_PLANS[row.plan] || BILLING_PLANS.free;
  return {
    id: row.id,
    clerkOrgId: row.clerk_org_id || '',
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url || '',
    orgType: row.org_type || 'Business',
    industry: row.industry || '',
    country: row.country || '',
    timezone: row.timezone || 'UTC',
    teamSize: row.team_size || '1-10',
    website: row.website || '',
    description: row.description || '',
    modules: safeJson(row.modules_json, ORG_MODULES),
    plan: row.plan || 'free',
    planDetails: planMeta,
    seatLimit: Number(row.seat_limit) || planMeta.seatLimit,
    billingEmail: row.billing_email || '',
    settings: safeJson(row.settings_json, {}),
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(membership ? { role: normalizeOrgRole(membership.role), permissions: getOrgPermissions(membership.role) } : {})
  };
}

export function listUserOrganizations(userId) {
  if (!userId) return [];
  const rows = db.prepare(`
    SELECT o.*, m.role AS member_role, m.department_id, m.team_id
    FROM org_memberships m
    JOIN organizations o ON o.id = m.org_id
    WHERE m.user_id = ?
    ORDER BY o.created_at ASC
  `).all(userId);
  return rows.map((r) => hydrateOrg(r, { role: r.member_role }));
}

export function getActiveOrgContext(userId) {
  if (!userId) return { activeOrg: null, organizations: [], membership: null, permissions: null, needsOnboarding: true };
  const orgs = listUserOrganizations(userId);
  if (!orgs.length) {
    return { activeOrg: null, organizations: [], membership: null, permissions: null, needsOnboarding: true };
  }
  const activeRow = db.prepare('SELECT org_id FROM user_active_org WHERE user_id = ?').get(userId);
  let active = (activeRow && orgs.find((o) => o.id === activeRow.org_id)) || orgs[0];
  if (!activeRow || activeRow.org_id !== active.id) {
    db.prepare(`
      INSERT INTO user_active_org (user_id, org_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET org_id = excluded.org_id, updated_at = excluded.updated_at
    `).run(userId, active.id, Date.now());
  }
  const membership = db.prepare('SELECT * FROM org_memberships WHERE org_id = ? AND user_id = ?').get(active.id, userId);
  const permissions = getOrgPermissions(membership ? membership.role : 'MEMBER');
  return {
    activeOrg: active,
    organizations: orgs,
    membership,
    permissions,
    needsOnboarding: false
  };
}

export function switchActiveOrganization(userId, orgId) {
  const membership = db.prepare('SELECT * FROM org_memberships WHERE org_id = ? AND user_id = ?').get(String(orgId), userId);
  if (!membership) {
    const err = new Error('You do not belong to that organisation.');
    err.status = 403;
    throw err;
  }
  db.prepare(`
    INSERT INTO user_active_org (user_id, org_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET org_id = excluded.org_id, updated_at = excluded.updated_at
  `).run(userId, String(orgId), Date.now());
  return getActiveOrgContext(userId);
}

export async function createOrganization({
  owner,
  name,
  logoUrl = '',
  orgType = 'Business',
  industry = '',
  country = '',
  timezone = 'UTC',
  teamSize = '1-10',
  website = '',
  description = '',
  modules = ORG_MODULES,
  plan = 'free',
  invites = []
}) {
  const cleanName = String(name || '').trim().slice(0, 100);
  if (!cleanName) {
    const err = new Error('Organisation name is required.');
    err.status = 400;
    throw err;
  }
  const now = Date.now();
  const id = `org_${now.toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const baseSlug = slugify(cleanName);
  const existingSlug = db.prepare('SELECT id FROM organizations WHERE slug = ?').get(baseSlug);
  const slug = existingSlug ? `${baseSlug}-${crypto.randomBytes(2).toString('hex')}` : baseSlug;
  const planMeta = BILLING_PLANS[plan] || BILLING_PLANS.free;
  const cleanModules = Array.isArray(modules) && modules.length ? modules.map(String) : ORG_MODULES;

  // Best-effort sync to Clerk Organizations
  const clerkOrg = await createClerkOrganization({
    name: cleanName,
    slug,
    createdBy: owner.clerk_user_id || undefined,
    publicMetadata: { orgType, industry, country, quantalflowOrgId: id }
  });

  db.prepare(`
    INSERT INTO organizations (
      id, clerk_org_id, name, slug, logo_url, org_type, industry, country, timezone,
      team_size, website, description, modules_json, plan, seat_limit, billing_email,
      settings_json, owner_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    clerkOrg ? clerkOrg.id : '',
    cleanName,
    slug,
    String(logoUrl || '').slice(0, 500),
    ORG_TYPES.includes(orgType) ? orgType : 'Business',
    String(industry || '').slice(0, 80),
    String(country || '').slice(0, 80),
    String(timezone || 'UTC').slice(0, 60),
    String(teamSize || '1-10').slice(0, 30),
    String(website || '').slice(0, 200),
    String(description || '').slice(0, 600),
    JSON.stringify(cleanModules),
    planMeta.id,
    planMeta.seatLimit,
    owner.email || '',
    JSON.stringify({ mfaRequired: false, ssoEnabled: planMeta.sso, allowGuestLinks: true }),
    owner.id,
    now,
    now
  );

  // Create default starter Department & Team for non-personal orgs
  let defaultDeptId = '';
  let defaultTeamId = '';
  if (orgType !== 'Personal Workspace') {
    defaultDeptId = `dept_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare('INSERT INTO org_departments (id, org_id, name, description, head_user_id, goals_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(defaultDeptId, id, 'Operations', 'Core operations and delivery', owner.id, '[]', now);
    defaultTeamId = `team_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare('INSERT INTO org_teams (id, org_id, department_id, name, description, lead_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(defaultTeamId, id, defaultDeptId, 'Core Team', 'Founding workspace team', owner.id, now);
  }

  // Add creator as OWNER
  const memId = `mem_${crypto.randomBytes(4).toString('hex')}`;
  db.prepare(`
    INSERT INTO org_memberships (
      id, org_id, user_id, role, department_id, team_id, job_title, skills_json, availability, workload, location, joined_at
    ) VALUES (?, ?, ?, 'OWNER', ?, ?, ?, ?, 'Available', 45, ?, ?)
  `).run(
    memId,
    id,
    owner.id,
    defaultDeptId,
    defaultTeamId,
    owner.title || 'Founder / Owner',
    JSON.stringify({ technical: [], business: ['Strategy', 'Leadership'], research: [], tools: ['QuantalFlow'], certifications: [], interests: [] }),
    country || '',
    now
  );

  // Set as active organisation
  db.prepare(`
    INSERT INTO user_active_org (user_id, org_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET org_id = excluded.org_id, updated_at = excluded.updated_at
  `).run(owner.id, id, now);

  // Seed initial Organisational Memory record
  addOrgMemoryItem({
    orgId: id,
    sourceType: 'decision',
    title: `${cleanName} workspace launched`,
    summary: `Initialised ${orgType} organisation with modules: ${cleanModules.join(', ')}.`,
    link: '/dashboard/people/',
    authorId: owner.id,
    tags: [orgType, industry || 'Workspace'].filter(Boolean)
  });

  // Process initial onboarding invitations
  if (Array.isArray(invites) && invites.length) {
    for (const inv of invites.slice(0, 50)) {
      if (!inv || !inv.email) continue;
      try {
        await createOrgInvitation({
          orgId: id,
          inviter: owner,
          email: inv.email,
          role: inv.role || 'MEMBER',
          departmentId: inv.departmentId || defaultDeptId,
          teamId: inv.teamId || defaultTeamId,
          inviteType: 'email'
        });
      } catch {}
    }
  }

  return getActiveOrgContext(owner.id);
}

export function updateOrganization({ orgId, actor, patch }) {
  const mem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  const perms = getOrgPermissions(mem ? mem.role : '');
  if (!mem || !perms.canConfigureOrg) {
    const err = new Error('Only Organisation Owners or Administrators can update organisation settings.');
    err.status = 403;
    throw err;
  }
  if ((patch.plan !== undefined || patch.billingEmail !== undefined) && !perms.canManageBilling) {
    const err = new Error('Only the Organisation Owner can manage billing and subscription plans.');
    err.status = 403;
    throw err;
  }

  const cur = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
  if (!cur) {
    const err = new Error('Organisation not found.');
    err.status = 404;
    throw err;
  }
  const nextPlan = patch.plan && BILLING_PLANS[patch.plan] ? BILLING_PLANS[patch.plan] : (BILLING_PLANS[cur.plan] || BILLING_PLANS.free);
  const nextModules = Array.isArray(patch.modules) ? JSON.stringify(patch.modules.map(String)) : cur.modules_json;
  const nextSettings = patch.settings && typeof patch.settings === 'object'
    ? JSON.stringify({ ...safeJson(cur.settings_json, {}), ...patch.settings })
    : cur.settings_json;

  db.prepare(`
    UPDATE organizations SET
      name = ?, logo_url = ?, org_type = ?, industry = ?, country = ?, timezone = ?,
      team_size = ?, website = ?, description = ?, modules_json = ?,
      plan = ?, seat_limit = ?, billing_email = ?, settings_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    patch.name !== undefined ? String(patch.name).trim().slice(0, 100) || cur.name : cur.name,
    patch.logoUrl !== undefined ? String(patch.logoUrl).slice(0, 500) : cur.logo_url,
    patch.orgType && ORG_TYPES.includes(patch.orgType) ? patch.orgType : cur.org_type,
    patch.industry !== undefined ? String(patch.industry).slice(0, 80) : cur.industry,
    patch.country !== undefined ? String(patch.country).slice(0, 80) : cur.country,
    patch.timezone !== undefined ? String(patch.timezone).slice(0, 60) : cur.timezone,
    patch.teamSize !== undefined ? String(patch.teamSize).slice(0, 30) : cur.team_size,
    patch.website !== undefined ? String(patch.website).slice(0, 200) : cur.website,
    patch.description !== undefined ? String(patch.description).slice(0, 600) : cur.description,
    nextModules,
    nextPlan.id,
    nextPlan.seatLimit,
    patch.billingEmail !== undefined ? String(patch.billingEmail).slice(0, 160) : cur.billing_email,
    nextSettings,
    Date.now(),
    orgId
  );

  return hydrateOrg(db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId), mem);
}

export function deleteOrganization({ orgId, actor }) {
  const mem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  const perms = getOrgPermissions(mem ? mem.role : '');
  if (!mem || !perms.canDeleteOrg) {
    const err = new Error('Only the Organisation Owner can delete this organisation.');
    err.status = 403;
    throw err;
  }
  db.prepare('DELETE FROM organizations WHERE id = ?').run(orgId);
  return { ok: true };
}

export function createDepartment({ orgId, actor, name, description = '', headUserId = null, goals = [] }) {
  const mem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  if (!mem || !getOrgPermissions(mem.role).canManageDepartments) {
    const err = new Error('Only Owners and Administrators can manage departments.');
    err.status = 403;
    throw err;
  }
  const cleanName = String(name || '').trim().slice(0, 80);
  if (!cleanName) { const e = new Error('Department name is required.'); e.status = 400; throw e; }
  const id = `dept_${crypto.randomBytes(4).toString('hex')}`;
  db.prepare('INSERT INTO org_departments (id, org_id, name, description, head_user_id, goals_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, orgId, cleanName, String(description || '').slice(0, 300), headUserId ? Number(headUserId) : null, JSON.stringify(Array.isArray(goals) ? goals : []), Date.now());
  return db.prepare('SELECT * FROM org_departments WHERE id = ?').get(id);
}

export function deleteDepartment({ orgId, actor, deptId }) {
  const mem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  if (!mem || !getOrgPermissions(mem.role).canManageDepartments) {
    const err = new Error('Only Owners and Administrators can delete departments.');
    err.status = 403;
    throw err;
  }
  db.prepare('DELETE FROM org_departments WHERE id = ? AND org_id = ?').run(String(deptId), orgId);
  return { ok: true };
}

export function createTeam({ orgId, actor, departmentId = null, name, description = '', leadUserId = null }) {
  const mem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  if (!mem || !getOrgPermissions(mem.role).canManageTeams) {
    const err = new Error('Only Owners, Administrators, and Managers can create teams.');
    err.status = 403;
    throw err;
  }
  const cleanName = String(name || '').trim().slice(0, 80);
  if (!cleanName) { const e = new Error('Team name is required.'); e.status = 400; throw e; }
  const id = `team_${crypto.randomBytes(4).toString('hex')}`;
  db.prepare('INSERT INTO org_teams (id, org_id, department_id, name, description, lead_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, orgId, departmentId || null, cleanName, String(description || '').slice(0, 300), leadUserId ? Number(leadUserId) : null, Date.now());
  return db.prepare('SELECT * FROM org_teams WHERE id = ?').get(id);
}

export function deleteTeam({ orgId, actor, teamId }) {
  const mem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  if (!mem || !getOrgPermissions(mem.role).canManageTeams) {
    const err = new Error('Insufficient permissions to delete team.');
    err.status = 403;
    throw err;
  }
  db.prepare('DELETE FROM org_teams WHERE id = ? AND org_id = ?').run(String(teamId), orgId);
  return { ok: true };
}

export async function createOrgInvitation({ orgId, inviter, email = '', role = 'MEMBER', departmentId = '', teamId = '', inviteType = 'email' }) {
  const mem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, inviter.id);
  if (!mem || !getOrgPermissions(mem.role).canManageUsers) {
    const err = new Error('Only Owners and Administrators can invite users.');
    err.status = 403;
    throw err;
  }
  const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
  const normRole = normalizeOrgRole(role);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const id = `inv_${crypto.randomBytes(4).toString('hex')}`;
  const token = crypto.randomBytes(12).toString('hex');
  const now = Date.now();
  const expiresAt = now + 1000 * 60 * 60 * 24 * 14; // 14 days

  db.prepare(`
    INSERT INTO org_invitations (id, org_id, email, role, department_id, team_id, token, invite_type, invited_by, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, orgId, cleanEmail, normRole, departmentId || '', teamId || '', token, inviteType, inviter.id, now, expiresAt);

  // If the invited email already has a local account, attach membership immediately
  if (cleanEmail) {
    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existingUser) {
      db.prepare(`
        INSERT OR IGNORE INTO org_memberships (id, org_id, user_id, role, department_id, team_id, job_title, skills_json, availability, workload, location, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, '', '{}', 'Available', 40, '', ?)
      `).run(`mem_${crypto.randomBytes(4).toString('hex')}`, orgId, existingUser.id, normRole, departmentId || '', teamId || '', now);
      db.prepare("UPDATE org_invitations SET status = 'accepted' WHERE id = ?").run(id);
    }
    if (org && org.clerk_org_id) {
      await inviteClerkOrganizationMember({
        clerkOrgId: org.clerk_org_id,
        emailAddress: cleanEmail,
        inviterUserId: inviter.clerk_user_id || undefined,
        role: normRole
      });
    }
  }

  return db.prepare('SELECT * FROM org_invitations WHERE id = ?').get(id);
}

export function acceptPendingOrgInvitationsForUser(user) {
  if (!user || !user.email) return 0;
  const email = String(user.email).trim().toLowerCase();
  const pending = db.prepare("SELECT * FROM org_invitations WHERE LOWER(email) = ? AND status = 'pending' AND expires_at > ?").all(email, Date.now());
  let accepted = 0;
  for (const inv of pending) {
    db.prepare(`
      INSERT OR IGNORE INTO org_memberships (id, org_id, user_id, role, department_id, team_id, job_title, skills_json, availability, workload, location, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, '', '{}', 'Available', 40, '', ?)
    `).run(`mem_${crypto.randomBytes(4).toString('hex')}`, inv.org_id, user.id, inv.role, inv.department_id || '', inv.team_id || '', Date.now());
    db.prepare("UPDATE org_invitations SET status = 'accepted' WHERE id = ?").run(inv.id);
    accepted += 1;
  }
  return accepted;
}

export function updateOrgMember({ orgId, actor, targetUserId, patch }) {
  const actorMem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  if (!actorMem) { const e = new Error('Forbidden.'); e.status = 403; throw e; }
  const perms = getOrgPermissions(actorMem.role);
  const isSelf = Number(targetUserId) === Number(actor.id);

  if (!isSelf && !perms.canManageUsers) {
    const e = new Error('Only Owners and Administrators can edit other members.');
    e.status = 403;
    throw e;
  }
  if (patch.role !== undefined && !perms.canManageRoles) {
    const e = new Error('Insufficient permissions to change member roles.');
    e.status = 403;
    throw e;
  }

  const target = db.prepare('SELECT * FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, Number(targetUserId));
  if (!target) { const e = new Error('Member not found in this organisation.'); e.status = 404; throw e; }

  const nextRole = patch.role !== undefined ? normalizeOrgRole(patch.role) : target.role;
  const nextSkills = patch.skills && typeof patch.skills === 'object'
    ? JSON.stringify(patch.skills)
    : target.skills_json;
  const nextWorkload = patch.workload !== undefined ? Math.max(0, Math.min(100, Number(patch.workload) || 0)) : target.workload;

  db.prepare(`
    UPDATE org_memberships
    SET role = ?, department_id = ?, team_id = ?, job_title = ?, skills_json = ?, availability = ?, workload = ?, location = ?
    WHERE org_id = ? AND user_id = ?
  `).run(
    nextRole,
    patch.departmentId !== undefined ? String(patch.departmentId || '') : target.department_id,
    patch.teamId !== undefined ? String(patch.teamId || '') : target.team_id,
    patch.jobTitle !== undefined ? String(patch.jobTitle || '').slice(0, 100) : target.job_title,
    nextSkills,
    patch.availability !== undefined ? String(patch.availability || 'Available').slice(0, 30) : target.availability,
    nextWorkload,
    patch.location !== undefined ? String(patch.location || '').slice(0, 100) : target.location,
    orgId,
    Number(targetUserId)
  );
  return { ok: true };
}

export function removeOrgMember({ orgId, actor, targetUserId }) {
  const actorMem = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, actor.id);
  if (!actorMem || !getOrgPermissions(actorMem.role).canManageUsers) {
    const e = new Error('Only Owners and Administrators can remove members.');
    e.status = 403;
    throw e;
  }
  const target = db.prepare('SELECT role FROM org_memberships WHERE org_id = ? AND user_id = ?').get(orgId, Number(targetUserId));
  if (!target) { const e = new Error('Member not found.'); e.status = 404; throw e; }
  if (target.role === 'OWNER') {
    const e = new Error('Cannot remove the Organisation Owner. Transfer ownership first.');
    e.status = 400;
    throw e;
  }
  db.prepare('DELETE FROM org_memberships WHERE org_id = ? AND user_id = ?').run(orgId, Number(targetUserId));
  return { ok: true };
}

export function addOrgMemoryItem({ orgId, sourceType = 'document', title, summary = '', link = '', authorId = null, tags = [] }) {
  if (!orgId || !title) return null;
  const id = `memk_${crypto.randomBytes(4).toString('hex')}`;
  db.prepare(`
    INSERT INTO org_memory_items (id, org_id, source_type, title, summary, link, author_id, tags_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, String(sourceType), String(title).slice(0, 160), String(summary || '').slice(0, 500), String(link || '').slice(0, 300), authorId || null, JSON.stringify(Array.isArray(tags) ? tags : []), Date.now());
  return id;
}

export function getOrgDirectoryAndAnalytics(orgId) {
  const orgRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
  if (!orgRow) return null;

  const departments = db.prepare('SELECT * FROM org_departments WHERE org_id = ? ORDER BY name ASC').all(orgId).map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    headUserId: d.head_user_id,
    goals: safeJson(d.goals_json, []),
    createdAt: d.created_at
  }));

  const teams = db.prepare('SELECT * FROM org_teams WHERE org_id = ? ORDER BY name ASC').all(orgId).map((t) => ({
    id: t.id,
    departmentId: t.department_id || '',
    name: t.name,
    description: t.description,
    leadUserId: t.lead_user_id,
    createdAt: t.created_at
  }));

  const members = db.prepare(`
    SELECT m.*, u.name, u.email, u.avatar_url, u.bio
    FROM org_memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ?
    ORDER BY m.joined_at ASC
  `).all(orgId).map((m) => ({
    userId: m.user_id,
    name: m.name,
    email: m.email,
    avatarUrl: m.avatar_url || '',
    bio: m.bio || '',
    role: normalizeOrgRole(m.role),
    departmentId: m.department_id || '',
    teamId: m.team_id || '',
    jobTitle: m.job_title || '',
    skills: safeJson(m.skills_json, { technical: [], business: [], research: [], tools: [], certifications: [], interests: [] }),
    availability: m.availability || 'Available',
    workload: Number(m.workload) || 0,
    location: m.location || '',
    joinedAt: m.joined_at
  }));

  const invitations = db.prepare('SELECT * FROM org_invitations WHERE org_id = ? ORDER BY created_at DESC LIMIT 100').all(orgId);

  const memory = db.prepare(`
    SELECT k.*, u.name AS author_name
    FROM org_memory_items k
    LEFT JOIN users u ON u.id = k.author_id
    WHERE k.org_id = ?
    ORDER BY k.created_at DESC
    LIMIT 50
  `).all(orgId).map((k) => ({
    id: k.id,
    sourceType: k.source_type,
    title: k.title,
    summary: k.summary,
    link: k.link,
    authorName: k.author_name || 'System',
    tags: safeJson(k.tags_json, []),
    createdAt: k.created_at
  }));

  const boardCnt = db.prepare('SELECT COUNT(*) AS cnt FROM boards WHERE org_id = ?').get(orgId);
  const actCnt = db.prepare('SELECT COUNT(*) AS cnt FROM activity_logs WHERE org_id = ?').get(orgId);
  const avgWorkload = members.length
    ? Math.round(members.reduce((sum, m) => sum + (m.workload || 0), 0) / members.length)
    : 0;

  return {
    organization: hydrateOrg(orgRow),
    departments,
    teams,
    members,
    invitations,
    memory,
    analytics: {
      totalUsers: members.length,
      totalDepartments: departments.length,
      totalTeams: teams.length,
      totalProjects: Number(boardCnt && boardCnt.cnt) || 0,
      totalMemoryAssets: memory.length,
      totalAuditEvents: Number(actCnt && actCnt.cnt) || 0,
      avgWorkload,
      availableUsers: members.filter((m) => m.availability === 'Available').length
    }
  };
}

export function searchOrgExperts(orgId, query = '') {
  const dir = getOrgDirectoryAndAnalytics(orgId);
  if (!dir) return [];
  const q = String(query || '').trim().toLowerCase();
  const deptMap = Object.fromEntries(dir.departments.map((d) => [d.id, d.name]));
  const teamMap = Object.fromEntries(dir.teams.map((t) => [t.id, t.name]));

  return dir.members
    .map((m) => {
      const sk = m.skills || {};
      const allSkills = []
        .concat(sk.technical || [], sk.business || [], sk.research || [], sk.tools || [], sk.certifications || [], sk.interests || [])
        .map(String);
      const haystack = [m.name, m.jobTitle, m.bio, deptMap[m.departmentId] || '', teamMap[m.teamId] || '', allSkills.join(' ')].join(' ').toLowerCase();
      if (q && !q.split(/\s+/).every((tok) => haystack.includes(tok))) return null;
      return {
        ...m,
        departmentName: deptMap[m.departmentId] || 'Unassigned',
        teamName: teamMap[m.teamId] || 'Unassigned',
        allSkills
      };
    })
    .filter(Boolean);
}
