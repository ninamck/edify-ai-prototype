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
  PO_DOCUMENTS,
  PRICE_TOLERANCE_PCT,
  RECEIPT_PLANS,
  RECEIVED_BY,
  RETAIL_SUPPLIERS,
  SAMPLE_DOCUMENTS,
  SITE,
  docNoun,
  priceChangePct,
  type DocLine,
  type PoLinePlan,
  type PoSampleId,
  type ReceiptLinePlan,
  type SampleDocument,
} from './fixtures';
import type { AddedLine, Decisions, LineDecision } from './types';
import { gbp } from './ui';

export interface Outcome {
  id: string;
  /** What will be written, shown before confirming. */
  future: string;
  /** What was written, shown on the Done screen. */
  past: string;
}

/** Something to carry on with after accepting, in another part of Edify. */
export interface FollowUp {
  id: string;
  label: string;
  detail: string;
  href: string;
}

export interface WritePlan {
  supplier: string;
  pos: PO[];
  stockValue: number;
  lineCount: number;
  outcomes: Outcome[];
  handoffs: string[];
  followUps: FollowUp[];
  grnLines: Omit<GRNLine, 'id'>[];
  commitLines: DeliveryCommitLine[];
  alternatives: DeliveryCommitAlternative[];
}

function poLineById(id: string): { po: PO; line: POLine } | undefined {
  for (const po of MOCK_POS) {
    const line = po.lines.find(l => l.id === id);
    if (line) return { po, line };
  }
  return undefined;
}

export function shortName(name: string): string {
  return name.replace(/\s+\d.*$/, '').replace(/\s+SUB$/, '');
}

export function paperLine(doc: SampleDocument, lineId: string): DocLine {
  return doc.lines.find(l => l.id === lineId)!;
}

/** The unit price a line comes in at: the GM's correction if she made one, else what the paper says. */
export function linePrice(paper: DocLine, d: LineDecision | undefined): number {
  return d?.price ?? paper.unitPrice;
}

const same = (future: string, past = future) => ({ future, past });

// ── Documents against POs ──────────────────────────────────────────────

/**
 * The plan for each line given which POs are ticked and what the GM has
 * flagged. Lines whose order was unticked become extras, an ambiguous line
 * with one candidate left becomes a straight match, a match whose price
 * moved past the tolerance is held for an admin, and a matched line the GM
 * reported a problem with becomes a short or damaged line.
 */
export function effectivePoPlans(docId: PoSampleId, selectedPoIds: string[], decisions: Decisions = {}): PoLinePlan[] {
  const doc = SAMPLE_DOCUMENTS[docId];
  return PO_DOCUMENTS[docId].plans.map((p): PoLinePlan => {
    if (p.kind === 'extra') return p;
    if (p.kind === 'ambiguous') {
      const left = p.candidates.filter(c => selectedPoIds.includes(c.poId));
      if (left.length === 0) return { lineId: p.lineId, kind: 'extra' };
      if (left.length === 1) {
        const hit = poLineById(left[0].poLineId);
        return checked({ lineId: p.lineId, kind: 'clean', poId: left[0].poId, poLineId: left[0].poLineId, poPrice: hit?.line.price ?? 0 }, doc, decisions);
      }
      return { ...p, candidates: left, suggested: Math.min(p.suggested, left.length - 1) };
    }
    if (!selectedPoIds.includes(p.poId)) return { lineId: p.lineId, kind: 'extra' };
    return p.kind === 'clean' ? checked(p, doc, decisions) : p;
  });
}

