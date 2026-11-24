import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toStr(v, fallback = '') {
  return v === undefined || v === null ? fallback : String(v);
}

/**
 * Retrieve the latest quotation for the authenticated user.
 */
export const getQuotation = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const docs = await ctx.db
      .query('quotations')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    if (!docs.length) return null;
    docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const latest = docs[0];

    const items = await ctx.db
      .query('quotationItems')
      .withIndex('by_user_qno', (q) =>
        q.eq('userId', userId).eq('quotationNumber', latest.quotationNumber)
      )
      .collect();
    items.sort((a, b) => a.lineIndex - b.lineIndex);

    return {
      ...latest,
      items
    };
  }
});

/**
 * List all quotations for the authenticated user.
 */
export const listQuotations = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const docs = await ctx.db
      .query('quotations')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return docs;
  }
});

/**
 * Upsert a quotation document and synchronize its line items into quotationItems.
 */
export const upsertQuotation = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    quotationJson: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    let qData = {};
    try {
      qData = JSON.parse(args.quotationJson || '{}') || {};
    } catch {
      qData = {};
    }

    const qno = toStr(qData.qno || '000001').trim() || '000001';
    const rawItems = Array.isArray(qData.items) ? qData.items : [];

    let subtotal = 0;
    let taxableSum = 0;
    const activeItems = [];

    rawItems.forEach((it, idx) => {
      if (!it || typeof it !== 'object') return;
      const qty = toNum(it.q !== undefined ? it.q : it.qty);
      const price = toNum(it.p !== undefined ? it.p : it.rate);
      const desc = toStr(it.d !== undefined ? it.d : it.description).trim();
      const taxable = it.t === 'T' || it.taxable === true;
      const amount = Math.round(qty * price * 100) / 100;

      subtotal += amount;
      if (taxable) taxableSum += amount;

      if (qty > 0 || price > 0 || desc.length > 0) {
        activeItems.push({
          lineIndex: idx + 1,
          quantity: qty,
          description: desc || 'Line Item',
          unitPrice: price,
          taxable,
          amount
        });
      }
    });

    const taxRate = toNum(qData.rate !== undefined ? qData.rate : qData.taxRate);
    const other = toNum(qData.other);
    const salesTax = Math.round((taxRate / 100) * taxableSum * 100) / 100;
    subtotal = Math.round(subtotal * 100) / 100;
    const total = Math.round((subtotal + salesTax + other) * 100) / 100;

    const existing = await ctx.db
      .query('quotations')
      .withIndex('by_user_qno', (q) => q.eq('userId', userId).eq('quotationNumber', qno))
      .first();

    const now = args.updatedAt || Date.now();
    const doc = {
      userId,
      quotationNumber: qno,
      companyName: toStr(qData.coName, 'Quantals Solution'),
      tagline: toStr(qData.tagline) || undefined,
      companyAddress1: toStr(qData.coAddr1) || undefined,
      companyAddress2: toStr(qData.coAddr2) || undefined,
      companyPhone: toStr(qData.coPhone) || undefined,
      logoUrl: toStr(qData.logoUrl) || undefined,
      logoStorageId: toStr(qData.logoStorageId) || undefined,
      date: toStr(qData.date, new Date().toISOString().slice(0, 10)),
      customerId: toStr(qData.cid) || undefined,
      validUntil: toStr(qData.valid) || undefined,
      preparedBy: toStr(qData.prep) || undefined,
      toName: toStr(qData.toName || qData.clientName) || undefined,
      toOrg: toStr(qData.toOrg) || undefined,
      toAddr1: toStr(qData.toAddr1) || undefined,
      toAddr2: toStr(qData.toAddr2) || undefined,
      toPhone: toStr(qData.toPhone) || undefined,
      comments: toStr(qData.comments) || undefined,
      salesperson: toStr(qData.sales) || undefined,
      poNumber: toStr(qData.po) || undefined,
      shipDate: toStr(qData.shipDate) || undefined,
      shipVia: toStr(qData.shipVia) || undefined,
      fob: toStr(qData.fob) || undefined,
      terms: toStr(qData.terms) || undefined,
      notes: toStr(qData.notes) || undefined,
      footer: toStr(qData.footer) || undefined,
      taxRate,
      other,
      subtotal,
      salesTax,
      total,
      itemCount: activeItems.length,
      dataJson: args.quotationJson,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    let quotationId;
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      quotationId = existing._id;
    } else {
      quotationId = await ctx.db.insert('quotations', doc);
    }

    // Replace existing line items for this quotation in quotationItems
    const oldItems = await ctx.db
      .query('quotationItems')
      .withIndex('by_user_qno', (q) => q.eq('userId', userId).eq('quotationNumber', qno))
      .collect();
    for (const old of oldItems) {
      await ctx.db.delete(old._id);
    }

    for (const item of activeItems) {
      await ctx.db.insert('quotationItems', {
        userId,
        quotationNumber: qno,
        lineIndex: item.lineIndex,
        quantity: item.quantity,
        description: item.description,
        unitPrice: item.unitPrice,
        taxable: item.taxable,
        amount: item.amount,
        updatedAt: now
      });
    }

    return {
      quotationId,
      quotationNumber: qno,
      itemCount: activeItems.length,
      total,
      updatedAt: now
    };
  }
});
