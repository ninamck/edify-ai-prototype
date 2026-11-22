'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight, CalendarDays, ChefHat, ClipboardCheck, ClipboardList, Flame, Gauge, Package, ShoppingBasket, Trash2, Truck, Undo2,
} from 'lucide-react';
import CardShell, { FieldRow, PillRow, QtyStepper, type CardIcon, type CardState } from '../commands/cards/CardShell';
import { FLOOR_TASKS } from '@/lib/floorTasks/registry';
import { REJECTION_REASONS, WASTE_REASON_NAMES, isUnusuallyLarge, wasteDates } from '@/lib/floorTasks/constants';
import { dayLabel, fmtQty, itemPhrase } from '@/lib/floorTasks/format';
import type { FloorTaskId, PayloadByTask, Proposal, ProposalOf, Receipt, RejectionReason } from '@/lib/floorTasks/types';
import {
  confirmProposal, declineProposal, getWorld, receiptFor, undoSpecLabel, updateProposalPayload, useProposal,
} from '@/lib/floorTasks/world/store';

const ICONS: Record<FloorTaskId, CardIcon> = {
  waste: Trash2,
  'on-hand': Package,
  'hot-add': Flame,
  'production-step': ChefHat,
  'par-level': Gauge,
  'transfer-request': ArrowLeftRight,
  'quick-count-start': ClipboardList,
  'checklist-answer': ClipboardCheck,
  'basket-add': ShoppingBasket,
  'delivery-accept': Truck,
  'transfer-send': ArrowLeftRight,
  'transfer-accept': ArrowLeftRight,
  'demand-adjustment': CalendarDays,
  undo: Undo2,
};

interface Props {
  proposalId: string;
  /** After a yes, so the chat can read the result out. */
  onApplied?: (receipt: Receipt) => void;
  onUndo?: (receiptId: string) => void;
  /** In the workspace panel. Inline in the chat it lines up with Edify's message. */
  centred?: boolean;
}

export default function FloorTaskCard({ proposalId, onApplied, onUndo, centred }: Props) {
  const proposal = useProposal(proposalId);
  if (!proposal) return null;
  return (
    <div style={{ maxWidth: '520px', margin: centred ? '0 auto' : undefined }}>
      <CardFor key={proposal.id} proposal={proposal} onApplied={onApplied} onUndo={onUndo} />
    </div>
  );
}

/** The chat's marker for a card that has moved to the workspace. */
export function FloorTaskPointerLabel({ proposalId }: { proposalId: string }) {
  const proposal = useProposal(proposalId);
  return <>{proposal ? FLOOR_TASKS[proposal.taskId].title : 'Floor task'}</>;
}

function cardState(p: Proposal): CardState {
  if (p.status === 'applied') return 'confirmed';
  if (p.status === 'declined' || p.status === 'expired') return 'cancelled';
  return 'pending';
}

