import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

const toStr = (val, fallback = '') => (val === undefined || val === null ? fallback : String(val));
const toNum = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

/** Replace all rows for `userId` in a normalized CRM table. */
async function replaceUserTable(ctx, table, userId, docs) {
  const existing = await ctx.db
    .query(table)
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  for (const doc of docs) {
    await ctx.db.insert(table, doc);
  }
  return docs.length;
}

/** Retrieve the authenticated user's full CRM workspace from normalized tables (with snapshot fallback). */
export const getWorkspace = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const meta = await ctx.db
      .query('crmWorkspaces')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    const [contacts, deals, messages, appts, tasks, workflows, campaigns, activity] = await Promise.all([
      ctx.db.query('crmContacts').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('crmDeals').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('crmMessages').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('crmAppointments').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('crmTasks').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('crmWorkflows').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('crmCampaigns').withIndex('by_user', (q) => q.eq('userId', userId)).collect(),
      ctx.db.query('crmActivity').withIndex('by_user', (q) => q.eq('userId', userId)).collect()
    ]);

    const hasNormalized =
      contacts.length || deals.length || messages.length || appts.length ||
      tasks.length || workflows.length || campaigns.length || activity.length;

    if (!meta && !hasNormalized) return null;

    if (hasNormalized) {
      const notes = {};
      const mappedContacts = contacts.map((c) => {
        if (c.note) notes[c.contactId] = c.note;
        return {
          id: c.contactId,
          name: c.name,
          company: c.company || '',
          email: c.email || '',
          phone: c.phone || '',
          source: c.source || 'Website',
          status: c.status,
          score: c.score,
          owner: c.owner || 'Owner',
          tags: Array.isArray(c.tags) ? c.tags : [],
          created: c.created
        };
      });
      const assembled = {
        contacts: mappedContacts,
        deals: deals.map((d) => ({
          id: d.dealId, contactId: d.contactId, title: d.title, value: d.value,
          stage: d.stage, created: d.created, closed: d.closed || null
        })),
        messages: messages.map((m) => ({
          id: m.messageId, contactId: m.contactId, channel: m.channel,
          dir: m.dir, text: m.text, at: m.at
        })),
        appts: appts.map((a) => ({
          id: a.apptId, contactId: a.contactId, title: a.title,
          date: a.date, time: a.time, duration: a.duration
        })),
        tasks: tasks.map((t) => ({
          id: t.taskId, contactId: t.contactId, text: t.text, due: t.due, done: Boolean(t.done)
        })),
        workflows: workflows.map((w) => ({
          id: w.workflowId, name: w.name, active: Boolean(w.active), runs: w.runs,
          trigger: (() => { try { return JSON.parse(w.triggerJson); } catch { return { type: 'contact_created' }; } })(),
          steps: (() => { try { return JSON.parse(w.stepsJson); } catch { return []; } })()
        })),
        campaigns: campaigns.map((c) => ({
          id: c.campaignId, name: c.name, channel: c.channel, tag: c.tag || '',
          subject: c.subject || '', body: c.body, status: c.status,
          sent: c.sent, opened: c.opened, clicked: c.clicked, at: c.at
        })),
        activity: activity
          .sort((a, b) => a.position - b.position)
          .map((a) => ({ text: a.text, at: a.at })),
        notes
      };
      return {
        dataJson: JSON.stringify(assembled),
        updatedAt: meta ? meta.updatedAt : Date.now()
      };
    }

    return {
      dataJson: meta.dataJson,
      updatedAt: meta.updatedAt
    };
  }
});

