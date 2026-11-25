import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Entity row shared by every project-planning collection.
 *
 * `entityId` is the client-side id (e.g. TSK-101, res-3, MS-1) and is stable
 * across saves, so re-syncing a plan upserts rows instead of duplicating them.
 * `dataJson` keeps the full original object so nothing is lost if the client
 * adds fields, while the typed columns below make the data queryable from the
 * Convex dashboard and from server-side helpers.
 */
const planningEntity = {
  boardId: v.string(),
  // Owner (session user id). Optional only so pre-isolation rows still validate;
  // convex/migrations.js:claimLegacy backfills them and every function filters on it.
  userId: v.optional(v.string()),
  entityId: v.string(),
  position: v.number(),
  title: v.optional(v.string()),
  status: v.optional(v.string()),
  owner: v.optional(v.string()),
  date: v.optional(v.string()),
  dataJson: v.string(),
  updatedAt: v.number()
};

const planningIndexes = (table) =>
  table
    .index('by_board', ['boardId'])
    .index('by_board_entity', ['boardId', 'entityId'])
    .index('by_user', ['userId']);

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.string(),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    bio: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    externalId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_email', ['email'])
    .index('by_clerk_id', ['clerkId']),

  sessions: defineTable({
    token: v.string(),
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.string(),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number()
  })
    .index('by_token', ['token'])
    .index('by_user', ['userId'])
    .index('by_expires', ['expiresAt']),

  boards: defineTable({
    boardId: v.string(),
    userId: v.optional(v.string()),
    title: v.string(),
    category: v.string(),
    starred: v.boolean(),
    stateVersion: v.optional(v.number()),
    stateJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_board_id', ['boardId'])
    .index('by_user', ['userId'])
    .index('by_updated_at', ['updatedAt']),

  /* ------------------------------------------------------------------ *
   * Project Planning workspace (one row per board, plus one collection
   * per plan section). Mirrors SQLite `project_plans` and the browser
   * plan so the data is queryable in Convex instead of living only in
   * a stateJson blob / localStorage.
   * ------------------------------------------------------------------ */
  projectPlans: defineTable({
    boardId: v.string(),
    userId: v.optional(v.string()),
    projectName: v.string(),
    projectCode: v.optional(v.string()),
    activeSprint: v.optional(v.string()),
    baseBudget: v.optional(v.number()),
    currency: v.optional(v.string()),
    owner: v.optional(v.string()),
    status: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    stateVersion: v.optional(v.number()),
    // Authoritative full snapshot, so a client with a cold cache can restore
    // the exact plan (including UI state) in one read.
    snapshotJson: v.string(),
    taskCount: v.number(),
    milestoneCount: v.number(),
    resourceCount: v.number(),
    updatedAt: v.number()
  })
    .index('by_board_id', ['boardId'])
    .index('by_user', ['userId'])
    .index('by_updated_at', ['updatedAt']),

  projectPhases: planningIndexes(defineTable(planningEntity)),
  projectTasks: planningIndexes(defineTable(planningEntity)),
  projectMilestones: planningIndexes(defineTable(planningEntity)),
  projectResources: planningIndexes(defineTable(planningEntity)),
  projectTimesheets: planningIndexes(defineTable(planningEntity)),
  projectWikiPages: planningIndexes(defineTable(planningEntity)),
  projectFiles: planningIndexes(defineTable(planningEntity)),
  projectRaidItems: planningIndexes(defineTable(planningEntity)),
  projectChangeRequests: planningIndexes(defineTable(planningEntity)),

  /* ------------------------------------------------------------------ *
   * Files Manager, 3D Manila Folders, Custom Ordering & Preferences
   * ------------------------------------------------------------------ */
  userFolders: defineTable({
    folderId: v.string(),
    userId: v.string(),
    name: v.string(),
    parentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_folder', ['userId', 'folderId'])
    .index('by_user_parent', ['userId', 'parentId']),

  userFiles: defineTable({
    fileId: v.string(),
    userId: v.string(),
    folderId: v.optional(v.string()),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    extension: v.string(),
    url: v.string(),
    publicId: v.optional(v.string()),
    resourceType: v.optional(v.string()),
    visibility: v.string(),
    uploadedBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_file', ['userId', 'fileId'])
    .index('by_user_folder', ['userId', 'folderId']),

  userFileOrders: defineTable({
    userId: v.string(),
    folderId: v.string(),
    orderJson: v.string(),
    updatedAt: v.number()
  })
    .index('by_user_folder', ['userId', 'folderId']),

  userPreferences: defineTable({
    userId: v.string(),
    filesViewMode: v.string(),
    filesSortBy: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  /* ================================================================== *
   * Quotations (header document + individual line items)
   * ================================================================== */
  quotations: defineTable({
    userId: v.string(),
    quotationNumber: v.string(),
    companyName: v.string(),
    tagline: v.optional(v.string()),
    companyAddress1: v.optional(v.string()),
    companyAddress2: v.optional(v.string()),
    companyPhone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.string()),
    date: v.string(),
    customerId: v.optional(v.string()),
    validUntil: v.optional(v.string()),
    preparedBy: v.optional(v.string()),
    toName: v.optional(v.string()),
    toOrg: v.optional(v.string()),
    toAddr1: v.optional(v.string()),
    toAddr2: v.optional(v.string()),
    toPhone: v.optional(v.string()),
    comments: v.optional(v.string()),
    salesperson: v.optional(v.string()),
    poNumber: v.optional(v.string()),
    shipDate: v.optional(v.string()),
    shipVia: v.optional(v.string()),
    fob: v.optional(v.string()),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    footer: v.optional(v.string()),
    taxRate: v.number(),
    other: v.number(),
    subtotal: v.number(),
    salesTax: v.number(),
    total: v.number(),
    itemCount: v.number(),
    dataJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_qno', ['userId', 'quotationNumber']),

  quotationItems: defineTable({
    userId: v.string(),
    quotationNumber: v.string(),
    lineIndex: v.number(),
    quantity: v.number(),
    description: v.string(),
    unitPrice: v.number(),
    taxable: v.boolean(),
    amount: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_qno', ['userId', 'quotationNumber']),

  /* ================================================================== *
   * Invoices (header document + individual line items)
   * ================================================================== */
  invoices: defineTable({
    userId: v.string(),
    invoiceNumber: v.string(),
    companyName: v.string(),
    tagline: v.optional(v.string()),
    companyAddress1: v.optional(v.string()),
    companyAddress2: v.optional(v.string()),
    companyPhone: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    logoStorageId: v.optional(v.string()),
    date: v.string(),
    customerId: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    preparedBy: v.optional(v.string()),
    toName: v.optional(v.string()),
    toOrg: v.optional(v.string()),
    toAddr1: v.optional(v.string()),
    toAddr2: v.optional(v.string()),
    toPhone: v.optional(v.string()),
    comments: v.optional(v.string()),
    salesperson: v.optional(v.string()),
    poNumber: v.optional(v.string()),
    shipDate: v.optional(v.string()),
    shipVia: v.optional(v.string()),
    fob: v.optional(v.string()),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    footer: v.optional(v.string()),
    taxRate: v.number(),
    other: v.number(),
    subtotal: v.number(),
    salesTax: v.number(),
    total: v.number(),
    itemCount: v.number(),
    dataJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_ino', ['userId', 'invoiceNumber']),

  invoiceItems: defineTable({
    userId: v.string(),
    invoiceNumber: v.string(),
    lineIndex: v.number(),
    quantity: v.number(),
    description: v.string(),
    unitPrice: v.number(),
    taxable: v.boolean(),
    amount: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_ino', ['userId', 'invoiceNumber']),

  /* ================================================================== *
   * Note Pad (typed & drawn notes per user)
   * ================================================================== */
  userNotepads: defineTable({
    userId: v.string(),
    notesJson: v.string(),
    noteCount: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  /* ================================================================== *
   * Leaf Workspace (collaborative docs, spaces & pages per user)
   * ================================================================== */
  leafWorkspaces: defineTable({
    userId: v.string(),
    spacesJson: v.string(),
    pagesJson: v.string(),
    curPageId: v.optional(v.string()),
    curSpaceId: v.optional(v.string()),
    uid: v.optional(v.number()),
    cid: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  /* ================================================================== *
   * Knowledge Hub & Organisational OS Workspaces
   * ================================================================== */
  knowledgeHubs: defineTable({
    userId: v.string(),
    stateJson: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  osWorkspaces: defineTable({
    userId: v.string(),
    stateJson: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  /* ================================================================== *
   * CRM Workspace (snapshot + normalized queryable entity tables)
   * ================================================================== */
  crmWorkspaces: defineTable({
    userId: v.string(),
    dataJson: v.string(),
    contactCount: v.optional(v.number()),
    dealCount: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  crmContacts: defineTable({
    userId: v.string(),
    contactId: v.string(),
    name: v.string(),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    source: v.optional(v.string()),
    status: v.string(),
    score: v.number(),
    owner: v.optional(v.string()),
    tags: v.array(v.string()),
    note: v.optional(v.string()),
    created: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_contact', ['userId', 'contactId']),

  crmDeals: defineTable({
    userId: v.string(),
    dealId: v.string(),
    contactId: v.string(),
    title: v.string(),
    value: v.number(),
    stage: v.string(),
    created: v.string(),
    closed: v.optional(v.string()),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_stage', ['userId', 'stage'])
    .index('by_user_deal', ['userId', 'dealId']),

  crmMessages: defineTable({
    userId: v.string(),
    messageId: v.string(),
    contactId: v.string(),
    channel: v.string(),
    dir: v.string(),
    text: v.string(),
    at: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_contact', ['userId', 'contactId']),

  crmAppointments: defineTable({
    userId: v.string(),
    apptId: v.string(),
    contactId: v.string(),
    title: v.string(),
    date: v.string(),
    time: v.string(),
    duration: v.number(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_date', ['userId', 'date']),

  crmTasks: defineTable({
    userId: v.string(),
    taskId: v.string(),
    contactId: v.string(),
    text: v.string(),
    due: v.string(),
    done: v.boolean(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId'])
    .index('by_user_done', ['userId', 'done']),

  crmWorkflows: defineTable({
    userId: v.string(),
    workflowId: v.string(),
    name: v.string(),
    active: v.boolean(),
    runs: v.number(),
    triggerJson: v.string(),
    stepsJson: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  crmCampaigns: defineTable({
    userId: v.string(),
    campaignId: v.string(),
    name: v.string(),
    channel: v.string(),
    tag: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.string(),
    status: v.string(),
    sent: v.number(),
    opened: v.number(),
    clicked: v.number(),
    at: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  crmActivity: defineTable({
    userId: v.string(),
    position: v.number(),
    text: v.string(),
    at: v.string(),
    updatedAt: v.number()
  })
    .index('by_user', ['userId']),

  /* ================================================================== *
   * Marketing / Enterprise Contact Leads
   * ================================================================== */
  contactLeads: defineTable({
    source: v.union(v.literal('hero'), v.literal('enterprise_contact')),
    email: v.string(),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    teamSize: v.optional(v.string()),
    message: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_email', ['email'])
});