function checked(p: Extract<PoLinePlan, { kind: 'clean' }>, doc: SampleDocument, decisions: Decisions): PoLinePlan {
  const paper = paperLine(doc, p.lineId);
  const d = decisions[p.lineId];
  if (d?.problem) {
    const affected = Math.min(Math.max(d.affected ?? 1, 1), paper.qty);
    if (d.problem === 'damaged') {
      return { lineId: p.lineId, kind: 'damaged', poId: p.poId, poLineId: p.poLineId, delivered: paper.qty, damaged: affected };
    }
    return { lineId: p.lineId, kind: 'short', poId: p.poId, poLineId: p.poLineId, ordered: paper.qty, received: paper.qty - affected, reported: true };
  }
  const pct = priceChangePct(p.poPrice, linePrice(paper, d));
  if (Math.abs(pct) > PRICE_TOLERANCE_PCT + 0.001) {
    return { lineId: p.lineId, kind: 'price-held', poId: p.poId, poLineId: p.poLineId, poPrice: p.poPrice };
  }
  return p;
}

export function lineDecided(plan: PoLinePlan, d: LineDecision | undefined): boolean {
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

export function needsDecision(plan: PoLinePlan): boolean {
  return plan.kind !== 'clean' && plan.kind !== 'price-held';
}

const SHORT_RESOLUTION: Record<string, VarianceResolution> = {
  later: 'Coming in another delivery',
  credit: 'Request credit note',
  cancel: 'Accept short',
};

export function buildPoPlan(docId: PoSampleId, selectedPoIds: string[], decisions: Decisions, added: AddedLine[] = []): WritePlan {
  const doc = SAMPLE_DOCUMENTS[docId];
  const noun = docNoun(doc);
  const plans = effectivePoPlans(docId, selectedPoIds, decisions);
  const pos = MOCK_POS.filter(p => selectedPoIds.includes(p.id));
  const outcomes: Outcome[] = [];
  const handoffs: string[] = [];
  const followUps: FollowUp[] = [];
  const grnLines: Omit<GRNLine, 'id'>[] = [];
  const commitLines: DeliveryCommitLine[] = [];
  const alternatives: DeliveryCommitAlternative[] = [];
  const touched = new Set<string>();
  let cleanCount = 0;

  const receiveAgainst = (
    poLineId: string,
    paper: DocLine,
    opts: { qty?: number; price?: number; resolution?: VarianceResolution; priceHeld?: GRNLine['priceHeld']; returned?: GRNLine['returned'] } = {},
  ) => {
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
      returned: opts.returned,
    });
    commitLines.push({ poLineId, receivedQty: qty, resolution: opts.resolution });
  };

  for (const plan of plans) {
    const paper = paperLine(doc, plan.lineId);
    const d = decisions[plan.lineId] ?? {};
    const name = shortName(paper.text);
    const poPrice = 'poLineId' in plan ? poLineById(plan.poLineId)?.line.price ?? paper.unitPrice : paper.unitPrice;
    const poNumber = 'poId' in plan ? MOCK_POS.find(p => p.id === plan.poId)?.poNumber : undefined;

    switch (plan.kind) {
      case 'clean': {
        const price = linePrice(paper, d);
        receiveAgainst(plan.poLineId, paper, { price });
        cleanCount += 1;
        const pct = priceChangePct(plan.poPrice, price);
        if (Math.abs(pct) > 0.001) {
          const dir = pct > 0 ? 'up' : 'down';
          const from = d.price != null ? 'corrected at the door' : `from the ${noun}`;
          outcomes.push({
            id: `${plan.lineId}-price`,
            future: `${name} price goes to ${gbp(price)}, ${from} (${dir} ${Math.abs(pct).toFixed(0)}%, inside your ${PRICE_TOLERANCE_PCT}% tolerance).`,
            past: `${name} price updated to ${gbp(price)}, ${from} (${dir} ${Math.abs(pct).toFixed(0)}%, inside your ${PRICE_TOLERANCE_PCT}% tolerance).`,
          });
        }
        break;
      }
      case 'short': {
        const missing = plan.ordered - plan.received;
        const resolution = SHORT_RESOLUTION[d.choice ?? 'later'];
        receiveAgainst(plan.poLineId, paper, { qty: plan.received, resolution });
        const value = gbp(missing * poPrice);
        if (d.choice === 'credit') {
          outcomes.push({
            id: plan.lineId,
            future: `${name}: ${plan.received} in, credit note request for ${missing} (${value} at the order price).`,
            past: `${name}: ${plan.received} in, credit note requested for ${missing} (${value} at the order price).`,
          });
          handoffs.push(`${name}: ${missing} short from ${doc.supplierName}. Credit note request raised, finance will see it in invoice matching.`);
        } else if (d.choice === 'cancel') {
          outcomes.push({ id: plan.lineId, ...same(`${name}: ${plan.received} in, the other ${missing} cancelled on ${poNumber}.`) });
        } else {
          outcomes.push({
            id: plan.lineId,
            future: `${name}: ${plan.received} in, ${missing} still expected. ${poNumber} stays open for them.`,
            past: `${name}: ${plan.received} in, ${missing} still expected on ${poNumber}.`,
          });
          handoffs.push(`${name}: ${missing} still due from ${doc.supplierName}. ${poNumber} stays in Deliveries until they arrive.`);
        }
        break;
      }
      case 'damaged': {
        const good = plan.delivered - plan.damaged;
        const value = gbp(plan.damaged * poPrice);
        const credit = d.choice === 'credit';
        receiveAgainst(plan.poLineId, paper, {
          qty: good,
          resolution: credit ? 'Request credit note' : 'Coming in another delivery',
          returned: { qty: plan.damaged, reason: 'damaged' },
        });
        outcomes.push({
          id: plan.lineId,
          ...same(
            credit
              ? `${name}: ${good} in, ${plan.damaged} damaged and sent back. Credit note request for ${value}.`
              : `${name}: ${good} in, ${plan.damaged} damaged and sent back. ${poNumber} stays open for replacements.`,
          ),
        });
        handoffs.push(
          credit
            ? `${name}: ${plan.damaged} damaged. Credit note request raised with ${doc.supplierName}, finance will see it in invoice matching.`
            : `${name}: ${plan.damaged} replacements due from ${doc.supplierName}. ${poNumber} stays in Deliveries until they arrive.`,
        );
        break;
      }
      case 'over': {
        const extra = paper.qty - plan.ordered;
        if (d.choice === 'refuse') {
          receiveAgainst(plan.poLineId, paper, { qty: plan.ordered, returned: { qty: extra, reason: 'over' } });
          outcomes.push({ id: plan.lineId, ...same(`${name}: ${plan.ordered} in, ${extra} sent back with the driver.`) });
        } else {
          receiveAgainst(plan.poLineId, paper);
          outcomes.push({ id: plan.lineId, ...same(`${name}: all ${paper.qty} in, ${extra} more than ordered (+${gbp(extra * paper.unitPrice)}).`) });
          handoffs.push(`${name}: ${extra} more than ${poNumber} ordered. Flagged for finance, the invoice will be higher than the order.`);
        }
        break;
      }
      case 'substitute': {
        const hit = poLineById(plan.poLineId);
        if (d.choice === 'accept' && hit) {
          const pack = plan.packOptions.find(p => p.id === d.packId) ?? plan.packOptions[0];
          // Edify's own match. The GM confirms the swap and the pack; placing the product is Edify's job.
          const option = plan.options.find(o => o.id === (d.subOption ?? plan.suggestedOption)) ?? plan.options[0];
          const equiv = paper.qty * pack.masterQty;
          // A delivery note prints no price, so the case is costed from the order's per-unit price.
          const price = doc.kind === 'delivery-note' ? +(plan.replacedPrice * pack.masterQty).toFixed(2) : paper.unitPrice;
          const versus = equiv === plan.replacedQty ? `the same as the ${plan.replacedQty} ordered` : `${plan.replacedQty} were ordered`;
          touched.add(plan.poLineId);
          // applyReceiptToPOs keeps any PO line with no commit line, so the
          // replaced line needs one for the substitution to settle it.
          commitLines.push({ poLineId: plan.poLineId, receivedQty: 0 });
          grnLines.push({
            poLineId: plan.poLineId,
            name: plan.productName,
            sku: plan.newSku,
            unit: plan.grnUnit,
            price,
            expectedQty: Math.round(plan.replacedQty / pack.masterQty),
            receivedQty: paper.qty,
            extractedText: paper.text,
            alternativeFor: {
              poLineId: hit.line.id,
              poName: hit.line.name,
              poSku: hit.line.sku,
              poExpectedQty: hit.line.expectedQty,
              note: `Supplier sent a substitute; confirmed from the ${noun} photo and linked to the ${option.masterName} master product.`,
            },
          });
          alternatives.push({
            id: `alt-${plan.lineId}`,
            originPoLineId: plan.poLineId,
            masterProductId: `mp-${option.masterName.toLowerCase().replace(/\s+/g, '-')}`,
            masterName: option.masterName,
            masterUnit: plan.masterUnitLabel,
            productName: plan.productName,
            supplierCode: plan.newSku,
            packType: pack.masterQty > 1 ? 'Pack' : 'Single',
            packQty: pack.masterQty,
            singleUnitType: plan.singleUnitType,
            packCost: price,
            receivedQty: paper.qty,
            supplierName: doc.supplierName,
            site: SITE,
          });
          const where =
            option.kind === 'supplier-product'
              ? `${plan.productName}, the ${doc.supplierName} product already under ${option.masterName}`
              : option.kind === 'under-master'
                ? `${plan.productName}, a new ${doc.supplierName} product under ${option.masterName}`
                : `${plan.productName}, under a new master product, ${option.masterName}`;
          outcomes.push({
            id: plan.lineId,
            ...same(
              `${plan.replacedName} replaced by ${where}. ${paper.qty} ${plan.deliveredUnit} in, counted as ${equiv} ${plan.masterUnitLabel}, ${versus}.`,
            ),
          });
          if (option.kind !== 'supplier-product') {
            handoffs.push(`${plan.productName} is new in Edify. It sits under ${option.masterName}, so recipes using it cost from this delivery. Allergens and sites are set up in the Command Centre.`);
            followUps.push({
              id: `setup-${plan.lineId}`,
              label: `Set up ${plan.productName} in the Command Centre`,
              detail: `Allergens, which sites stock it and which recipes use it. Name, supplier, pack of ${pack.masterQty} and price are already filled in from this delivery.`,
              href: addProductHref(plan.productName, doc.supplierName, plan.singleUnitType, price, { packQty: pack.masterQty, source: doc.kind }),
            });
          }
        } else {
          receiveAgainst(plan.poLineId, paper, {
            qty: 0,
            price: plan.replacedPrice,
            resolution: 'Coming in another delivery',
            returned: { qty: paper.qty, reason: 'refused' },
          });
          outcomes.push({
            id: plan.lineId,
            future: `${plan.productName} sent back. ${plan.replacedName} stays open on ${poNumber}.`,
            past: `${plan.productName} sent back. ${plan.replacedName} still open on ${poNumber}.`,
          });
        }
        break;
      }
      case 'ambiguous': {
        const pick = plan.candidates[Number(d.choice ?? plan.suggested)];
        receiveAgainst(pick.poLineId, paper);
        const po = MOCK_POS.find(p => p.id === pick.poId);
        outcomes.push({ id: plan.lineId, ...same(`"${paper.text}" matched to ${pick.label} on ${po?.poNumber}.`) });
        break;
      }
      case 'price-held': {
        const price = linePrice(paper, d);
        receiveAgainst(plan.poLineId, paper, { price: plan.poPrice, priceHeld: { poPrice: plan.poPrice, paperPrice: price } });
        outcomes.push({
          id: plan.lineId,
          future: `${name} in at the order price, ${gbp(plan.poPrice)}. The new ${gbp(price)} waits for an admin.`,
          past: `${name} in at the order price, ${gbp(plan.poPrice)}. The new ${gbp(price)} is waiting for an admin.`,
        });
        handoffs.push(`${name} price change (${gbp(plan.poPrice)} to ${gbp(price)}) is waiting for an admin to approve in Suppliers.`);
        break;
      }
      case 'extra': {
        const accepted = d.choice === 'accept';
        grnLines.push({
          poLineId: `extra-${plan.lineId}`,
          name: paper.text,
          sku: 'FM-30',
          unit: 'PKT',
          price: paper.unitPrice,
          expectedQty: 0,
          receivedQty: accepted ? paper.qty : 0,
          extractedText: paper.text,
          addedAtReceiving: { note: accepted ? 'Not on any order. Accepted at the door from the photo.' : 'Not on any order. Sent back at the door.' },
          returned: accepted ? undefined : { qty: paper.qty, reason: 'refused' },
        });
        if (accepted) {
          outcomes.push({ id: plan.lineId, ...same(`${paper.text} x${paper.qty} added to the delivery (${gbp(paper.qty * paper.unitPrice)}).`) });
          handoffs.push(`${paper.text} wasn't on any order. Flagged for finance as an extra on this delivery.`);
        } else {
          outcomes.push({ id: plan.lineId, ...same(`${paper.text} sent back, noted on the GRN, not received.`) });
        }
        break;
      }
    }
  }

  // Things the GM added at the door: off the van, on no paper and no order.
  for (const a of added) {
    grnLines.push({
      poLineId: `added-${a.id}`,
      name: a.name,
      sku: 'Not on order',
      unit: 'EA',
      price: a.unitPrice,
      expectedQty: 0,
      receivedQty: a.qty,
      addedAtReceiving: { note: `Not on the ${noun} or any order. Added at the door by ${RECEIVED_BY}.` },
    });
    outcomes.push({ id: `added-${a.id}`, ...same(`${a.name} x${a.qty} added at the door, not on the ${noun} (${gbp(a.qty * a.unitPrice)}).`) });
    handoffs.push(`${a.name} wasn't on the ${noun} or any order. Flagged for finance as an extra on this delivery.`);
  }

  outcomes.unshift({ id: 'clean', ...same(`${cleanCount} line${cleanCount === 1 ? '' : 's'} received as ordered.`) });

  for (const po of pos) {
    for (const line of po.lines) {
      if (touched.has(line.id)) continue;
      outcomes.push({ id: `open-${line.id}`, ...same(`${line.name} wasn't on the ${noun}. ${po.poNumber} stays open for it.`) });
    }
  }

  outcomes.push({ id: 'photo', ...same(`Photo kept on the GRN, with what Edify read from each line.`) });
  handoffs.push(
    doc.kind === 'invoice'
      ? `Invoice ${doc.docNumber} goes to finance for invoice matching against this GRN.`
      : `When ${doc.supplierName}'s invoice arrives it matches against this GRN. Edify checks it isn't received twice.`,
  );

  return {
    supplier: doc.supplierName,
    pos,
    stockValue: grnLines.reduce((s, l) => s + l.price * l.receivedQty, 0),
    lineCount: grnLines.filter(l => l.receivedQty > 0).length,
    outcomes,
    handoffs,
    followUps,
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
  }
  return d;
}

