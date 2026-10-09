'use client';

import { CheckCircle2, ClipboardList, FileText } from 'lucide-react';
import type { PO } from '@/components/Receiving/mockData';
import { SITE, docNoun, type PoLinePlan, type SampleDocument } from './fixtures';
import { cardStyle, sectionLabel } from './ui';

/** "08/04/2026" on the paper becomes "8 Apr 2026", matching how orders show their dates. */
export function paperDate(printed: string): string {
  const m = printed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return printed;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** How many lines on the paper Edify placed on each order. */
function linesOn(plans: PoLinePlan[], poId: string): number {
  return plans.filter(p => 'poId' in p && p.poId === poId).length;
}

/**
 * The evidence behind the match: what the paper says it is, and which
 * orders Edify matched it to. Shown before any line, so the GM can see
 * it's the right supplier and the right orders before trusting the rest.
 */
export function MatchedOrders({
  doc, plans, pos, onChange,
}: {
  doc: SampleDocument;
  plans: PoLinePlan[];
  pos: PO[];
  onChange: () => void;
}) {
  const noun = docNoun(doc);
  const total = doc.lines.length;
  const row = { display: 'flex', gap: 10, alignItems: 'flex-start' } as const;
  const icon = { flexShrink: 0, marginTop: 2, color: 'var(--color-text-secondary)' } as const;

  return (
    <div data-testid="matched-orders" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
      <div style={row}>
        <FileText size={18} aria-hidden style={icon} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {doc.supplierName} {noun} {doc.docNumber}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Dated {paperDate(doc.printedDate)}, addressed to {SITE}. {total} lines.
          </p>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10 }}>
        <p style={sectionLabel}>{pos.length === 1 ? 'Matched to your order' : 'Matched to your orders'}</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pos.map(po => {
            const n = linesOn(plans, po.id);
            const all = n === total && pos.length === 1;
            return (
              <li key={po.id} style={row}>
                <ClipboardList size={18} aria-hidden style={icon} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {po.poNumber}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                    Sent to {po.supplier} on {po.dateSent}, for {po.site}. {po.lines.length} lines.
                  </p>
                  <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '6px 0 0', fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: all ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                    <CheckCircle2 size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      {all
                        ? `All ${total} lines on the ${noun} are on this order.`
                        : `${n} of the ${total} lines on the ${noun} are on this order.`}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        onClick={onChange}
        data-testid="change-orders"
        style={{
          alignSelf: 'flex-start', minHeight: 40, padding: 0, background: 'none', border: 'none',
          fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600, color: 'var(--color-accent-deep)',
          textDecoration: 'underline', cursor: 'pointer',
        }}
      >
        {pos.length === 1 ? 'Not this order? Choose another' : 'Not these orders? Choose'}
      </button>
    </div>
  );
}
