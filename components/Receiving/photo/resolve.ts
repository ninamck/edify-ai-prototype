import {
  MOCK_POS,
  type DeliveryCommitAlternative,
  type DeliveryCommitLine,
  type GRNLine,
  type PO,
  type POLine,
  type VarianceResolution,
} from '@/components/Receiving/mockData';
import {
  INVOICE_PLANS,
  PRICE_TOLERANCE_PCT,
  RECEIPT_PLANS,
  RETAIL_SUPPLIERS,
  SAMPLE_DOCUMENTS,
  priceChangePct,
  type DocLine,
  type InvoiceLinePlan,
  type ReceiptLinePlan,
  type SampleDocument,
} from './fixtures';
import type { Decisions, LineDecision } from './types';
import { gbp } from './ui';

export interface Outcome {
  id: string;
  /** What will be written, shown before confirming. */
  future: string;
  /** What was written, shown on the Done screen. */
  past: string;
}

export interface WritePlan {
  supplier: string;
  pos: PO[];
  stockValue: number;
  lineCount: number;
  outcomes: Outcome[];
  handoffs: string[];
  grnLines: Omit<GRNLine, 'id'>[];
  commitLines: DeliveryCommitLine[];
  alternatives: DeliveryCommitAlternative[];
}

const SITE = 'Fitzroy Espresso';

function poLineById(id: string): { po: PO; line: POLine } | undefined {
  for (const po of MOCK_POS) {
    const line = po.lines.find(l => l.id === id);
    if (line) return { po, line };
  }
  return undefined;
}

function shortName(name: string): string {
  return name.replace(/\s+\d.*$/, '');
}

export function paperLine(doc: SampleDocument, lineId: string): DocLine {
  return doc.lines.find(l => l.id === lineId)!;
}

// ── Invoice ────────────────────────────────────────────────────────────

/**
 * The plan for each line given which POs the GM kept ticked. Lines whose
 * order was unticked become extras, an ambiguous line with one candidate
 * left becomes a straight match, and a match whose price moved past the
 * tolerance is held for an admin.
 */
export function effectiveInvoicePlans(selectedPoIds: string[]): InvoiceLinePlan[] {
  const doc = SAMPLE_DOCUMENTS['fresh-direct'];
  return INVOICE_PLANS.map((p): InvoiceLinePlan => {
    if (p.kind === 'extra') return p;
    if (p.kind === 'ambiguous') {
      const left = p.candidates.filter(c => selectedPoIds.includes(c.poId));
      if (left.length === 0) return { lineId: p.lineId, kind: 'extra' };
      if (left.length === 1) {
        const hit = poLineById(left[0].poLineId);
        return withPriceCheck({ lineId: p.lineId, kind: 'clean', poId: left[0].poId, poLineId: left[0].poLineId, poPrice: hit?.line.price ?? 0 }, doc);
      }
      return { ...p, candidates: left, suggested: Math.min(p.suggested, left.length - 1) };
    }
    if (!selectedPoIds.includes(p.poId)) return { lineId: p.lineId, kind: 'extra' };
    return p.kind === 'clean' ? withPriceCheck(p, doc) : p;
  });
}

function withPriceCheck(p: Extract<InvoiceLinePlan, { kind: 'clean' }>, doc: SampleDocument): InvoiceLinePlan {
  const pct = priceChangePct(p.poPrice, paperLine(doc, p.lineId).unitPrice);
  if (Math.abs(pct) > PRICE_TOLERANCE_PCT + 0.001) {
    return { lineId: p.lineId, kind: 'price-held', poId: p.poId, poLineId: p.poLineId, poPrice: p.poPrice };
  }
  return p;
}

export function invoiceLineDecided(plan: InvoiceLinePlan, d: LineDecision | undefined): boolean {
  switch (plan.kind) {
    case 'clean':
    case 'price-held':
      return true;
    case 'substitute':
      return d?.choice === 'refuse' || (d?.choice === 'accept' && !!d.packId);
    default:
      return !!d?.choice;
  }
}

export function needsDecision(plan: InvoiceLinePlan): boolean {
  return plan.kind !== 'clean' && plan.kind !== 'price-held';
}

const SHORT_RESOLUTION: Record<string, VarianceResolution> = {
  later: 'Coming in another delivery',
  credit: 'Request credit note',
  cancel: 'Accept short',
};

