'use client';

import { useState, type CSSProperties } from 'react';
import { CheckCircle2, Image as ImageIcon, Pencil, Plus, X } from 'lucide-react';
import { PRICE_TOLERANCE_PCT, docNoun, priceChangePct, type PoLinePlan, type SampleDocument } from './fixtures';
import { MatchedOrders, paperDate } from './MatchedOrders';
import { linePrice, paperLine, type WritePlan } from './resolve';
import type { AddedLine, Decisions } from './types';
import { PrimaryButton, SecondaryButton, StepHeading, cardStyle, gbp } from './ui';

type Problem = 'damaged' | 'short';
/** Lines whose quantity matched the order. A price-held line still matched on quantity, it only has a price waiting for an admin. */
export type MatchedPlan = Extract<PoLinePlan, { kind: 'clean' | 'price-held' }>;

const QTY_W = 112;

const smallInput: CSSProperties = {
  height: 40, padding: '0 10px', borderRadius: 'var(--radius-item)', border: '1px solid var(--color-border)',
  fontFamily: 'var(--font-primary)', fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', background: '#fff', outline: 'none',
};

const fieldLabel: CSSProperties = {
  display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-secondary)',
};

const quietLink: CSSProperties = {
  minHeight: 40, padding: 0, background: 'none', border: 'none', fontFamily: 'var(--font-primary)',
  fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deep)', textDecoration: 'underline', cursor: 'pointer',
};

/** Compact minus / number / plus, the same control the normal receiving screen uses, sized for a list row. */
function QtyInput({ label, value, max, onChange }: { label: string; value: number; max?: number; onChange: (n: number) => void }) {
  const btn = (disabled: boolean): CSSProperties => ({
    width: 36, height: 40, border: 'none', background: 'var(--color-bg-hover)', fontSize: 20, fontWeight: 600,
    fontFamily: 'var(--font-primary)', color: disabled ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  });
  const atMax = max != null && value >= max;
  return (
    <div role="group" aria-label={`Quantity for ${label}`} style={{ display: 'inline-flex', alignItems: 'center', width: QTY_W, flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-item)', overflow: 'hidden' }}>
      <button type="button" aria-label={`One fewer ${label}`} disabled={value <= 0} onClick={() => onChange(value - 1)} style={btn(value <= 0)}>−</button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`${label} quantity`}
        value={value}
        onChange={e => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n) && n >= 0) onChange(max != null ? Math.min(n, max) : n);
          else if (e.target.value === '') onChange(0);
        }}
        style={{ width: 40, height: 40, border: 'none', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)', textAlign: 'center', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', background: '#fff', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
      />
      <button type="button" aria-label={`One more ${label}`} disabled={atMax} onClick={() => onChange(value + 1)} style={btn(atMax)}>+</button>
    </div>
  );
}

