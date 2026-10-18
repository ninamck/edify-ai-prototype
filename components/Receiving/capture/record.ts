import { MOCK_CREDIT_NOTES, type CreditNote, type CreditNoteReason } from '@/components/CreditNotes/mockData';
import {
  applyReceiptToPOs,
  MOCK_COMPLETED_DELIVERIES,
  MOCK_POS,
  type DeliveryCommitAlternative,
  type DeliveryCommitLine,
  type GRN,
  type GRNLine,
  type PhotoSource,
  type POLine,
  type POStatus,
  type VarianceResolution,
} from '../mockData';
import { answerFor, gbp, outcomes, review, type Answers, type IssueKind, type LineEdit, type Setups } from './review';
import { poIdFor, type Sample, type SampleId, type SeedLine } from './samples';

// Accepting a photographed delivery writes one GRN for the whole paper,
// settles the order lines it covers, and raises one credit note per reason.
// Everything is snapshotted first so the whole acceptance can be undone.

export interface Recorded {
  grn: GRN;
  creditNotes: CreditNote[];
  outcomes: string[];
  /** Products and suppliers added to Edify along the way. */
  added: string[];
  undo: () => void;
}

/** Papers accepted this session, so photographing the same one again is caught. */
export const ACCEPTED: Partial<Record<SampleId, { grnNumber: string; time: string }>> = {};

const SOURCE: Record<Sample['kind'], PhotoSource> = {
  'delivery-note': 'photo-delivery-note',
  invoice: 'photo-invoice',
  receipt: 'photo-receipt',
  menu: 'photo-receipt',
};

const CREDIT_REASON: Partial<Record<IssueKind, CreditNoteReason>> = {
  short: 'Short delivery',
  damaged: 'Damaged goods',
  price: 'Price variance',
  substitute: 'Returned goods',
  extra: 'Returned goods',
  wrong: 'Returned goods',
};

const RESOLUTION: Record<string, VarianceResolution> = {
  credit: 'Request credit note',
  later: 'Coming in another delivery',
  resend: 'Coming in another delivery',
  close: 'Accept short',
  return: 'Request credit note',
};