export function buildInvoicePlan(selectedPoIds: string[], decisions: Decisions): WritePlan {
  const doc = SAMPLE_DOCUMENTS['fresh-direct'];
  const plans = effectiveInvoicePlans(selectedPoIds);
  const pos = MOCK_POS.filter(p => selectedPoIds.includes(p.id));
  const outcomes: Outcome[] = [];
  const handoffs: string[] = [];
  const grnLines: Omit<GRNLine, 'id'>[] = [];
  const commitLines: DeliveryCommitLine[] = [];
  const alternatives: DeliveryCommitAlternative[] = [];
  const touched = new Set<string>();
  let cleanCount = 0;

  const receiveAgainst = (poLineId: string, paper: DocLine, opts: { qty?: number; price?: number; resolution?: VarianceResolution; priceHeld?: GRNLine['priceHeld'] } = {}) => {
    const hit = poLineById(poLineId);
    if (!hit) return;
    touched.add(poLineId);
    const qty = opts.qty ?? paper.qty;
    grnLines.push({
      poLineId,
      name: hit.line.name,
      sku: hit.line.sku,
      unit: hit.line.unit,
      price: opts.price ?? paper.unitPrice,
      expectedQty: hit.line.expectedQty,
      receivedQty: qty,
      varianceResolution: opts.resolution,
      extractedText: paper.text,
      priceHeld: opts.priceHeld,
    });
    commitLines.push({ poLineId, receivedQty: qty, resolution: opts.resolution });
  };

  for (const plan of plans) {
    const paper = paperLine(doc, plan.lineId);
    const d = decisions[plan.lineId] ?? {};
    switch (plan.kind) {
      case 'clean': {
        receiveAgainst(plan.poLineId, paper);
        cleanCount += 1;
        const pct = priceChangePct(plan.poPrice, paper.unitPrice);
        if (Math.abs(pct) > 0.001) {
          const name = shortName(poLineById(plan.poLineId)?.line.name ?? paper.text);
          const dir = pct > 0 ? 'up' : 'down';
          outcomes.push({
            id: `${plan.lineId}-price`,
            future: `${name} price goes to ${gbp(paper.unitPrice)} (${dir} ${Math.abs(pct).toFixed(0)}%, inside your ${PRICE_TOLERANCE_PCT}% tolerance).`,
            past: `${name} price updated to ${gbp(paper.unitPrice)} (${dir} ${Math.abs(pct).toFixed(0)}%, inside your ${PRICE_TOLERANCE_PCT}% tolerance).`,
          });
        }
        break;
      }
      case 'short': {
        const missing = plan.ordered - paper.qty;
        const resolution = SHORT_RESOLUTION[d.choice ?? 'later'];
        receiveAgainst(plan.poLineId, paper, { resolution });
        const po = MOCK_POS.find(p => p.id === plan.poId);
        const name = shortName(paper.text);
        if (d.choice === 'credit') {
          outcomes.push({
            id: plan.lineId,
            future: `${name}: ${paper.qty} in, credit note request for ${missing} (${gbp(missing * paper.unitPrice)}).`,
            past: `${name}: ${paper.qty} in, credit note requested for ${missing} (${gbp(missing * paper.unitPrice)}).`,
          });
          handoffs.push(`${name} ${missing} short from ${doc.supplierName}, credit note request raised, finance will see it in invoice matching.`);
        } else if (d.choice === 'cancel') {
          outcomes.push({
            id: plan.lineId,
            future: `${name}: ${paper.qty} in, the other ${missing} cancelled on ${po?.poNumber}.`,
            past: `${name}: ${paper.qty} in, the other ${missing} cancelled on ${po?.poNumber}.`,
          });
        } else {
          outcomes.push({
            id: plan.lineId,
            future: `${name}: ${paper.qty} in, ${missing} still expected. ${po?.poNumber} stays open for them.`,
            past: `${name}: ${paper.qty} in, ${missing} still expected on ${po?.poNumber}.`,
          });
          handoffs.push(`${name} ${missing} still due from ${doc.supplierName}. ${po?.poNumber} stays in Deliveries until they arrive.`);
        }
        break;
      }
      case 'over': {
        const extra = paper.qty - plan.ordered;
        const name = shortName(paper.text);
        if (d.choice === 'refuse') {
          receiveAgainst(plan.poLineId, paper, { qty: plan.ordered });
          outcomes.push({
            id: plan.lineId,
            future: `${name}: ${plan.ordered} in, ${extra} sent back with the driver.`,
            past: `${name}: ${plan.ordered} in, ${extra} sent back with the driver.`,
          });
        } else {
          receiveAgainst(plan.poLineId, paper);
          outcomes.push({
            id: plan.lineId,
            future: `${name}: all ${paper.qty} in, ${extra} more than ordered (+${gbp(extra * paper.unitPrice)}).`,
            past: `${name}: all ${paper.qty} in, ${extra} more than ordered (+${gbp(extra * paper.unitPrice)}).`,
          });
        }
        break;
      }
      case 'substitute': {
        const hit = poLineById(plan.poLineId);
        const po = MOCK_POS.find(p => p.id === plan.poId);
        if (d.choice === 'accept' && hit) {
          const pack = plan.packOptions.find(p => p.id === d.packId) ?? plan.packOptions[0];
          const equiv = paper.qty * pack.masterQty;
          touched.add(plan.poLineId);
          // applyReceiptToPOs keeps any PO line with no commit line, so the
          // replaced line needs one for the substitution to settle it.
          commitLines.push({ poLineId: plan.poLineId, receivedQty: 0 });
          grnLines.push({
            poLineId: plan.poLineId,
            name: paper.text,
            sku: 'VT-1KG',
            unit: 'BOX',
            price: paper.unitPrice,
            expectedQty: Math.round(plan.replacedQty / pack.masterQty),
            receivedQty: paper.qty,
            extractedText: paper.text,
            alternativeFor: {
              poLineId: hit.line.id,
              poName: hit.line.name,
              poSku: hit.line.sku,
              poExpectedQty: hit.line.expectedQty,
              note: `Supplier sent an alternative; confirmed from the invoice photo and linked to the ${plan.masterName} master product.`,
            },
          });
          alternatives.push({
            id: `alt-${plan.lineId}`,
            originPoLineId: plan.poLineId,
            masterProductId: 'mp-tomatoes',
            masterName: plan.masterName,
            masterUnit: plan.masterUnitLabel,
            productName: paper.text,
            supplierCode: 'VT-1KG',
            packType: 'Single',
            packQty: 1,
            singleUnitType: 'kg',
            packCost: paper.unitPrice,
            receivedQty: paper.qty,
            supplierName: doc.supplierName,
            site: SITE,
          });
          outcomes.push({
            id: plan.lineId,
            future: `${paper.text} added as a ${doc.supplierName} product under ${plan.masterName}. ${paper.qty} boxes in, counted as ${equiv} ${plan.masterUnitLabel}, replacing ${plan.replacedName.toLowerCase()} on ${po?.poNumber}.`,
            past: `${paper.text} added as a ${doc.supplierName} product under ${plan.masterName}. ${paper.qty} boxes in, counted as ${equiv} ${plan.masterUnitLabel}.`,
          });
        } else {
          receiveAgainst(plan.poLineId, paper, { qty: 0, price: plan.replacedPrice, resolution: 'Coming in another delivery' });
          grnLines[grnLines.length - 1].extractedText = `${paper.text} (refused)`;
          outcomes.push({
            id: plan.lineId,
            future: `${paper.text} sent back. ${plan.replacedName} stay open on ${po?.poNumber}.`,
            past: `${paper.text} sent back. ${plan.replacedName} still open on ${po?.poNumber}.`,
          });
        }
        break;
      }
      case 'ambiguous': {
        const pick = plan.candidates[Number(d.choice ?? plan.suggested)];
        receiveAgainst(pick.poLineId, paper);
        const po = MOCK_POS.find(p => p.id === pick.poId);
        outcomes.push({
          id: plan.lineId,
          future: `"${paper.text}" matched to ${pick.label} on ${po?.poNumber}.`,
          past: `"${paper.text}" matched to ${pick.label} on ${po?.poNumber}.`,
        });
        break;
      }
      case 'price-held': {
        receiveAgainst(plan.poLineId, paper, { price: plan.poPrice, priceHeld: { poPrice: plan.poPrice, paperPrice: paper.unitPrice } });
        const name = shortName(paper.text);
        outcomes.push({
          id: plan.lineId,
          future: `${name} in at the order price, ${gbp(plan.poPrice)}. The new ${gbp(paper.unitPrice)} waits for an admin.`,
          past: `${name} in at the order price, ${gbp(plan.poPrice)}. The new ${gbp(paper.unitPrice)} is waiting for an admin.`,
        });
        handoffs.push(`${name} price change (${gbp(plan.poPrice)} to ${gbp(paper.unitPrice)}) is waiting for an admin to approve in Suppliers.`);
        break;
      }
      case 'extra': {
        const name = paper.text;
        if (d.choice === 'accept') {
          grnLines.push({
            poLineId: `extra-${plan.lineId}`,
            name,
            sku: 'FM-30',
            unit: 'PKT',
            price: paper.unitPrice,
            expectedQty: paper.qty,
            receivedQty: paper.qty,
            extractedText: paper.text,
            addedAtReceiving: { note: 'Not on any order. Accepted at the door from the invoice photo.' },
          });
          outcomes.push({
            id: plan.lineId,
            future: `${name} x${paper.qty} added to the delivery (${gbp(paper.qty * paper.unitPrice)}).`,
            past: `${name} x${paper.qty} added to the delivery (${gbp(paper.qty * paper.unitPrice)}).`,
          });
        } else {
          outcomes.push({
            id: plan.lineId,
            future: `${name} sent back, not booked in.`,
            past: `${name} sent back, not booked in.`,
          });
        }
        break;
      }
    }
  }

  outcomes.unshift({
    id: 'clean',
    future: `${cleanCount} line${cleanCount === 1 ? '' : 's'} received as ordered.`,
    past: `${cleanCount} line${cleanCount === 1 ? '' : 's'} received as ordered.`,
  });

  for (const po of pos) {
    for (const line of po.lines) {
      if (touched.has(line.id)) continue;
      outcomes.push({
        id: `open-${line.id}`,
        future: `${line.name} wasn't on the invoice. ${po.poNumber} stays open for it.`,
        past: `${line.name} wasn't on the invoice. ${po.poNumber} stays open for it.`,
      });
    }
  }

  outcomes.push({
    id: 'photo',
    future: 'Photo kept on the GRN, with what Edify read from each line.',
    past: 'Photo kept on the GRN, with what Edify read from each line.',
  });
  handoffs.push(`Invoice ${doc.docNumber} goes to finance for invoice matching against this GRN.`);

  return {
    supplier: doc.supplierName,
    pos,
    stockValue: grnLines.reduce((s, l) => s + l.price * l.receivedQty, 0),
    lineCount: grnLines.filter(l => l.receivedQty > 0).length,
    outcomes,
    handoffs,
    grnLines,
    commitLines,
    alternatives,
  };
}