function CardFor({ proposal, onApplied, onUndo }: { proposal: Proposal; onApplied?: Props['onApplied']; onUndo?: Props['onUndo'] }) {
  const [draft, setDraft] = useState<PayloadByTask[FloorTaskId]>(proposal.payload);
  const [error, setError] = useState<string | null>(null);
  const spec = FLOOR_TASKS[proposal.taskId];
  const state = cardState(proposal);
  const locked = state !== 'pending';
  const editable = { draft, setDraft, locked } as Editable;

  const view = body(proposal, editable);

  function confirm() {
    setError(null);
    if (view.invalid) {
      setError(view.invalid);
      return;
    }
    updateProposalPayload(proposal.id, draft);
    const res = confirmProposal(proposal.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onApplied?.(res.receipt);
  }

  const receipt = state === 'confirmed' ? receiptFor(proposal.id) : undefined;
  const warnings = proposal.status === 'applied' ? [] : view.warnings ?? proposal.warnings;

  return (
    <div>
      <style>{FIRST_LINE_CSS}</style>
      <CardShell
        icon={ICONS[proposal.taskId]}
        title={view.title ?? spec.title}
        subtitle={proposal.status === 'expired' ? 'Expired at close. Nothing has changed.' : view.subtitle}
        state={state}
        confirmLabel={view.confirmLabel ?? spec.confirm.button}
        cancelLabel={proposal.taskId === 'demand-adjustment' ? 'No' : 'Cancel'}
        onConfirm={confirm}
        onCancel={() => declineProposal(proposal.id)}
        warning={error ? [error] : warnings}
        notice={proposal.status === 'waiting' ? 'From Waiting for you. Raised on a headset.' : undefined}
      >
        {view.node}
        {receipt && <ReceiptBlock receipt={receipt} onUndo={onUndo} />}
      </CardShell>
    </div>
  );
}

function ReceiptBlock({ receipt, onUndo }: { receipt: Receipt; onUndo?: (id: string) => void }) {
  const undoLabel = undoSpecLabel(receipt.undo);
  return (
    <div
      role="status"
      style={{
        marginTop: '10px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: 'rgba(21,128,61,0.07)',
        border: '1px solid rgba(21,128,61,0.18)',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#14532D' }}>{receipt.undone ? `Undone: ${receipt.headline}` : receipt.headline}</div>
      {receipt.detail && <div style={{ fontSize: '12.5px', color: 'var(--color-text-primary)', marginTop: '2px', lineHeight: 1.45 }}>{receipt.detail}</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {receipt.href && (
          <Link href={receipt.href} style={linkBtn}>
            {receipt.hrefLabel ?? 'Open'}
          </Link>
        )}
        {undoLabel && !receipt.undone && onUndo && (
          <button type="button" onClick={() => onUndo(receipt.id)} style={linkBtn}>
            {undoLabel}
          </button>
        )}
        {receipt.undo.kind === 'none' && (
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{receipt.undo.why}</span>
        )}
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '100px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  background: '#fff',
  color: 'var(--color-text-primary)',
  fontSize: '12.5px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  textDecoration: 'none',
  cursor: 'pointer',
};

// ─── Bodies ────────────────────────────────────────────────────────────────

type Editable = {
  draft: PayloadByTask[FloorTaskId];
  setDraft: (d: PayloadByTask[FloorTaskId]) => void;
  locked: boolean;
};

type View = {
  node: ReactNode;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  warnings?: string[];
  /** Set when the card can't be confirmed as it stands. */
  invalid?: string;
};

/** The first line sits straight under the card header, which already draws a rule. */
const FIRST_LINE_CSS = '.card-shell-body > .ft-line:first-child, .card-shell-body > :first-child > .ft-line:first-child { border-top: none !important; padding-top: 0 !important; }';

function Line({ label, children, sub, flush }: { label: string; sub?: string; children: ReactNode; flush?: boolean }) {
  return (
    <div className="ft-line" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: flush ? '0 0 6px' : '6px 0', borderTop: flush ? undefined : '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</div>
        {sub && <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function TextField({ value, onChange, disabled, label, placeholder }: { value: string; onChange: (v: string) => void; disabled: boolean; label: string; placeholder?: string }) {
  return (
    <label style={{ display: 'block', marginTop: '8px' }}>
      <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', minHeight: '40px', padding: '0 12px', borderRadius: '10px', border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))', fontSize: '13px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)' }}
      />
    </label>
  );
}

function body(p: Proposal, e: Editable): View {
  switch (p.taskId) {
    case 'waste':
      return wasteBody(p, e);
    case 'on-hand':
      return onHandBody(p, e);
    case 'hot-add':
      return hotAddBody(p, e);
    case 'production-step':
      return productionBody(p);
    case 'par-level':
      return parBody(p, e);
    case 'transfer-request':
      return requestBody(p, e);
    case 'quick-count-start':
      return quickCountBody(p);
    case 'checklist-answer':
      return checklistBody(p, e);
    case 'basket-add':
      return basketBody(p, e);
    case 'delivery-accept':
      return deliveryBody(p, e);
    case 'transfer-send':
      return transferSendBody(p, e);
    case 'transfer-accept':
      return transferAcceptBody(p, e);
    case 'demand-adjustment':
      return demandBody(p, e);
    case 'undo':
      return undoBody(p, e);
  }
}

function wasteBody(p: ProposalOf<'waste'>, e: Editable): View {
  const d = e.draft as PayloadByTask['waste'];
  const set = (i: number, patch: Partial<PayloadByTask['waste']['lines'][number]>) =>
    e.setDraft({
      ...d,
      lines: d.lines.map((l, j) => {
        if (j !== i) return l;
        const next = { ...l, ...patch };
        const per = l.qty ? l.qtyInStockUnit / l.qty : 1;
        const row = getWorld().stock[getWorld().siteId]?.find((r) => r.id === l.itemId);
        next.qtyInStockUnit = next.qty * per;
        next.value = Math.round(next.qtyInStockUnit * (row?.unitPrice ?? 0) * 100) / 100;
        return next;
      }),
    });
  const flagged = d.lines.some((l) => isUnusuallyLarge(l.itemId, l.qtyInStockUnit, l.value));
  const total = d.lines.reduce((s, l) => s + l.value, 0);
  const spec = FLOOR_TASKS.waste.confirm;
  const { today, role } = getWorld();
  const allowed = wasteDates(role, today);
  const days = allowed.includes(d.wasteDate) ? allowed : [d.wasteDate, ...allowed];
  const dayName = (iso: string) => {
    const label = dayLabel(iso, today);
    return label[0].toUpperCase() + label.slice(1);
  };
  return {
    title: flagged ? spec.flaggedTitle : 'Log waste',
    subtitle: dayName(d.wasteDate),
    confirmLabel: flagged ? spec.flaggedButton : spec.button,
    warnings: [
      ...d.lines.filter((l) => isUnusuallyLarge(l.itemId, l.qtyInStockUnit, l.value)).map((l) => `${l.itemName} is far more than usual. Check the number.`),
      ...d.lines.filter((l) => l.qtyInStockUnit > l.onHand).map((l) => `That takes ${l.itemName} below zero: ${fmtQty(l.onHand)} ${l.stockUnit} on hand.`),
    ],
    invalid: !allowed.includes(d.wasteDate)
      ? 'You can only log waste for today or yesterday. A manager can go back 7 days.'
      : d.lines.some((l) => !(l.qty > 0)) ? 'Each line needs a quantity above 0.' : undefined,
    node: (
      <>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Waste date</span>
          <select
            value={d.wasteDate}
            disabled={e.locked}
            onChange={(ev) => e.setDraft({ ...d, wasteDate: ev.target.value })}
            style={{ minHeight: '40px', padding: '0 10px', borderRadius: '10px', border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))', background: '#fff', fontSize: '13px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: e.locked ? 'default' : 'pointer' }}
          >
            {days.map((iso) => (
              <option key={iso} value={iso}>{dayName(iso)}</option>
            ))}
          </select>
        </label>
        {d.lines.map((l, i) => (
          <div key={`${l.itemId}-${i}`} style={{ padding: '6px 0', borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.06))' }}>
            <Line flush label={l.itemName} sub={`${l.unit}${l.unit !== l.stockUnit ? ` · ${fmtQty(l.qtyInStockUnit)} ${l.stockUnit}` : ''} · £${l.value.toFixed(2)}`}>
              <QtyStepper label={l.itemName} value={l.qty} onChange={(v) => set(i, { qty: v })} disabled={e.locked} />
            </Line>
            <PillRow
              small
              options={WASTE_REASON_NAMES.map((r) => ({ value: r, label: r }))}
              selected={l.reason}
              onSelect={(r) => set(i, { reason: r })}
              disabled={e.locked}
            />
          </div>
        ))}
        <FieldRow label="Value">£{total.toFixed(2)}</FieldRow>
      </>
    ),
  };
}

function onHandBody(p: ProposalOf<'on-hand'>, e: Editable): View {
  const d = e.draft as PayloadByTask['on-hand'];
  const quick = d.route === 'quick-count';
  return {
    title: quick ? 'Count one item' : FLOOR_TASKS['on-hand'].confirm.title,
    subtitle: quick ? `Quick count on ${d.countListName}. Nothing else changes.` : undefined,
    confirmLabel: quick ? 'Submit count' : 'Update',
    node: (
      <>
        <Line label={d.itemName} sub={`Was ${fmtQty(d.from)} ${d.unit}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <QtyStepper label={d.itemName} value={d.to} onChange={(v) => e.setDraft({ ...d, to: v })} disabled={e.locked} step={d.unit === 'kg' || d.unit === 'L' ? 0.5 : 1} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.unit}</span>
          </span>
        </Line>
      </>
    ),
  };
}

function hotAddBody(p: ProposalOf<'hot-add'>, e: Editable): View {
  const d = e.draft as PayloadByTask['hot-add'];
  return {
    title: FLOOR_TASKS['hot-add'].confirm.title,
    subtitle: `${d.stationName} · ${d.batchLabel}`,
    invalid: d.lines.some((l) => l.add < 1) ? 'Each line needs at least 1.' : d.lines.some((l) => l.newMade > 1000) ? 'Up to 1000 per line.' : undefined,
    node: (
      <>
        {d.lines.map((l, i) => (
          <Line key={l.recipeId} label={l.recipeName} sub={`${l.existingMade ?? 0} made so far, ${l.newMade} after`}>
            <QtyStepper
              label={l.recipeName}
              value={l.add}
              min={1}
              max={1000}
              disabled={e.locked}
              onChange={(v) =>
                e.setDraft({ ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, add: v, newMade: (x.existingMade ?? 0) + v } : x)) })
              }
            />
          </Line>
        ))}
      </>
    ),
  };
}

function productionBody(p: ProposalOf<'production-step'>): View {
  const d = p.payload;
  return {
    title: d.action === 'start' ? 'Start production' : 'Mark production done',
    subtitle: d.benchName,
    confirmLabel: d.action === 'start' ? 'Start' : 'Mark done',
    node: <Line label={d.recipeName} sub={`${d.planned} planned`}>{d.action === 'start-and-complete' ? 'Start and finish' : d.action === 'start' ? 'Start' : 'Finish'}</Line>,
  };
}

function parBody(p: ProposalOf<'par-level'>, e: Editable): View {
  const d = e.draft as PayloadByTask['par-level'];
  return {
    title: 'Set par level',
    node: (
      <>
        <Line label={d.itemName} sub={`Now ${d.from === null ? 'not set' : `${fmtQty(d.from)} ${d.unit}`}`}>
          <QtyStepper label={d.itemName} value={d.to} onChange={(v) => e.setDraft({ ...d, to: v })} disabled={e.locked} />
        </Line>
      </>
    ),
  };
}

function requestBody(p: ProposalOf<'transfer-request'>, e: Editable): View {
  const d = e.draft as PayloadByTask['transfer-request'];
  return {
    title: 'Request stock',
    subtitle: `From ${d.fulfillingSiteName}`,
    invalid: d.lines.some((l) => !(l.qty > 0)) ? 'Each line needs a quantity above 0.' : undefined,
    node: (
      <>
        {d.lines.map((l, i) => (
          <Line key={l.itemId} label={l.itemName} sub={l.unit}>
            <QtyStepper label={l.itemName} value={l.qty} disabled={e.locked} onChange={(v) => e.setDraft({ ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, qty: v } : x)) })} />
          </Line>
        ))}
      </>
    ),
  };
}

function quickCountBody(p: ProposalOf<'quick-count-start'>): View {
  const d = p.payload;
  return {
    title: d.resume ? 'Carry on counting' : 'Start a quick count',
    subtitle: `${d.countListName} · ${d.itemCount} items`,
    confirmLabel: d.resume ? 'Carry on' : 'Start count',
    node: null,
  };
}

function checklistBody(p: ProposalOf<'checklist-answer'>, e: Editable): View {
  const d = e.draft as PayloadByTask['checklist-answer'];
  const field =
    d.responseType === 'checkbox' ? (
      <PillRow options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} selected={d.answer} onSelect={(v) => e.setDraft({ ...d, answer: v })} disabled={e.locked} />
    ) : d.responseType === 'temperature' || d.responseType === 'number' ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <QtyStepper label={d.questionName} value={Number(d.answer)} min={-100} max={1000} onChange={(v) => e.setDraft({ ...d, answer: String(v) })} disabled={e.locked} />
        {d.responseType === 'temperature' && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>°C</span>}
      </span>
    ) : null;
  const n = Number(d.answer);
  return {
    title: 'Answer checklist',
    subtitle: d.checklistName,
    confirmLabel: 'Save',
    invalid: d.responseType === 'temperature' && (n < -100 || n > 1000) ? 'Temperatures need to be between -100 and 1000 °C.' : undefined,
    node: (
      <>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>{d.questionName}</div>
        {field ?? <TextField label="Answer" value={d.answer} onChange={(v) => e.setDraft({ ...d, answer: v })} disabled={e.locked} />}
        {d.followUp && (
          <TextField
            label={d.followUp.questionName}
            value={d.followUp.answer}
            onChange={(v) => e.setDraft({ ...d, followUp: { ...d.followUp!, answer: v } })}
            disabled={e.locked}
          />
        )}
      </>
    ),
  };
}

function basketBody(p: ProposalOf<'basket-add'>, e: Editable): View {
  const d = e.draft as PayloadByTask['basket-add'];
  return {
    title: 'Add to the order',
    subtitle: `${d.supplierName} order`,
    confirmLabel: 'Add to order',
    invalid: d.packs < 1 ? 'At least 1.' : undefined,
    node: (
      <>
        <Line label={d.productName} sub={`${d.orderUnitPlural} of ${fmtQty(d.packSize)} ${d.stockUnit} · £${(d.packs * d.unitPrice).toFixed(2)}`}>
          <QtyStepper label={d.productName} value={d.packs} min={1} onChange={(v) => e.setDraft({ ...d, packs: Math.round(v) })} disabled={e.locked} />
        </Line>
      </>
    ),
  };
}

function deliveryBody(p: ProposalOf<'delivery-accept'>, e: Editable): View {
  const d = e.draft as PayloadByTask['delivery-accept'];
  const short = d.lines.filter((l) => l.received < l.ordered);
  const spec = FLOOR_TASKS['delivery-accept'].confirm;
  return {
    title: spec.title,
    subtitle: `${d.supplierName} · ${d.poNumber} · ${d.lines.length} lines`,
    confirmLabel: spec.button,
    warnings: [
      ...new Set([
        ...p.warnings.filter((w) => w !== 'Any remaining quantity stays pending.'),
        ...(short.length ? ['Any remaining quantity stays pending.'] : []),
      ]),
    ],
    invalid: d.requiresReference && !d.supplierReference?.trim() ? 'Delivery must include a Supplier Reference' : undefined,
    node: (
      <>
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {d.lines.map((l, i) => (
            <Line key={l.id} flush={i === 0} label={l.name} sub={`Ordered ${l.ordered} ${l.unit}${l.received < l.ordered ? ` · ${l.ordered - l.received} short` : ''}`}>
              <QtyStepper
                label={l.name}
                value={l.received}
                max={l.ordered}
                tone={l.received < l.ordered ? 'warning' : 'default'}
                disabled={e.locked}
                onChange={(v) => e.setDraft({ ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, received: Math.min(v, x.ordered) } : x)) })}
              />
            </Line>
          ))}
        </div>
        <TextField
          label={d.requiresReference ? 'Supplier reference (needed)' : 'Supplier reference'}
          value={d.supplierReference ?? ''}
          onChange={(v) => e.setDraft({ ...d, supplierReference: v })}
          disabled={e.locked}
          placeholder="Invoice or delivery note number"
        />
        {short.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '40px', marginTop: '6px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
            <input
              type="checkbox"
              checked={d.requestCredit}
              disabled={e.locked}
              onChange={(ev) => e.setDraft({ ...d, requestCredit: ev.target.checked })}
              style={{ width: '20px', height: '20px' }}
            />
            Request credit for the short lines. This emails {d.supplierName}&apos;s accounts address.
          </label>
        )}
      </>
    ),
  };
}

function transferSendBody(p: ProposalOf<'transfer-send'>, e: Editable): View {
  const d = e.draft as PayloadByTask['transfer-send'];
  const over = d.lines.filter((l) => l.qty > l.onHand);
  const spec = FLOOR_TASKS['transfer-send'].confirm;
  return {
    title: over.length ? spec.flaggedTitle : spec.title,
    subtitle: `To ${d.toSiteName}`,
    confirmLabel: over.length ? spec.flaggedButton : spec.button,
    warnings: over.map((l) => `More ${l.itemName} than you have: ${fmtQty(l.onHand)} ${l.unit} on hand.`),
    invalid: d.lines.some((l) => !(l.qty > 0)) ? 'Each line needs a quantity above 0.' : undefined,
    node: (
      <>
        {d.lines.map((l, i) => (
          <Line key={l.itemId} label={l.itemName} sub={`${l.unit} · ${fmtQty(l.onHand)} on hand`}>
            <QtyStepper label={l.itemName} value={l.qty} disabled={e.locked} onChange={(v) => e.setDraft({ ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, qty: v } : x)) })} />
          </Line>
        ))}
      </>
    ),
  };
}

function transferAcceptBody(p: ProposalOf<'transfer-accept'>, e: Editable): View {
  const d = e.draft as PayloadByTask['transfer-accept'];
  const spec = FLOOR_TASKS['transfer-accept'].confirm;
  const setLine = (i: number, patch: Partial<PayloadByTask['transfer-accept']['lines'][number]>) =>
    e.setDraft({ ...d, lines: d.lines.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return {
    title: spec.title,
    subtitle: `${d.transferNumber} from ${d.fromSiteName}`,
    confirmLabel: spec.button,
    invalid: d.lines.some((l) => l.received < l.sent && !l.reason) ? 'Pick a reason for each line not fully received.' : undefined,
    node: (
      <>
        {d.lines.map((l, i) => (
          <div key={l.id} style={{ paddingBottom: '6px' }}>
            <Line label={l.itemName} sub={`Sent ${fmtQty(l.sent)} ${l.unit}`}>
              <QtyStepper label={l.itemName} value={l.received} max={l.sent} disabled={e.locked} onChange={(v) => setLine(i, { received: Math.min(v, l.sent), reason: v >= l.sent ? undefined : l.reason })} />
            </Line>
            {l.received < l.sent && (
              <PillRow
                small
                options={REJECTION_REASONS.map((r) => ({ value: r, label: r }))}
                selected={l.reason}
                onSelect={(r) => setLine(i, { reason: r as RejectionReason })}
                disabled={e.locked}
              />
            )}
          </div>
        ))}
      </>
    ),
  };
}

function demandBody(p: ProposalOf<'demand-adjustment'>, e: Editable): View {
  const d = e.draft as PayloadByTask['demand-adjustment'];
  return {
    title: 'One-off change',
    subtitle: FLOOR_TASKS['demand-adjustment'].confirm.body,
    confirmLabel: 'Confirm',
    invalid: d.percentOfDemand < 0 || d.percentOfDemand > 300 ? 'Between 0 and 300% of usual.' : !d.reason.trim() ? 'Add what\'s happening.' : undefined,
    node: (
      <>
        <FieldRow label="Days">{d.startDate === d.endDate ? d.startDate : `${d.startDate} to ${d.endDate}`}</FieldRow>
        <Line label="Busier or quieter" sub="100% is a usual day">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <QtyStepper label="percentage of a usual day" value={d.percentOfDemand} max={300} step={10} onChange={(v) => e.setDraft({ ...d, percentOfDemand: Math.min(300, v) })} disabled={e.locked} />
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>%</span>
          </span>
        </Line>
        <TextField label="What's happening" value={d.reason} onChange={(v) => e.setDraft({ ...d, reason: v })} disabled={e.locked} />
      </>
    ),
  };
}

function undoBody(p: ProposalOf<'undo'>, e: Editable): View {
  const d = e.draft as PayloadByTask['undo'];
  const needsReason = d.targetTaskId === 'waste';
  return {
    title: needsReason ? 'Delete waste' : 'Undo',
    subtitle: d.receiptHeadline,
    confirmLabel: needsReason ? 'Delete' : 'Undo',
    invalid: needsReason && (d.reason ?? '').trim().length < 3 ? 'Why are you deleting this? At least 3 characters.' : undefined,
    node: needsReason ? (
      <TextField label="Why are you deleting this?" value={d.reason ?? ''} onChange={(v) => e.setDraft({ ...d, reason: v })} disabled={e.locked} placeholder="Wrong item, counted twice" />
    ) : null,
  };
}

export function proposalSummary(p: Proposal): string {
  if (p.taskId === 'waste') return p.payload.lines.map((l) => itemPhrase(l.qty, l.unit, l.itemName)).join(', ');
  return p.label;
}