/** Upsert the authenticated user's CRM workspace AND sync all 8 normalized Convex tables. */
export const saveWorkspace = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    dataJson: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const now = args.updatedAt || Date.now();

    let data = {};
    try {
      data = JSON.parse(args.dataJson || '{}') || {};
    } catch {
      data = {};
    }

    const notesMap = (data.notes && typeof data.notes === 'object') ? data.notes : {};
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    const deals = Array.isArray(data.deals) ? data.deals : [];
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const appts = Array.isArray(data.appts) ? data.appts : [];
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const workflows = Array.isArray(data.workflows) ? data.workflows : [];
    const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
    const activity = Array.isArray(data.activity) ? data.activity.slice(0, 60) : [];

    // Sync all 8 normalized tables
    await replaceUserTable(ctx, 'crmContacts', userId, contacts.map((c, idx) => ({
      userId,
      contactId: toStr(c.id, `c-${idx}`),
      name: toStr(c.name, 'Unnamed'),
      company: toStr(c.company) || undefined,
      email: toStr(c.email) || undefined,
      phone: toStr(c.phone) || undefined,
      source: toStr(c.source) || undefined,
      status: toStr(c.status, 'Lead'),
      score: toNum(c.score, 0),
      owner: toStr(c.owner) || undefined,
      tags: Array.isArray(c.tags) ? c.tags.map((t) => String(t)) : [],
      note: notesMap[c.id] ? String(notesMap[c.id]) : undefined,
      created: toStr(c.created, new Date(now).toISOString()),
      updatedAt: now
    })));

    await replaceUserTable(ctx, 'crmDeals', userId, deals.map((d, idx) => ({
      userId,
      dealId: toStr(d.id, `d-${idx}`),
      contactId: toStr(d.contactId),
      title: toStr(d.title, 'Untitled Deal'),
      value: toNum(d.value, 0),
      stage: toStr(d.stage, 'New Lead'),
      created: toStr(d.created, new Date(now).toISOString()),
      closed: d.closed ? String(d.closed) : undefined,
      updatedAt: now
    })));

    await replaceUserTable(ctx, 'crmMessages', userId, messages.map((m, idx) => ({
      userId,
      messageId: toStr(m.id, `m-${idx}`),
      contactId: toStr(m.contactId),
      channel: toStr(m.channel, 'SMS'),
      dir: toStr(m.dir, 'out'),
      text: toStr(m.text),
      at: toStr(m.at, new Date(now).toISOString()),
      updatedAt: now
    })));

    await replaceUserTable(ctx, 'crmAppointments', userId, appts.map((a, idx) => ({
      userId,
      apptId: toStr(a.id, `a-${idx}`),
      contactId: toStr(a.contactId),
      title: toStr(a.title, 'Meeting'),
      date: toStr(a.date),
      time: toStr(a.time, '10:00'),
      duration: toNum(a.duration, 30),
      updatedAt: now
    })));

    await replaceUserTable(ctx, 'crmTasks', userId, tasks.map((t, idx) => ({
      userId,
      taskId: toStr(t.id, `t-${idx}`),
      contactId: toStr(t.contactId),
      text: toStr(t.text),
      due: toStr(t.due),
      done: Boolean(t.done),
      updatedAt: now
    })));

    await replaceUserTable(ctx, 'crmWorkflows', userId, workflows.map((w, idx) => ({
      userId,
      workflowId: toStr(w.id, `w-${idx}`),
      name: toStr(w.name, 'Workflow'),
      active: Boolean(w.active),
      runs: toNum(w.runs, 0),
      triggerJson: JSON.stringify(w.trigger || { type: 'contact_created' }),
      stepsJson: JSON.stringify(Array.isArray(w.steps) ? w.steps : []),
      updatedAt: now
    })));

    await replaceUserTable(ctx, 'crmCampaigns', userId, campaigns.map((c, idx) => ({
      userId,
      campaignId: toStr(c.id, `camp-${idx}`),
      name: toStr(c.name, 'Campaign'),
      channel: toStr(c.channel, 'Email'),
      tag: toStr(c.tag) || undefined,
      subject: toStr(c.subject) || undefined,
      body: toStr(c.body),
      status: toStr(c.status, 'Draft'),
      sent: toNum(c.sent, 0),
      opened: toNum(c.opened, 0),
      clicked: toNum(c.clicked, 0),
      at: toStr(c.at, new Date(now).toISOString()),
      updatedAt: now
    })));

    await replaceUserTable(ctx, 'crmActivity', userId, activity.map((a, idx) => ({
      userId,
      position: idx,
      text: toStr(a.text),
      at: toStr(a.at, new Date(now).toISOString()),
      updatedAt: now
    })));

    // Upsert summary snapshot row
    const existing = await ctx.db
      .query('crmWorkspaces')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();

    const doc = {
      userId,
      dataJson: args.dataJson,
      contactCount: contacts.length,
      dealCount: deals.length,
      updatedAt: now
    };
    const id = existing
      ? (await ctx.db.patch(existing._id, doc), existing._id)
      : await ctx.db.insert('crmWorkspaces', doc);

    return {
      id,
      contactCount: contacts.length,
      dealCount: deals.length,
      updatedAt: now
    };
  }
});

/** Direct query helpers for normalized CRM tables. */
export const listContacts = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    return await ctx.db
      .query('crmContacts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  }
});

export const listDeals = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    return await ctx.db
      .query('crmDeals')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
  }
});
