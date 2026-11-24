'use client';

import { useSyncExternalStore } from 'react';
import type {
  FloorSnapshot, FloorTaskId, PayloadByTask, Proposal, ProposalOf, Receipt, Role, SnapStockRow, Surface, UndoSpec,
} from '../types';
import { endOfTradingDay, fmtQty, itemPhrase, wasteDayPhrase } from '../format';
import { addChatBasketLine, removeChatBasketLine } from '@/app/assisted-ordering/basket/chatBasketStore';
import { WASTE_REASON_NAMES } from '../constants';
import { seedWorld } from './seed';
import type { WorldState } from './worldTypes';

/**
 * The prototype's stand-in for Edify Main's database, for the tasks Edify
 * can do from Command Centre. Module-level so the chat, the Waiting for
 * you tray and the test page all see the same site.
 */

let state: WorldState | null = null;
const listeners = new Set<() => void>();

function world(): WorldState {
  if (!state) state = seedWorld(new Date());
  return state;
}

function commit(next: WorldState) {
  state = next;
  for (const l of listeners) l();
}

export function subscribeWorld(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getWorld(): WorldState {
  return world();
}

export function useWorld(): WorldState {
  return useSyncExternalStore(subscribeWorld, getWorld, getWorld);
}

export function resetWorld() {
  commit(seedWorld(new Date()));
}

export function setRole(role: Role) {
  commit({ ...world(), role });
}

export function setSurface(surface: Surface) {
  commit({ ...world(), surface });
}

export function setStocktakeInProgress(on: boolean) {
  commit({ ...world(), stocktakeInProgress: on });
}

export function setReferenceRequired(on: boolean) {
  const w = world();
  commit({ ...w, deliveries: w.deliveries.map((d) => ({ ...d, requiresReference: on })) });
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function siteName(w: WorldState, id: string) {
  return w.sites.find((s) => s.id === id)?.name ?? id;
}

function siteStock(w: WorldState, siteId = w.siteId): SnapStockRow[] {
  return w.stock[siteId] ?? [];
}

function withStock(w: WorldState, siteId: string, fn: (rows: SnapStockRow[]) => SnapStockRow[]): WorldState {
  return { ...w, stock: { ...w.stock, [siteId]: fn(siteStock(w, siteId)) } };
}

function adjustStock(w: WorldState, siteId: string, itemId: string, delta: number): WorldState {
  return withStock(w, siteId, (rows) =>
    rows.map((r) => (r.id === itemId ? { ...r, onHand: Math.round((r.onHand + delta) * 1000) / 1000 } : r)),
  );
}

function setStock(w: WorldState, itemId: string, patch: Partial<SnapStockRow>): WorldState {
  return withStock(w, w.siteId, (rows) => rows.map((r) => (r.id === itemId ? { ...r, ...patch } : r)));
}

function stockOf(w: WorldState, itemId: string): SnapStockRow | undefined {
  return siteStock(w).find((r) => r.id === itemId);
}

// ─── Snapshot ──────────────────────────────────────────────────────────────

export function buildSnapshot(w: WorldState = world()): FloorSnapshot {
  const now = new Date();
  return {
    today: w.today,
    nowIso: now.toISOString(),
    nowLabel: now.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    site: { id: w.siteId, name: siteName(w, w.siteId) },
    role: w.role,
    surface: w.surface,
    sites: w.sites,
    stock: siteStock(w),
    wasteReasons: [...WASTE_REASON_NAMES],
    countLists: w.countLists.map((l) => ({
      ...l,
      openCountId: w.quickCounts.find((q) => q.countListId === l.id && q.status === 'open')?.id,
    })),
    stocktakeInProgress: w.stocktakeInProgress,
    hot: w.hot,
    bench: w.bench,
    checklists: w.checklists
      .filter((c) => c.status !== 'complete')
      .map((c) => ({
        instanceId: c.instanceId,
        name: c.name,
        status: c.status,
        due: c.due,
        questions: c.questions.map((q) => ({ ...q, answer: c.answers[q.id] ?? null })),
      })),
    basket: w.basket,
    deliveries: w.deliveries
      .filter((d) => d.status !== 'received')
      .map((d) => ({
        id: d.id,
        poNumber: d.poNumber,
        supplierName: d.supplierName,
        due: d.due,
        dueLabel: d.dueLabel,
        requiresReference: d.requiresReference,
        lines: d.lines.map((l) => ({ id: l.id, name: l.name, unit: l.unit, price: l.price, ordered: l.ordered, status: l.status })),
      })),
    transfers: w.transfers
      .filter((t) => t.status === 'pending' && (t.toSiteId === w.siteId || t.fromSiteId === w.siteId))
      .map((t) => ({
        id: t.id,
        number: t.number,
        fromSiteId: t.fromSiteId,
        fromSiteName: t.fromSiteName,
        toSiteId: t.toSiteId,
        toSiteName: t.toSiteName,
        sentAt: t.sentAt,
        status: t.status,
        lines: t.lines.map((l) => ({ id: l.id, itemName: l.itemName, qty: l.qty, unit: l.unit })),
      })),
    recipes: w.recipes,
    recentReceipts: w.receipts
      .filter((r) => !r.undone && r.taskId !== 'undo')
      .slice(-6)
      .map((r) => ({ id: r.id, taskId: r.taskId, headline: r.headline, undo: r.undo })),
  };
}

// ─── Proposals ─────────────────────────────────────────────────────────────

/** Stage what the server sent. Show-it tasks raised on a headset go
 *  straight to Waiting for you. */
export function addProposals(proposals: Proposal[], waitingIds: string[] = []) {
  if (!proposals.length) return;
  const w = world();
  const expiresAt = endOfTradingDay(new Date());
  const added = proposals.map(
    (p) => ({ ...p, expiresAt, status: waitingIds.includes(p.id) ? 'waiting' : 'staged' }) as Proposal,
  );
  commit({ ...w, proposals: [...w.proposals.filter((p) => !added.some((a) => a.id === p.id)), ...added] });
}

export function getProposal(id: string): Proposal | undefined {
  return world().proposals.find((p) => p.id === id);
}

export function useProposal(id: string | undefined): Proposal | undefined {
  const w = useWorld();
  return id ? w.proposals.find((p) => p.id === id) : undefined;
}

export function waitingProposals(w: WorldState = world()): Proposal[] {
  return w.proposals.filter((p) => p.status === 'waiting');
}

export function sendToWaiting(id: string) {
  setProposalStatus(id, 'waiting');
}

export function declineProposal(id: string) {
  setProposalStatus(id, 'declined');
}

function setProposalStatus(id: string, status: Proposal['status']) {
  const w = world();
  commit({ ...w, proposals: w.proposals.map((p) => (p.id === id ? ({ ...p, status } as Proposal) : p)) });
}

/** Waiting items last until the end of the trading day. */
export function expireWaiting(now = new Date()) {
  const w = world();
  if (!w.proposals.some((p) => p.status === 'waiting' && new Date(p.expiresAt) < now)) return;
  commit({
    ...w,
    proposals: w.proposals.map((p) =>
      p.status === 'waiting' && new Date(p.expiresAt) < now ? ({ ...p, status: 'expired' } as Proposal) : p,
    ),
  });
}

export function updateProposalPayload<K extends FloorTaskId>(id: string, payload: PayloadByTask[K]) {
  const w = world();
  commit({ ...w, proposals: w.proposals.map((p) => (p.id === id ? ({ ...p, payload } as Proposal) : p)) });
}

export type ApplyResult = { ok: true; receipt: Receipt } | { ok: false; error: string };

/** The yes. Writes the proposal and returns what changed. */
export function confirmProposal(id: string): ApplyResult {
  const w = world();
  const p = w.proposals.find((x) => x.id === id);
  if (!p) return { ok: false, error: 'That one has gone. Nothing has changed.' };
  if (p.status === 'applied') return { ok: false, error: 'That\'s already done.' };
  if (p.status === 'expired') return { ok: false, error: 'That one expired at close. Nothing has changed. Say it again to start over.' };
  const result = apply(w, p);
  if ('error' in result) return { ok: false, error: result.error };
  const receipt = { ...result.receipt, id: uid('rc'), proposalId: p.id, taskId: p.taskId, createdAt: new Date().toISOString() };
  commit({
    ...result.world,
    proposals: result.world.proposals.map((x) => (x.id === id ? ({ ...x, status: 'applied' } as Proposal) : x)),
    receipts: [...result.world.receipts, receipt],
  });
  return { ok: true, receipt };
}

export function receiptFor(proposalId: string): Receipt | undefined {
  return world().receipts.find((r) => r.proposalId === proposalId);
}

// ─── Applying each task ────────────────────────────────────────────────────

type Applied = {
  world: WorldState;
  receipt: Omit<Receipt, 'id' | 'proposalId' | 'taskId' | 'createdAt'> & { revert?: Proposal };
};

function revertOf<K extends FloorTaskId>(p: Proposal, taskId: K, payload: PayloadByTask[K], label: string, readback: string): Proposal {
  return {
    ...p,
    id: uid('pr'),
    taskId,
    payload,
    label,
    readback,
    warnings: [],
    status: 'staged',
  } as Proposal;
}

function apply(w: WorldState, p: Proposal): Applied | { error: string } {
  switch (p.taskId) {
    case 'waste':
      return applyWaste(w, p);
    case 'on-hand':
      return applyOnHand(w, p);
    case 'hot-add':
      return applyHotAdd(w, p);
    case 'production-step':
      return applyProductionStep(w, p);
    case 'par-level':
      return applyPar(w, p);
    case 'transfer-request':
      return applyTransferRequest(w, p);
    case 'quick-count-start':
      return applyQuickCountStart(w, p);
    case 'checklist-answer':
      return applyChecklist(w, p);
    case 'basket-add':
      return applyBasketAdd(w, p);
    case 'delivery-accept':
      return applyDelivery(w, p);
    case 'transfer-send':
      return applyTransferSend(w, p);
    case 'transfer-accept':
      return applyTransferAccept(w, p);
    case 'demand-adjustment':
      return applyDemand(w, p);
    case 'undo':
      return applyUndo(w, p);
  }
}

function applyWaste(w: WorldState, p: ProposalOf<'waste'>): Applied {
  let next = w;
  const entries = p.payload.lines.map((l) => ({
    ...l,
    id: uid('wl'),
    proposalId: p.id,
    wasteDate: p.payload.wasteDate,
    recordedAt: new Date().toISOString(),
  }));
  for (const l of p.payload.lines) next = adjustStock(next, w.siteId, l.itemId, -l.qtyInStockUnit);
  next = { ...next, wasteLog: [...next.wasteLog, ...entries] };
  const total = p.payload.lines.reduce((s, l) => s + l.value, 0);
  const first = p.payload.lines[0];
  const after = stockOf(next, first.itemId);
  return {
    world: next,
    receipt: {
      headline: (p.payload.lines.length === 1
        ? `Waste recorded: ${itemPhrase(first.qty, first.unit, first.itemName)}`
        : `Waste recorded: ${p.payload.lines.length} lines`) + wasteDayPhrase(p.payload.wasteDate, w.today),
      detail: p.payload.lines.length === 1
        ? `${first.reason}. £${total.toFixed(2)}. ${first.itemName} now ${fmtQty(after?.onHand ?? 0)} ${first.stockUnit}.`
        : `£${total.toFixed(2)} in total.`,
      undo: { kind: 'delete-with-reason' },
    },
  };
}

function applyOnHand(w: WorldState, p: ProposalOf<'on-hand'>): Applied {
  const d = p.payload;
  let next = setStock(w, d.itemId, { onHand: d.to });
  if (d.route === 'quick-count' && d.countListId) {
    next = {
      ...next,
      quickCounts: [
        ...next.quickCounts,
        { id: uid('qc'), countListId: d.countListId, status: 'submitted', counted: { [d.itemId]: d.to }, startedAt: new Date().toISOString() },
      ],
    };
  }
  const revert = revertOf(p, 'on-hand', { ...d, from: d.to, to: d.from }, `${d.itemName} back to ${fmtQty(d.from)} ${d.unit}`, `Set ${d.itemName} back to ${fmtQty(d.from)} ${d.unit}?`);
  return {
    world: next,
    receipt: {
      headline: `On hand updated for ${d.itemName}`,
      detail: d.route === 'quick-count'
        ? `Counted on the ${d.countListName} list: ${fmtQty(d.to)} ${d.unit}, was ${fmtQty(d.from)}.`
        : `${fmtQty(d.from)} to ${fmtQty(d.to)} ${d.unit}.`,
      href: '/stock',
      hrefLabel: 'Open stock',
      undo: { kind: 'restage', prompt: `There's no undo for on hand. Set it back to ${fmtQty(d.from)} ${d.unit}?` },
      revert,
    },
  };
}

function applyHotAdd(w: WorldState, p: ProposalOf<'hot-add'>): Applied | { error: string } {
  if (!w.hot) return { error: 'There\'s no hot station at this site. Nothing has changed.' };
  const d = p.payload;
  const hot = {
    ...w.hot,
    batches: w.hot.batches.map((b) =>
      b.id !== d.batchId
        ? b
        : {
            ...b,
            lines: b.lines.map((l) => {
              const add = d.lines.find((x) => x.recipeId === l.recipeId);
              return add ? { ...l, made: (l.made ?? 0) + add.add } : l;
            }),
          },
    ),
  };
  const line = d.lines[0];
  return {
    world: { ...w, hot },
    receipt: {
      headline: 'Added to the line.',
      detail: d.lines.map((l) => `${l.recipeName}: ${l.add} more, ${l.newMade} made`).join('. ') + `. ${d.batchLabel}.`,
      href: '/production',
      hrefLabel: 'Open production',
      undo: { kind: 'none', why: `There's no undo for adds. If ${line.recipeName} is wrong, set how many are left in the availability check on the hot station.` },
    },
  };
}

function applyProductionStep(w: WorldState, p: ProposalOf<'production-step'>): Applied | { error: string } {
  if (!w.bench) return { error: 'There\'s no bench at this site. Nothing has changed.' };
  const d = p.payload;
  const stamp = new Date().toISOString();
  const bench = {
    ...w.bench,
    rows: w.bench.rows.map((r) =>
      r.id !== d.rowId
        ? r
        : {
            ...r,
            startedAt: d.action === 'complete' ? r.startedAt : r.startedAt ?? stamp,
            completedAt: d.action === 'start' ? r.completedAt : stamp,
          },
    ),
  };
  return {
    world: { ...w, bench },
    receipt: {
      headline: d.action === 'start' ? `${d.recipeName} started` : `${d.recipeName} done`,
      detail: `${d.planned} on the ${d.benchName}.`,
      href: '/production',
      hrefLabel: 'Open production',
      undo: { kind: 'none', why: 'There\'s no undo for starting or finishing a run.' },
    },
  };
}

function applyPar(w: WorldState, p: ProposalOf<'par-level'>): Applied {
  const d = p.payload;
  const revert = d.from === null
    ? undefined
    : revertOf(p, 'par-level', { ...d, from: d.to, to: d.from }, `Par for ${d.itemName} back to ${fmtQty(d.from)}`, `Set par for ${d.itemName} back to ${fmtQty(d.from)} ${d.unit}?`);
  return {
    world: setStock(w, d.itemId, { par: d.to }),
    receipt: {
      headline: `Par level updated for ${d.itemName}`,
      detail: `${d.from === null ? 'No par' : fmtQty(d.from)} to ${fmtQty(d.to)} ${d.unit}. Orders use it from the next suggestion.`,
      undo: revert
        ? { kind: 'restage', prompt: `There's no undo for par. Set it back to ${fmtQty(d.from ?? 0)} ${d.unit}?` }
        : { kind: 'none', why: 'There was no par before, and Main can\'t clear one from here.' },
      revert,
    },
  };
}

function applyTransferRequest(w: WorldState, p: ProposalOf<'transfer-request'>): Applied {
  const d = p.payload;
  const req = {
    id: uid('trq'),
    requestingSiteId: w.siteId,
    fulfillingSiteId: d.fulfillingSiteId,
    fulfillingSiteName: d.fulfillingSiteName,
    status: 'REQUESTED' as const,
    lines: d.lines,
    note: d.note,
    createdAt: new Date().toISOString(),
  };
  return {
    world: { ...w, transferRequests: [...w.transferRequests, req] },
    receipt: {
      headline: 'Transfer requested',
      detail: `${d.lines.map((l) => `${fmtQty(l.qty)} ${l.unit} ${l.itemName}`).join(', ')} from ${d.fulfillingSiteName}. Nothing moves until they send it.`,
      href: '/transfers',
      hrefLabel: 'Open transfers',
      undo: { kind: 'cancel', prompt: 'Cancel this request?' },
    },
  };
}

function applyQuickCountStart(w: WorldState, p: ProposalOf<'quick-count-start'>): Applied | { error: string } {
  const d = p.payload;
  if (w.stocktakeInProgress) {
    return { error: 'A stocktake is being counted at this site. Submit it first, then come back to this quick count.' };
  }
  const open = w.quickCounts.find((q) => q.countListId === d.countListId && q.status === 'open');
  const next = open
    ? w
    : { ...w, quickCounts: [...w.quickCounts, { id: uid('qc'), countListId: d.countListId, status: 'open' as const, counted: {}, startedAt: new Date().toISOString() }] };
  return {
    world: next,
    receipt: {
      headline: open ? `Back into the ${d.countListName} count, ${d.itemCount} items` : `Started the ${d.countListName} count, ${d.itemCount} items`,
      detail: 'On hand updates only for what you count.',
      href: '/stock?tab=stocktake',
      hrefLabel: 'Open count',
      undo: { kind: 'cancel', prompt: 'Discard this quick count?' },
    },
  };
}

function applyChecklist(w: WorldState, p: ProposalOf<'checklist-answer'>): Applied | { error: string } {
  const d = p.payload;
  const list = w.checklists.find((c) => c.instanceId === d.instanceId);
  if (!list) return { error: 'That checklist isn\'t open any more. Nothing has changed.' };
  const previous = list.answers[d.questionId];
  const answers = { ...list.answers, [d.questionId]: d.answer };
  if (d.followUp) answers[d.followUp.questionId] = d.followUp.answer;
  const checklists = w.checklists.map((c) =>
    c.instanceId === d.instanceId ? { ...c, answers, status: c.status === 'pending' ? 'in_progress' : c.status } : c,
  );
  const shown = d.responseType === 'checkbox' ? (d.answer === 'yes' ? 'Yes' : 'No') : d.responseType === 'temperature' ? `${d.answer} °C` : d.answer;
  const revert = revertOf(
    p,
    'checklist-answer',
    { ...d, answer: previous ?? '', followUp: undefined },
    `${d.questionName}: ${previous ?? 'blank'}`,
    previous ? `Put ${d.questionName} back to ${previous}?` : `Clear ${d.questionName}?`,
  );
  return {
    world: { ...w, checklists },
    receipt: {
      headline: 'Progress saved',
      detail: `${d.checklistName}. ${d.questionName}: ${shown}.${d.followUp ? ` ${d.followUp.questionName}: ${d.followUp.answer}.` : ''} ${d.answeredAfter} of ${d.totalQuestions} answered.`,
      href: '/checklists',
      hrefLabel: 'Open checklist',
      undo: { kind: 'restage', prompt: previous ? `Put it back to ${previous}?` : 'Clear that answer?' },
      revert,
    },
  };
}

function applyBasketAdd(w: WorldState, p: ProposalOf<'basket-add'>): Applied {
  const d = p.payload;
  const orders = w.basket.orders.map((o) => {
    if (o.id !== d.orderId) return o;
    if (d.restoresRemoved) {
      return { ...o, lines: o.lines.map((l) => (l.productId === d.productId ? { ...l, removed: false, packs: d.packs } : l)) };
    }
    return { ...o, lines: [...o.lines, { productId: d.productId, name: d.productName, packs: d.packs, removed: false, addedByYou: true }] };
  });
  addChatBasketLine({ supplierId: d.supplierId, productId: d.productId, packs: d.packs });
  return {
    world: { ...w, basket: { ...w.basket, orders } },
    receipt: {
      headline: `Added ${d.productName} to ${d.supplierName}.`,
      detail: `${d.packs} ${d.packs === 1 ? d.orderUnit : d.orderUnitPlural}, £${(d.packs * d.unitPrice).toFixed(2)}. Nothing is sent until you place the order.`,
      href: '/assisted-ordering/basket',
      hrefLabel: 'Open basket',
      undo: { kind: 'direct', prompt: `Take ${d.productName} back off the ${d.supplierName} order?` },
    },
  };
}

function applyDelivery(w: WorldState, p: ProposalOf<'delivery-accept'>): Applied | { error: string } {
  const d = p.payload;
  const delivery = w.deliveries.find((x) => x.id === d.deliveryId);
  if (!delivery) return { error: 'That delivery isn\'t pending any more. Nothing has changed.' };
  if (delivery.requiresReference && !d.supplierReference?.trim()) return { error: 'Delivery must include a Supplier Reference' };
  let next = w;
  const lines = delivery.lines.map((l) => {
    const draft = d.lines.find((x) => x.id === l.id);
    const received = draft ? draft.received : l.ordered;
    if (received > 0 && l.stockItemId) next = adjustStock(next, w.siteId, l.stockItemId, received * (l.stockPerUnit ?? 1));
    return { ...l, received, status: 'accepted' as const };
  });
  const short = d.lines.filter((l) => l.received < l.ordered);
  const status = short.length ? 'partially-received' : 'received';
  next = {
    ...next,
    deliveries: next.deliveries.map((x) =>
      x.id === d.deliveryId ? { ...x, lines, status, supplierReference: d.supplierReference, creditRequested: d.requestCredit && short.length > 0 } : x,
    ),
  };
  const value = d.lines.reduce((s, l) => s + l.received * l.price, 0);
  return {
    world: next,
    receipt: {
      headline: 'Delivery accepted',
      detail: `${d.supplierName} ${d.poNumber}: ${d.lines.length - short.length} of ${d.lines.length} lines in full, £${value.toFixed(2)}.${short.length ? ` ${short.length} short: any remaining quantity stays pending.` : ''}${d.requestCredit && short.length ? ' Credit requested from the supplier.' : ''}`,
      href: '/receiving',
      hrefLabel: 'Open deliveries',
      undo: { kind: 'none', why: 'An accepted delivery can\'t be un-accepted. If a figure is wrong, count the item and on hand will follow.' },
    },
  };
}

function applyTransferSend(w: WorldState, p: ProposalOf<'transfer-send'>): Applied {
  const d = p.payload;
  let next = w;
  for (const l of d.lines) next = adjustStock(next, w.siteId, l.itemId, -l.qty);
  const number = `TR-${1100 + next.transfers.length}`;
  next = {
    ...next,
    transfers: [
      ...next.transfers,
      {
        id: uid('tr'),
        number,
        fromSiteId: w.siteId,
        fromSiteName: siteName(w, w.siteId),
        toSiteId: d.toSiteId,
        toSiteName: d.toSiteName,
        sentAt: d.sentAt,
        status: 'pending',
        lines: d.lines.map((l) => ({ id: uid('trl'), itemId: l.itemId, itemName: l.itemName, qty: l.qty, unit: l.unit })),
      },
    ],
  };
  return {
    world: next,
    receipt: {
      headline: 'Transfer sent',
      detail: `${number} to ${d.toSiteName}: ${d.lines.map((l) => `${fmtQty(l.qty)} ${l.unit} ${l.itemName}`).join(', ')}. Your stock is down now. It doesn't wait for them to accept.`,
      href: '/transfers',
      hrefLabel: 'Open transfers',
      undo: { kind: 'cancel', prompt: 'Cancel this transfer?' },
    },
  };
}

function applyTransferAccept(w: WorldState, p: ProposalOf<'transfer-accept'>): Applied | { error: string } {
  const d = p.payload;
  const t = w.transfers.find((x) => x.id === d.transferId);
  if (!t || t.status !== 'pending') return { error: 'That transfer isn\'t pending any more. Nothing has changed.' };
  let next = w;
  for (const l of t.lines) {
    const draft = d.lines.find((x) => x.id === l.id);
    const received = draft ? draft.received : l.qty;
    if (l.itemId && received > 0) next = adjustStock(next, w.siteId, l.itemId, received);
    const rejected = l.qty - received;
    if (l.itemId && rejected > 0 && draft?.reason && ['Incorrect item', 'Missing', 'Other'].includes(draft.reason)) {
      next = adjustStock(next, t.fromSiteId, l.itemId, rejected);
    }
  }
  next = {
    ...next,
    transfers: next.transfers.map((x) =>
      x.id === t.id
        ? {
            ...x,
            status: 'accepted',
            lines: x.lines.map((l) => {
              const draft = d.lines.find((y) => y.id === l.id);
              return { ...l, received: draft?.received ?? l.qty, reason: draft?.reason };
            }),
          }
        : x,
    ),
  };
  const rejectedLines = d.lines.filter((l) => l.received < l.sent);
  return {
    world: next,
    receipt: {
      headline: 'Transfer accepted',
      detail: `${d.transferNumber} from ${d.fromSiteName}. ${rejectedLines.length ? rejectedLines.map((l) => `${l.itemName}: ${fmtQty(l.sent - l.received)} rejected, ${l.reason}`).join('. ') + '.' : 'Everything received.'}`,
      href: '/transfers',
      hrefLabel: 'Open transfers',
      undo: { kind: 'none', why: 'An accepted transfer can\'t be undone.' },
    },
  };
}

function applyDemand(w: WorldState, p: ProposalOf<'demand-adjustment'>): Applied {
  const d = p.payload;
  const revert = revertOf(p, 'demand-adjustment', { ...d, percentOfDemand: 100, reason: `Cancel: ${d.reason}` }, `Cancel the one-off for ${d.reason}`, `Cancel the one-off change for ${d.reason}?`);
  return {
    world: { ...w, demandAdjustments: [...w.demandAdjustments, { ...d, id: uid('da'), createdAt: new Date().toISOString() }] },
    receipt: {
      headline: d.percentOfDemand === 100 ? 'One-off change cancelled' : 'One-off change saved',
      detail: `${d.siteName}, ${d.startDate === d.endDate ? d.startDate : `${d.startDate} to ${d.endDate}`}: ${d.percentOfDemand}% of usual. Suggested orders for those days follow it.`,
      href: '/assisted-ordering/basket',
      hrefLabel: 'Open orders',
      undo: { kind: 'restage', prompt: 'Cancel that one-off change?' },
      revert,
    },
  };
}

function applyUndo(w: WorldState, p: ProposalOf<'undo'>): Applied | { error: string } {
  const r = w.receipts.find((x) => x.id === p.payload.receiptId);
  if (!r || r.undone) return { error: 'That\'s already been undone.' };
  const original = w.proposals.find((x) => x.id === r.proposalId);
  const markUndone = (next: WorldState): WorldState => ({
    ...next,
    receipts: next.receipts.map((x) => (x.id === r.id ? { ...x, undone: true } : x)),
  });
  const done = (next: WorldState, headline: string, detail?: string): Applied => ({
    world: markUndone(next),
    receipt: { headline, detail, undo: { kind: 'none', why: 'An undo can\'t be undone. Say the task again instead.' } },
  });

  if (r.undo.kind === 'none') return { error: r.undo.why };

  if (r.undo.kind === 'restage') {
    if (!r.revert) return { error: 'There\'s nothing to set it back to.' };
    const res = apply(w, r.revert);
    if ('error' in res) return res;
    return done(res.world, `Put back: ${r.revert.label}`);
  }

  if (!original) return { error: 'Edify can\'t find what that changed. Nothing has changed.' };

  switch (original.taskId) {
    case 'waste': {
      const reason = p.payload.reason?.trim() ?? '';
      if (reason.length < 3) return { error: 'Why are you deleting this? It needs a reason of at least 3 characters.' };
      let next = w;
      for (const l of original.payload.lines) next = adjustStock(next, w.siteId, l.itemId, l.qtyInStockUnit);
      next = {
        ...next,
        wasteLog: next.wasteLog.map((e) => (e.proposalId === original.id ? { ...e, deletedReason: reason } : e)),
      };
      return done(next, 'Waste deleted', `Stock is back. Reason: ${reason}.`);
    }
    case 'basket-add': {
      const d = original.payload;
      const orders = w.basket.orders.map((o) =>
        o.id !== d.orderId
          ? o
          : {
              ...o,
              lines: d.restoresRemoved
                ? o.lines.map((l) => (l.productId === d.productId ? { ...l, removed: true } : l))
                : o.lines.filter((l) => !(l.productId === d.productId && l.addedByYou)),
            },
      );
      removeChatBasketLine(d.supplierId, d.productId);
      return done({ ...w, basket: { ...w.basket, orders } }, `${d.productName} removed`, `Off the ${d.supplierName} order.`);
    }
    case 'transfer-send': {
      const d = original.payload;
      const t = [...w.transfers].reverse().find((x) => x.toSiteId === d.toSiteId && x.status === 'pending' && x.fromSiteId === w.siteId);
      if (!t) return { error: 'That transfer has been accepted, so it can\'t be cancelled.' };
      let next = w;
      for (const l of d.lines) next = adjustStock(next, w.siteId, l.itemId, l.qty);
      next = { ...next, transfers: next.transfers.map((x) => (x.id === t.id ? { ...x, status: 'cancelled' } : x)) };
      return done(next, 'Transfer cancelled', `${t.number}. Your stock is back.`);
    }
    case 'transfer-request': {
      const d = original.payload;
      const req = [...w.transferRequests].reverse().find((x) => x.fulfillingSiteId === d.fulfillingSiteId && x.status === 'REQUESTED');
      if (!req) return { error: 'That request has moved on, so it can\'t be cancelled.' };
      return done(
        { ...w, transferRequests: w.transferRequests.map((x) => (x.id === req.id ? { ...x, status: 'CANCELLED' } : x)) },
        'Request cancelled',
      );
    }
    case 'quick-count-start': {
      const d = original.payload;
      return done(
        {
          ...w,
          quickCounts: w.quickCounts.map((q) => (q.countListId === d.countListId && q.status === 'open' ? { ...q, status: 'discarded' } : q)),
        },
        'Quick count discarded',
        `${d.countListName}. Nothing was applied.`,
      );
    }
    default:
      return { error: 'Edify can\'t undo that one. Nothing has changed.' };
  }
}

export function undoSpecLabel(u: UndoSpec): string | null {
  switch (u.kind) {
    case 'none':
      return null;
    case 'delete-with-reason':
      return 'Delete';
    case 'cancel':
      return 'Cancel';
    default:
      return 'Undo';
  }
}

/** Build an undo proposal in the browser, for the Undo button on a
 *  receipt. The spoken path builds the same thing on the server. */
export function stageUndo(receiptId: string, reason?: string): Proposal | null {
  const w = world();
  const r = w.receipts.find((x) => x.id === receiptId);
  if (!r) return null;
  const now = new Date();
  const p: Proposal = {
    id: uid('pr'),
    taskId: 'undo',
    payload: { receiptId, receiptHeadline: r.headline, targetTaskId: r.taskId, reason },
    label: `Undo: ${r.headline}`,
    readback: r.undo.kind === 'delete-with-reason' ? 'Delete this waste entry?' : 'prompt' in r.undo ? r.undo.prompt : 'Undo that?',
    warnings: [],
    siteId: w.siteId,
    createdAt: now.toISOString(),
    status: 'staged',
    expiresAt: endOfTradingDay(now),
  };
  addProposals([p]);
  return p;
}