const WIZARD_UNIT: Record<string, string> = { each: 'Each', kg: 'kg', g: 'g', l: 'L', ml: 'ml' };

/**
 * Deep link into the Command Centre's add-product wizard, pre-filled from a
 * line on the paper. `packQty` above 1 opens it as a pack (a case of 8 cartons)
 * at the case price; otherwise as a single at the unit price. `source` is the
 * kind of paper: a shop receipt relaxes the wizard's supplier rules (no order
 * email, placeholder code), a delivery note or invoice from a real supplier doesn't.
 */
export function addProductHref(
  name: string, supplier: string, unit: string, cost: number,
  opts: { packQty?: number; source?: SampleDocument['kind'] } = {},
): string {
  const q = new URLSearchParams({
    flow: 'add-product',
    name,
    supplier,
    unit: WIZARD_UNIT[unit.toLowerCase()] ?? 'Each',
    cost: cost.toFixed(2),
    source: opts.source ?? 'receipt',
  });
  if ((opts.packQty ?? 1) > 1) q.set('pack', String(opts.packQty));
  return `/?${q.toString()}`;
}

export function receiptLineDecided(plan: ReceiptLinePlan, d: LineDecision | undefined): boolean {
  switch (plan.kind) {
    case 'supplier-product':
      return true;
    case 'master':
      return !!d?.packId;
    case 'new':
      return d?.choice === 'ignore' || d?.choice === 'create';
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
  const followUps: FollowUp[] = [];
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
          ...same(`${plan.suggestedName} added under ${plan.masterName}. ${paper.qty} bottles in, counted as ${total} ${plan.masterUnit}.`),
        });
        break;
      }
      case 'supplier-product':
        push(plan, paper, plan.productName, 'EA');
        outcomes.push({ id: plan.lineId, ...same(`${plan.productName} x${paper.qty} in, the product you bought here on ${plan.lastBought}.`) });
        break;
      case 'new': {
        if (d.choice === 'create') {
          const name = plan.suggestedName;
          newProduct = name;
          push(plan, paper, name, 'EA');
          outcomes.push({
            id: plan.lineId,
            future: `New ${supplier.name} product ${name} (${plan.category}, counted ${plan.unit}). ${paper.qty} in at ${gbp(paper.unitPrice)}. Setup finishes in the Command Centre.`,
            past: `New ${supplier.name} product ${name} created (${plan.category}, counted ${plan.unit}). ${paper.qty} in at ${gbp(paper.unitPrice)}.`,
          });
          followUps.push({
            id: `setup-${plan.lineId}`,
            label: `Set up ${name} in the Command Centre`,
            detail: `Allergens, which sites stock it and which recipes use it. Name, supplier and price are already filled in from the receipt.`,
            href: addProductHref(name, supplier.name, plan.unit, paper.unitPrice),
          });
        } else {
          outcomes.push({ id: plan.lineId, ...same(`${titleCase(paper.text)} left out, not stock.`) });
        }
        break;
      }
      case 'not-stock':
        if (d.choice === 'stock') {
          push(plan, paper, 'Carrier bags', 'EA');
          outcomes.push({ id: plan.lineId, ...same('Carrier bag booked in as a consumable.') });
        } else {
          outcomes.push({ id: plan.lineId, ...same('Carrier bag left out, not stock.') });
        }
        break;
    }
  }

  outcomes.push({ id: 'cogs', ...same("Counts in COGS. Recipe costs don't move.") });
  if (offContract) {
    outcomes.push({ id: 'off-contract', ...same(`Tagged off-contract: ${supplier.name} isn't one of your agreed suppliers.`) });
  }
  outcomes.push({ id: 'photo', ...same('Photo kept on the GRN as the receipt.') });

  const paid = doc.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  handoffs.push(
    `Invoice record created for ${gbp(paid)} against ${supplier.expenseAccount}${offContract ? ', tagged off-contract' : ''}. The receipt is the invoice, so there's nothing to match.`,
  );
  if (newProduct) handoffs.push(`${newProduct} is new, so it has no allergens, sites or recipes yet. The Command Centre picks that up from here.`);

  return {
    supplier: supplier.name,
    pos: [],
    stockValue: grnLines.reduce((s, l) => s + l.price * l.receivedQty, 0),
    lineCount: grnLines.length,
    outcomes,
    handoffs,
    followUps,
    grnLines,
    commitLines: [],
    alternatives: [],
  };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
