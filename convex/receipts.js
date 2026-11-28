import { mutation, query } from './_generated/server.js';
import { v } from 'convex/values';
import { requireUser } from './authHelpers';

function toNum(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function toStr(val, fallback = '') {
  return val === undefined || val === null ? fallback : String(val);
}

/**
 * Retrieve the latest receipt for the authenticated user.
 */
export const getReceipt = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const docs = await ctx.db
      .query('receipts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    if (!docs.length) return null;
    docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const latest = docs[0];

    const items = await ctx.db
      .query('receiptItems')
      .withIndex('by_user_rno', (q) =>
        q.eq('userId', userId).eq('receiptNumber', latest.receiptNumber)
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
 * List all receipts for the authenticated user.
 */
export const listReceipts = query({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    const docs = await ctx.db
      .query('receipts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return docs;
  }
});

/**
 * Upsert a receipt document and synchronize its line items into receiptItems.
 */
export const upsertReceipt = mutation({
  args: {
    secret: v.string(),
    userId: v.string(),
    receiptJson: v.string(),
    updatedAt: v.number()
  },
  handler: async (ctx, args) => {
    const userId = requireUser(args);
    let rData = {};
    try {
      rData = JSON.parse(args.receiptJson || '{}') || {};
    } catch {
      rData = {};
    }

    const rno = toStr(rData.qno || rData.rno || 'RCP-001').trim() || 'RCP-001';
    const rawItems = Array.isArray(rData.items) ? rData.items : [];

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

    const taxRate = toNum(rData.rate !== undefined ? rData.rate : rData.taxRate);
    const other = toNum(rData.other);
    const salesTax = Math.round((taxRate / 100) * taxableSum * 100) / 100;
    subtotal = Math.round(subtotal * 100) / 100;
    const total = Math.round((subtotal + salesTax + other) * 100) / 100;

    const existing = await ctx.db
      .query('receipts')
      .withIndex('by_user_rno', (q) => q.eq('userId', userId).eq('receiptNumber', rno))
      .first();

    const now = args.updatedAt || Date.now();
    const doc = {
      userId,
      receiptNumber: rno,
      companyName: toStr(rData.coName, 'Data Quantals Solutions'),
      tagline: toStr(rData.tagline) || undefined,
      companyAddress1: toStr(rData.coAddr1) || undefined,
      companyAddress2: toStr(rData.coAddr2) || undefined,
      companyPhone: toStr(rData.coPhone) || undefined,
      logoUrl: toStr(rData.logoUrl) || undefined,
      logoStorageId: toStr(rData.logoStorageId) || undefined,
      date: toStr(rData.date, new Date().toISOString().slice(0, 10)),
      customerId: toStr(rData.cid) || undefined,
      validUntil: toStr(rData.valid) || undefined,
      preparedBy: toStr(rData.prep) || undefined,
      toName: toStr(rData.toName || rData.clientName) || undefined,
      toOrg: toStr(rData.toOrg) || undefined,
      toAddr1: toStr(rData.toAddr1) || undefined,
      toAddr2: toStr(rData.toAddr2) || undefined,
      toPhone: toStr(rData.toPhone) || undefined,
      comments: toStr(rData.comments) || undefined,
      salesperson: toStr(rData.sales) || undefined,
      poNumber: toStr(rData.po) || undefined,
      shipDate: toStr(rData.shipDate) || undefined,
      shipVia: toStr(rData.shipVia) || undefined,
      fob: toStr(rData.fob) || undefined,
      terms: toStr(rData.terms) || undefined,
      notes: toStr(rData.notes) || undefined,
      footer: toStr(rData.footer) || undefined,
      taxRate,
      other,
      subtotal,
      salesTax,
      total,
      itemCount: activeItems.length,
      dataJson: args.receiptJson,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    let receiptId;
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      receiptId = existing._id;
    } else {
      receiptId = await ctx.db.insert('receipts', doc);
    }

    const oldItems = await ctx.db
      .query('receiptItems')
      .withIndex('by_user_rno', (q) => q.eq('userId', userId).eq('receiptNumber', rno))
      .collect();
    for (const old of oldItems) {
      await ctx.db.delete(old._id);
    }

    for (const item of activeItems) {
      await ctx.db.insert('receiptItems', {
        userId,
        receiptNumber: rno,
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
      receiptId,
      receiptNumber: rno,
      itemCount: activeItems.length,
      total,
      updatedAt: now
    };
  }
});
