'use client';

import { Info } from 'lucide-react';
import { MOCK_POS } from '@/components/Receiving/mockData';
import {
  INVOICE_CANDIDATE_PO_IDS,
  INVOICE_PLANS,
  INVOICE_SKIPPED_POS,
  type SampleDocument,
} from './fixtures';
import { paperLine } from './resolve';
import { PrimaryButton, StepHeading, cardStyle, sectionLabel } from './ui';

/** Which invoice lines each PO explains, including lines that could belong to either. */
function linesExplainedBy(doc: SampleDocument, poId: string): { sure: string[]; maybe: string[] } {
  const sure: string[] = [];
  const maybe: string[] = [];
  for (const p of INVOICE_PLANS) {
    if (p.kind === 'extra') continue;
    const text = paperLine(doc, p.lineId).text;
    if (p.kind === 'ambiguous') {
      if (p.candidates.some(c => c.poId === poId)) maybe.push(text);
    } else if (p.poId === poId) {
      sure.push(text);
    }
  }
  return { sure, maybe };
}

export default function WhichOrdersStep({
  doc, selected, onChange, onContinue,
}: {
  doc: SampleDocument;
  selected: string[];
  onChange: (ids: string[]) => void;
  onContinue: () => void;
}) {
  const candidates = MOCK_POS.filter(p => INVOICE_CANDIDATE_PO_IDS.includes(p.id));
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const unmatched = INVOICE_PLANS.filter(p => p.kind === 'extra').map(p => paperLine(doc, p.lineId).text);
  const orphaned = INVOICE_PLANS.filter(p => {
    if (p.kind === 'extra') return false;
    if (p.kind === 'ambiguous') return !p.candidates.some(c => selected.includes(c.poId));
    return !selected.includes(p.poId);
  }).length;

  return (
    <div>
      <StepHeading
        title="Which orders does this cover?"
        sub={`Edify found ${candidates.length} open ${doc.supplierName} orders that this invoice delivers against. Untick any that it doesn't.`}
      />

      <fieldset aria-label="Orders this invoice covers" style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {candidates.map(po => {
          const on = selected.includes(po.id);
          const { sure, maybe } = linesExplainedBy(doc, po.id);
          const notOnInvoice = po.lines.filter(l =>
            !INVOICE_PLANS.some(p =>
              (p.kind !== 'extra' && p.kind !== 'ambiguous' && p.poLineId === l.id) ||
              (p.kind === 'ambiguous' && p.candidates.some(c => c.poLineId === l.id)),
            ),
          );
          return (
            <label
              key={po.id}
              style={{
                ...cardStyle,
                display: 'flex', gap: 12, cursor: 'pointer',
                borderColor: on ? 'var(--color-accent-active)' : 'var(--color-border-subtle)',
                borderWidth: on ? 1.5 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(po.id)}
                aria-label={po.poNumber}
                style={{ flexShrink: 0, width: 22, height: 22, margin: '2px 0 0', accentColor: 'var(--color-accent-active)', cursor: 'pointer' }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>{po.poNumber}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Sent {po.dateSent} · {po.lines.length} lines</span>
                </span>
                <span style={{ display: 'block', fontSize: 14, color: 'var(--color-text-primary)', marginTop: 6, lineHeight: 1.45 }}>
                  Explains {sure.length} line{sure.length === 1 ? '' : 's'} on the invoice: {sure.join(', ')}.
                </span>
                {maybe.length > 0 && (
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Could also explain &ldquo;{maybe.join(', ')}&rdquo;. You&apos;ll pick on the next screen.
                  </span>
                )}
                {notOnInvoice.length > 0 && (
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Not on this invoice: {notOnInvoice.map(l => l.name).join(', ')}.
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {unmatched.length > 0 && (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-primary)', display: 'flex', gap: 8 }}>
            <Info size={18} aria-hidden style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }} />
            {unmatched.join(', ')} isn&apos;t on any order. You&apos;ll decide on it next.
          </p>
        )}
        {INVOICE_SKIPPED_POS.map(s => (
          <p key={s.poNumber} style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', display: 'flex', gap: 8 }}>
            <Info size={18} aria-hidden style={{ flexShrink: 0 }} />
            {s.poNumber}: {s.reason}
          </p>
        ))}
      </div>

      {orphaned > 0 && selected.length > 0 && (
        <div role="status" style={{ ...cardStyle, marginTop: 16, background: 'var(--color-warning-light)', borderColor: 'var(--color-warning-border)', fontSize: 14 }}>
          {orphaned} line{orphaned === 1 ? '' : 's'} on the invoice won&apos;t match an order. They&apos;ll come through as extras for you to accept or send back.
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--color-bg-surface)', padding: '16px 0 8px', marginTop: 16 }}>
        <p style={{ ...sectionLabel, textAlign: 'center' }}>
          {selected.length === 0 ? 'Tick at least one order' : `${selected.length} order${selected.length === 1 ? '' : 's'} ticked`}
        </p>
        <PrimaryButton disabled={selected.length === 0} onClick={onContinue} testId="orders-continue">
          Match lines to {selected.length === 1 ? 'this order' : 'these orders'}
        </PrimaryButton>
      </div>
    </div>
  );
}