/** "£1.05" in, number out. Accepts a leading £ and commas. */
function parsePrice(s: string): number | null {
  const n = Number(s.replace(/[£,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? +n.toFixed(2) : null;
}

/**
 * Lines that matched their order line. The quantity is live: turn it down and
 * Edify asks what happened to the rest, then the delivery goes through review
 * like any other difference. The pencil opens the price, for when the paper
 * shows a new one or the note prints none.
 */
export function CleanLineList({
  doc, plans, decisions, onReport, onPrice,
}: {
  doc: SampleDocument;
  plans: MatchedPlan[];
  decisions: Decisions;
  onReport: (lineId: string, problem: Problem, affected: number) => void;
  onPrice: (lineId: string, price: number | undefined) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const priced = doc.kind !== 'delivery-note';
  const noun = docNoun(doc);

  const openPrice = (lineId: string, current: number) => {
    if (editing === lineId) { setEditing(null); return; }
    setEditing(lineId);
    setPriceDraft(current.toFixed(2));
  };

  const commitPrice = (lineId: string, paperPrice: number) => {
    const n = parsePrice(priceDraft);
    if (n == null) { setPriceDraft(linePrice(paperLine(doc, lineId), decisions[lineId]).toFixed(2)); return; }
    onPrice(lineId, Math.abs(n - paperPrice) < 0.005 ? undefined : n);
  };

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {plans.map((p, i) => {
        const paper = paperLine(doc, p.lineId);
        const d = decisions[p.lineId];
        const price = linePrice(paper, d);
        const pct = priceChangePct(p.poPrice, price);
        const moved = Math.abs(pct) > 0.001;
        const held = p.kind === 'price-held';
        const current = qty[p.lineId] ?? paper.qty;
        const reduced = current < paper.qty;
        const missing = paper.qty - current;
        const isEditing = editing === p.lineId;
        const name = paper.text;
        return (
          <li key={p.lineId} data-testid={`clean-${p.lineId}`} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border-subtle)', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <QtyInput label={name} value={current} max={paper.qty} onChange={n => setQty(prev => ({ ...prev, [p.lineId]: n }))} />
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{name}</span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: held ? '#7A3800' : 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {held
                    ? `${gbp(price)} each is ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(0)}% on the order. Over your ${PRICE_TOLERANCE_PCT}% tolerance, so it comes in at ${gbp(p.poPrice)} until an admin approves the change.`
                    : priced || d?.price != null
                      ? <>{gbp(price)} each{d?.price != null && ', corrected at the door'}{moved && ` · was ${gbp(p.poPrice)}, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(0)}%, inside your ${PRICE_TOLERANCE_PCT}% tolerance`}</>
                      : `${gbp(price)} each, the order price`}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Edit price for ${name}`}
                aria-expanded={isEditing}
                data-testid={`edit-${p.lineId}`}
                onClick={() => openPrice(p.lineId, price)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 40, height: 40,
                  borderRadius: '50%', border: 'none', cursor: 'pointer', color: 'var(--color-accent-deep)',
                  background: isEditing ? 'rgba(40,175,201,0.14)' : 'transparent',
                }}
              >
                <Pencil size={16} aria-hidden />
              </button>
            </div>

            {isEditing && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 10, paddingLeft: QTY_W + 12 }}>
                <label style={{ flex: 1 }}>
                  <span style={fieldLabel}>Price each</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceDraft}
                    autoFocus
                    data-testid={`price-${p.lineId}`}
                    onChange={e => setPriceDraft(e.target.value)}
                    onBlur={() => commitPrice(p.lineId, paper.unitPrice)}
                    onKeyDown={e => { if (e.key === 'Enter') { commitPrice(p.lineId, paper.unitPrice); setEditing(null); } }}
                    style={{ ...smallInput, width: '100%', maxWidth: 140 }}
                  />
                </label>
                <span style={{ flex: 2, paddingBottom: 10, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {priced ? `${gbp(paper.unitPrice)} on the ${noun}, ` : `The ${noun} prints no price. `}order price {gbp(p.poPrice)}.
                </span>
              </div>
            )}

            {reduced && (
              <div role="group" aria-label={`What happened to the other ${missing} ${name}`} style={{ marginTop: 10, paddingLeft: QTY_W + 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                  {paper.qty} on the {noun}, {current} arrived. What happened to the other {missing}?
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <SecondaryButton onClick={() => onReport(p.lineId, 'damaged', missing)} testId={`report-damaged-${p.lineId}`}>Damaged</SecondaryButton>
                  <SecondaryButton onClick={() => onReport(p.lineId, 'short', missing)} testId={`report-short-${p.lineId}`}>Not on the van</SecondaryButton>
                  <button type="button" onClick={() => setQty(prev => ({ ...prev, [p.lineId]: paper.qty }))} style={{ ...quietLink, marginLeft: 'auto' }}>
                    Back to {paper.qty}
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Items the GM added at the door, plus the form to add another. */
export function AddedLines({
  doc, added, onAdd, onRemove,
}: {
  doc: SampleDocument;
  added: AddedLine[];
  onAdd: (line: Omit<AddedLine, 'id'>) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState('');
  const noun = docNoun(doc);

  const parsed = parsePrice(price);
  const canAdd = name.trim().length > 0 && qty > 0 && parsed != null;

  const reset = () => { setName(''); setQty(1); setPrice(''); setOpen(false); };
  const submit = () => {
    if (!canAdd || parsed == null) return;
    onAdd({ name: name.trim(), qty, unitPrice: parsed });
    reset();
  };

  return (
    <div style={{ borderTop: added.length || open ? '1px solid var(--color-border-subtle)' : 'none', marginTop: added.length || open ? 4 : 0 }}>
      {added.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {added.map(a => (
            <li key={a.id} data-testid={`added-${a.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ width: QTY_W, flexShrink: 0, textAlign: 'right', paddingRight: 48, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.35, boxSizing: 'border-box' }}>
                {a.qty}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.35 }}>{a.name}</span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {gbp(a.unitPrice)} each · not on the {noun}, added at the door
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => onRemove(a.id)}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              >
                <X size={18} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          onSubmit={e => { e.preventDefault(); submit(); }}
          aria-label={`Add an item that isn't on the ${noun}`}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0 4px' }}
        >
          <label>
            <span style={fieldLabel}>What arrived</span>
            <input
              type="text"
              value={name}
              autoFocus
              data-testid="add-name"
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Oat milk 1L"
              style={{ ...smallInput, width: '100%', boxSizing: 'border-box', fontWeight: 500 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <span style={fieldLabel}>How many</span>
              <QtyInput label={name || 'the new item'} value={qty} onChange={setQty} />
            </div>
            <label style={{ flex: 1, minWidth: 120 }}>
              <span style={fieldLabel}>Price each</span>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                data-testid="add-price"
                onChange={e => setPrice(e.target.value)}
                placeholder="£0.00"
                style={{ ...smallInput, width: '100%', boxSizing: 'border-box' }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SecondaryButton onClick={submit} testId="add-confirm">Add to the delivery</SecondaryButton>
            <button type="button" onClick={reset} style={quietLink}>Cancel</button>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
            Goes on the GRN as an extra, not on the {noun} or any order, and is flagged for finance.
          </p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="add-item"
          style={{ ...quietLink, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', marginTop: 4 }}
        >
          <Plus size={16} aria-hidden /> Add an item that isn&apos;t on the {noun}
        </button>
      )}
    </div>
  );
}

export default function CleanStep({
  doc, plans, plan, decisions, added, onOpenPhoto, onReport, onPrice, onAdd, onRemoveAdded, onAccept, onChangeOrders,
}: {
  doc: SampleDocument;
  plans: MatchedPlan[];
  plan: WritePlan;
  decisions: Decisions;
  added: AddedLine[];
  onOpenPhoto: () => void;
  onReport: (lineId: string, problem: Problem, affected: number) => void;
  onPrice: (lineId: string, price: number | undefined) => void;
  onAdd: (line: Omit<AddedLine, 'id'>) => void;
  onRemoveAdded: (id: string) => void;
  onAccept: () => void;
  onChangeOrders: () => void;
}) {
  const orders = plan.pos.map(p => p.poNumber).join(' and ');
  const noun = docNoun(doc);
  return (
    <div>
      <StepHeading
        title="Everything matches"
        sub={`${doc.supplierName} ${noun} ${doc.docNumber}, dated ${paperDate(doc.printedDate)}. All ${plans.length} lines are what ${orders} ordered, in the quantities ordered.`}
      />

      <MatchedOrders doc={doc} plans={plans} pos={plan.pos} onChange={onChangeOrders} />

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <CheckCircle2 size={20} aria-hidden style={{ color: 'var(--color-success)' }} />
          <h2 style={{ margin: 0, flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{plans.length} lines, as ordered</h2>
          <SecondaryButton icon={<ImageIcon size={16} aria-hidden />} onClick={onOpenPhoto}>Photo</SecondaryButton>
        </div>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
          Quantities as the {noun} lists them. Count what&apos;s on the floor: turn a number down if fewer arrived, tap the pencil if the price has changed.
        </p>
        <CleanLineList doc={doc} plans={plans} decisions={decisions} onReport={onReport} onPrice={onPrice} />
        <AddedLines doc={doc} added={added} onAdd={onAdd} onRemove={onRemoveAdded} />
      </div>

      <PrimaryButton onClick={onAccept} testId="accept-clean">
        {added.length > 0 ? `Accept delivery, ${added.length} item${added.length === 1 ? '' : 's'} added` : 'Accept delivery'}
      </PrimaryButton>
    </div>
  );
}