// ── Shop receipt ───────────────────────────────────────────────────────

export function initialReceiptDecisions(): Decisions {
  const d: Decisions = {};
  for (const p of RECEIPT_PLANS) {
    if (p.kind === 'not-stock') d[p.lineId] = { choice: 'ignore' };
    if (p.kind === 'new') d[p.lineId] = { name: p.suggestedName, allergens: [] };
  }
  return d;
}

export function receiptLineDecided(plan: ReceiptLinePlan, d: LineDecision | undefined): boolean {
  switch (plan.kind) {
    case 'supplier-product':
      return true;
    case 'master':
      return !!d?.packId;
    case 'new':
      if (d?.choice === 'ignore') return true;
      return d?.choice === 'create' && !!d.name?.trim() && ((d.allergens?.length ?? 0) > 0 || !!d.noAllergens);
    case 'not-stock':
      return !!d?.choice;
  }
}

export function receiptNeedsDecision(plan: ReceiptLinePlan): boolean {
  return plan.kind !== 'supplier-product';
}

export function buildReceiptPlan(decisions: Decisions, offContract: boolean): WritePlan {
  const doc = SAMPLE_DOCUMENTS.sainsburys;
  const supplier = RETAIL_SUPPLIERS.find(s => s.name === doc.supplierName)!;
  const outcomes: Outcome[] = [];
  const handoffs: string[] = [];
  const grnLines: Omit<GRNLine, 'id'>[] = [];

  const push = (plan: ReceiptLinePlan, paper: DocLine, name: string, unit: string) => {
    grnLines.push({
      poLineId: `receipt-${plan.lineId}`,
      name,
      sku: 'Shop item',
      unit,
      price: paper.unitPrice,
      expectedQty: paper.qty,
      receivedQty: paper.qty,
      extractedText: paper.text,
    });
  };

  let newProduct: string | null = null;

  for (const plan of RECEIPT_PLANS) {
    const paper = paperLine(doc, plan.lineId);
    const d = decisions[plan.lineId] ?? {};
    switch (plan.kind) {
      case 'master': {
        const pack = plan.packOptions.find(p => p.id === d.packId) ?? plan.packOptions[0];
        push(plan, paper, plan.suggestedName, 'BOTTLE');
        const total = +(paper.qty * pack.masterQty).toFixed(3);
        outcomes.push({
          id: plan.lineId,
          future: `${plan.suggestedName} added under ${plan.masterName}. ${paper.qty} bottles in, counted as ${total} ${plan.masterUnit}.`,
          past: `${plan.suggestedName} added under ${plan.masterName}. ${paper.qty} bottles in, counted as ${total} ${plan.masterUnit}.`,
        });
        break;
      }
      case 'supplier-product':
        push(plan, paper, plan.productName, 'EA');
        outcomes.push({
          id: plan.lineId,
          future: `${plan.productName} x${paper.qty} in, the product you bought here on ${plan.lastBought}.`,
          past: `${plan.productName} x${paper.qty} in, the product you bought here on ${plan.lastBought}.`,
        });
        break;
      case 'new': {
        if (d.choice === 'create') {
          const name = d.name?.trim() || plan.suggestedName;
          newProduct = name;
          push(plan, paper, name, 'EA');
          const allergens = d.noAllergens || !d.allergens?.length ? 'none' : d.allergens.join(', ').toLowerCase();
          outcomes.push({
            id: plan.lineId,
            future: `New product ${name} (${plan.category}, ${plan.unit}, allergens: ${allergens}) with ${supplier.name} as its supplier. ${paper.qty} in.`,
            past: `New product ${name} created (${plan.category}, ${plan.unit}, allergens: ${allergens}) with ${supplier.name} as its supplier. ${paper.qty} in.`,
          });
        } else {
          outcomes.push({ id: plan.lineId, future: `${titleCase(paper.text)} left out, not stock.`, past: `${titleCase(paper.text)} left out, not stock.` });
        }
        break;
      }
      case 'not-stock':
        if (d.choice === 'stock') {
          push(plan, paper, 'Carrier bags', 'EA');
          outcomes.push({ id: plan.lineId, future: 'Carrier bag booked in as a consumable.', past: 'Carrier bag booked in as a consumable.' });
        } else {
          outcomes.push({ id: plan.lineId, future: 'Carrier bag left out, not stock.', past: 'Carrier bag left out, not stock.' });
        }
        break;
    }
  }

  outcomes.push({ id: 'cogs', future: "Counts in COGS. Recipe costs don't move.", past: "Counts in COGS. Recipe costs don't move." });
  outcomes.push({
    id: 'off-contract',
    future: offContract ? `Tagged off-contract: ${supplier.name} isn't one of your agreed suppliers.` : 'Not tagged off-contract.',
    past: offContract ? `Tagged off-contract: ${supplier.name} isn't one of your agreed suppliers.` : 'Not tagged off-contract.',
  });
  outcomes.push({ id: 'photo', future: 'Photo kept on the GRN as the receipt.', past: 'Photo kept on the GRN as the receipt.' });

  const paid = doc.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  handoffs.push(
    `Invoice record created for ${gbp(paid)} against ${supplier.expenseAccount}${offContract ? ', tagged off-contract' : ''}. The receipt is the invoice, so there's nothing to match.`,
  );
  if (newProduct) handoffs.push(`${newProduct} is new, so no recipe uses it yet. Add it to recipes from Products when you're ready.`);

  return {
    supplier: supplier.name,
    pos: [],
    stockValue: grnLines.reduce((s, l) => s + l.price * l.receivedQty, 0),
    lineCount: grnLines.length,
    outcomes,
    handoffs,
    grnLines,
    commitLines: [],
    alternatives: [],
  };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