function poLineIdFor(sample: Sample, l: SeedLine, poNumber?: string): string {
  return l.issue?.kind === 'which-po' && poNumber ? `${sample.id}-${l.id}-${poNumber}` : `${sample.id}-${l.id}`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function today() {
  const d = new Date();
  return {
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function recordCapture(sample: Sample, edits: Record<string, LineEdit>, answers: Answers, setups: Setups, receivedBy = 'Ed Barry'): Recorded {
  const r = review(sample, edits, answers, setups);
  const itemFor = new Map(r.toCheck.filter(i => i.line).map(i => [i.line!.id, i]));
  const stamp = Date.now();
  const { date, time } = today();

  const grnLines: GRNLine[] = [];
  const commits: DeliveryCommitLine[] = [];
  const alternatives: DeliveryCommitAlternative[] = [];
  const credits: { reason: CreditNoteReason; amount: number; why: string }[] = [];

  sample.lines.forEach((l, idx) => {
    const e = edits[l.id];
    const item = itemFor.get(l.id);
    const choice = item ? answerFor(answers, item) : undefined;
    const kind = item?.issue.kind;
    const credit = item?.issue.choices.find(c => c.id === choice)?.credit ?? 0;
    const price = l.price ?? l.orderPrice ?? 0;
    const base: GRNLine = {
      id: `gl-photo-${stamp}-${idx}`,
      poLineId: poLineIdFor(sample, l),
      name: l.name,
      sku: l.code ?? '',
      unit: l.pack,
      price,
      expectedQty: l.ordered ?? e.got,
      receivedQty: e.got,
      extractedText: l.printed,
    };
    const commit = (receivedQty: number, resolution?: VarianceResolution, poNumber?: string) => {
      if (l.ordered == null && l.issue?.kind !== 'which-po') return;
      commits.push({ poLineId: poLineIdFor(sample, l, poNumber), receivedQty, resolution });
    };
    if (credit > 0 && kind && CREDIT_REASON[kind]) credits.push({ reason: CREDIT_REASON[kind]!, amount: credit, why: `${item!.issue.title}: ${gbp(credit)}` });

    switch (kind) {
      case undefined:
        grnLines.push({ ...base, decision: l.links ? `Linked to ${l.links}.` : undefined });
        commit(e.got);
        return;
      case 'short': {
        const res = RESOLUTION[choice ?? 'credit'];
        grnLines.push({ ...base, varianceResolution: res });
        commit(e.got, res);
        return;
      }
      case 'over':
        if (choice === 'keep') {
          grnLines.push({ ...base, decision: `Kept the extra ${e.got - (l.ordered ?? 0)}.` });
          commit(e.got);
        } else {
          grnLines.push({ ...base, receivedQty: l.ordered ?? 0, returned: { qty: e.got - (l.ordered ?? 0), reason: 'more than ordered' } });
          commit(l.ordered ?? 0);
        }
        return;
      case 'damaged': {
        const kept = e.got - e.damaged;
        const res = RESOLUTION[choice ?? 'credit'];
        grnLines.push({ ...base, receivedQty: kept, returned: { qty: e.damaged, reason: 'damaged' }, varianceResolution: res });
        commit(kept, res);
        return;
      }
      case 'wrong':
        if (choice === 'return') {
          grnLines.push({ ...base, receivedQty: 0, returned: { qty: e.got, reason: 'wrong product' }, varianceResolution: 'Request credit note' });
          commit(0, 'Request credit note');
        } else {
          grnLines.push({ ...base, decision: 'Kept, though it isn\u2019t what was ordered.' });
          commit(e.got);
        }
        return;
      case 'price':
        grnLines.push({
          ...base,
          decision:
            choice === 'pay'
              ? `Paid ${gbp(l.price ?? 0)}, up from ${gbp(l.orderPrice ?? 0)}. Price updated.`
              : choice === 'once'
                ? `Paid ${gbp(l.price ?? 0)} this time only.`
                : `Invoice says ${gbp(l.price ?? 0)}. Credit asked for the difference from ${gbp(l.orderPrice ?? 0)}.`,
        });
        commit(e.got);
        return;
      case 'substitute': {
        if (l.issue?.kind !== 'substitute') return;
        const s = l.issue;
        if (choice === 'keep') {
          const p = setups.products[l.id] ?? l.setup;
          grnLines.push({
            ...base,
            name: p?.name ?? s.sentName,
            sku: p?.code ?? s.sentCode,
            unit: s.sentPack,
            price: s.sentPrice ?? price,
            alternativeFor: {
              poLineId: base.poLineId,
              poName: l.name,
              poSku: l.code ?? '',
              poExpectedQty: l.ordered ?? e.got,
              note: `Supplier sent ${s.sentName} in place of ${l.name}. Kept and added under ${p?.master ?? s.master}.`,
            },
          });
          alternatives.push({
            id: `alt-${stamp}-${l.id}`,
            originPoLineId: base.poLineId,
            masterProductId: `mp-${slug(p?.master ?? s.master)}`,
            masterName: p?.master ?? s.master,
            masterUnit: p?.unitType ?? 'Each',
            productName: p?.name ?? s.sentName,
            supplierCode: p?.code ?? s.sentCode,
            packType: p?.packType ?? 'Single',
            packQty: p?.packQty ?? 1,
            singleUnitType: p?.unitType ?? 'Each',
            packCost: p?.packCost ?? s.sentPrice ?? price,
            receivedQty: e.got,
            supplierName: sample.supplier,
            site: sample.site,
          });
          commit(e.got);
        } else {
          grnLines.push({ ...base, name: s.sentName, receivedQty: 0, returned: { qty: e.got, reason: 'not wanted' }, varianceResolution: 'Request credit note' });
          commit(0, 'Request credit note');
        }
        return;
      }
      case 'extra':
        if (choice === 'keep') {
          const p = setups.products[l.id];
          grnLines.push({
            ...base,
            poLineId: `extra-${l.id}`,
            name: p?.name ?? l.name,
            addedAtReceiving: { note: 'Not on the order. Kept and recorded so the invoice matches.' },
            decision: p ? `Added to your catalogue under ${p.master}.` : undefined,
          });
        } else {
          grnLines.push({ ...base, poLineId: `extra-${l.id}`, expectedQty: 0, receivedQty: 0, returned: { qty: e.got, reason: 'not wanted' } });
        }
        return;
      case 'which-po':
        grnLines.push({ ...base, poLineId: poLineIdFor(sample, l, choice), decision: `Received on ${choice}.` });
        commit(e.got, undefined, choice);
        return;
      case 'new-product': {
        const p = setups.products[l.id];
        grnLines.push(
          choice === 'add'
            ? { ...base, name: p?.name ?? l.name, decision: `Added to your catalogue under ${p?.master ?? l.name}.` }
            : { ...base, receivedQty: 0, decision: 'Left out of stock. Still counts in spend.' },
        );
        return;
      }
    }
  });

  const pos = sample.poNumbers.map(n => MOCK_POS.find(p => p.id === poIdFor(n))).filter((p): p is NonNullable<typeof p> => !!p);
  const snapshot: { id: string; lines: POLine[]; status: POStatus }[] = pos.map(p => ({ id: p.id, lines: p.lines.map(x => ({ ...x })), status: p.status }));
  if (pos.length) applyReceiptToPOs({ pos, lines: commits, alternatives });

  const highest = Math.max(1290, ...MOCK_COMPLETED_DELIVERIES.map(g => Number(g.grnNumber.replace(/\D/g, '')) || 0));
  const priced = sample.kind === 'invoice' || sample.kind === 'receipt';
  const grn: GRN = {
    id: `grn-photo-${stamp}`,
    grnNumber: `GRN-${highest + 1}`,
    poNumbers: sample.poNumbers,
    supplier: sample.supplier,
    site: sample.site,
    status: credits.length ? 'Variance \u2014 Awaiting Resolution' : priced ? 'Matched' : 'Pending Invoice',
    dateReceived: date,
    receivedBy,
    invoiceNumber: sample.kind === 'invoice' ? sample.docNumber : undefined,
    invoiceStatus: priced ? 'Matched' : 'Pending Invoice',
    deliveryNoteNumber: sample.kind === 'delivery-note' ? sample.docNumber : undefined,
    source: SOURCE[sample.kind],
    offContract: sample.kind === 'receipt',
    photo: { sampleId: sample.photoOf ?? sample.id, pages: sample.pages },
    lines: grnLines,
  };
  MOCK_COMPLETED_DELIVERIES.push(grn);

  const byReason = new Map<CreditNoteReason, { amount: number; why: string[] }>();
  for (const c of credits) {
    const g = byReason.get(c.reason) ?? { amount: 0, why: [] };
    g.amount += c.amount;
    g.why.push(c.why);
    byReason.set(c.reason, g);
  }
  let cn = Math.max(0, ...MOCK_CREDIT_NOTES.map(n => Number(n.ref.replace(/\D/g, '')) || 0));
  const creditNotes: CreditNote[] = [...byReason].map(([reason, g], i) => ({
    id: `cn-photo-${stamp}-${i}`,
    ref: `CN-${String(++cn).padStart(3, '0')}`,
    supplier: sample.supplier,
    raisedDate: date,
    daysOutstanding: 0,
    amount: Math.round(g.amount * 100) / 100,
    reason,
    status: 'Requested',
    originRef: grn.grnNumber,
    originType: 'GRN',
    originDate: date,
    linkedInvoice: grn.invoiceNumber,
    chaseHistory: [
      {
        id: `ce-photo-${stamp}-${i}`,
        date: `${date} \u00b7 ${time}`,
        type: 'raised',
        note: `${g.why.join('. ')}. Raised from a photo of the ${sample.kind === 'invoice' ? 'invoice' : 'delivery note'} and emailed to ${sample.supplier} accounts.`,
        by: receivedBy,
      },
    ],
  }));
  MOCK_CREDIT_NOTES.unshift(...creditNotes);
  ACCEPTED[sample.id] = { grnNumber: grn.grnNumber, time: `${time} today` };

  const added = [
    ...(setups.supplier && !sample.supplierInEdify ? [setups.supplier.name] : []),
    ...grnLines.filter(g => g.decision?.startsWith('Added') || (g.alternativeFor && setups.products[g.poLineId.replace(`${sample.id}-`, '')])).map(g => g.name),
  ];

  return {
    grn,
    creditNotes,
    added,
    outcomes: outcomes(sample, edits, answers, setups),
    undo: () => {
      const at = MOCK_COMPLETED_DELIVERIES.findIndex(g => g.id === grn.id);
      if (at >= 0) MOCK_COMPLETED_DELIVERIES.splice(at, 1);
      for (const s of snapshot) {
        const po = MOCK_POS.find(p => p.id === s.id);
        if (po) {
          po.lines = s.lines;
          po.status = s.status;
        }
      }
      for (const n of creditNotes) {
        const i = MOCK_CREDIT_NOTES.findIndex(x => x.id === n.id);
        if (i >= 0) MOCK_CREDIT_NOTES.splice(i, 1);
      }
      delete ACCEPTED[sample.id];
    },
  };
}

/** The sample as Edify would see it now: a paper accepted this session reads as a duplicate. */
export function withAccepted(sample: Sample): Sample {
  const done = ACCEPTED[sample.id];
  if (!done || sample.blocked) return sample;
  return { ...sample, blocked: 'duplicate', duplicateOf: { grnNumber: done.grnNumber, time: done.time } };
}
