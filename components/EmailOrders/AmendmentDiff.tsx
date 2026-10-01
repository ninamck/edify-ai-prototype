'use client';

/**
 * AmendmentDiff — what an update email did (or will do) to a ticket on
 * the till. Shows the whole ticket with the changed lines highlighted and
 * the totals before and after, so a GM sees the full order, not just the
 * two items that moved.
 *
 * `current` is the ticket after the change; `added` are the deltas from
 * the update email(s). Amendments in this prototype only add quantity.
 * Removals would need a signed qty; the "was → now" layout already copes
 * with that, so it is a data change, not a design change.
 */

import { ArrowRight, Check } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import type { EmailOrderLine } from './types';

type DiffLine = {
  key: string;
  line: EmailOrderLine;
  was: number;
  now: number;
};

const gbp = (n: number) => `\u00a3${n.toFixed(2)}`;

function lineKey(l: EmailOrderLine): string {
  return l.match?.posItemId ?? l.itemAsWritten.trim().toLowerCase();
}

/** Work back from the current ticket and the deltas to get before/after per line. */
export function diffLines(current: EmailOrderLine[], added: EmailOrderLine[]): DiffLine[] {
  const rows: DiffLine[] = current.map((line) => ({ key: lineKey(line), line, was: line.qty, now: line.qty }));
  for (const add of added) {
    const hit = rows.find((r) => r.key === lineKey(add));
    if (hit) hit.was -= add.qty;
    else rows.push({ key: lineKey(add), line: add, was: 0, now: add.qty }); // delta not yet in current
  }
  return rows;
}

export default function AmendmentDiff({
  current,
  added,
  ticketRef,
  applied,
}: {
  current: EmailOrderLine[];
  added: EmailOrderLine[];
  ticketRef?: string;
  /** True once the change is on the till; false while it waits for the operator. */
  applied: boolean;
}) {
  const rows = diffLines(current, added);
  const wasItems = rows.reduce((n, r) => n + r.was, 0);
  const nowItems = rows.reduce((n, r) => n + r.now, 0);
  const wasValue = rows.reduce((n, r) => n + r.was * r.line.unitPrice, 0);
  const nowValue = rows.reduce((n, r) => n + r.now * r.line.unitPrice, 0);
  const changed = rows.filter((r) => r.was !== r.now);
  const deltaItems = nowItems - wasItems;
  const deltaValue = nowValue - wasValue;
  const unmatched = rows.filter((r) => !r.line.match || r.line.match.confidence === 'low').length;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header: which ticket, and the one-line summary of the change. */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 14px', borderBottom: '1px solid var(--color-border)', background: '#FBFAF8',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {ticketRef ? `Ticket ${ticketRef}` : 'The ticket'}{applied ? ', as it is now' : ' after this change'}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          {applied
            ? `${changed.length === 1 ? '1 line changed' : `${changed.length} lines changed`}, ${rows.length - changed.length} stayed the same`
            : `${changed.length === 1 ? '1 line changes' : `${changed.length} lines change`}, ${rows.length - changed.length} stay the same`}
        </span>
        {/* The change, pulled out once. */}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
          {deltaItems > 0 ? '+' : ''}{deltaItems} {Math.abs(deltaItems) === 1 ? 'item' : 'items'}, {deltaValue >= 0 ? '+' : '\u2212'}{gbp(Math.abs(deltaValue))}
        </span>
      </div>

      <div style={{ ...grid, padding: '8px 14px', borderBottom: '1px solid var(--color-border)' }}>
        <Head align="right">Was</Head>
        <Head />
        <Head align="right">Now</Head>
        <Head>On the ticket</Head>
        <Head align="right">Price</Head>
        <Head>On your till</Head>
      </div>

      {rows.map((r, i) => {
        const delta = r.now - r.was;
        const isChange = delta !== 0;
        const last = i === rows.length - 1;
        const sub = [
          ...(r.line.options ?? []),
          ...(r.line.dietary && r.line.dietary.length ? [r.line.dietary.map((d) => `(${d})`).join(' ')] : []),
        ];
        const muted = isChange ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
        return (
          <div
            key={r.key}
            style={{
              ...grid,
              padding: '9px 14px',
              borderBottom: last ? 'none' : '1px solid var(--color-border)',
              background: isChange ? 'var(--color-success-light)' : '#fff',
              boxShadow: isChange ? 'inset 3px 0 0 var(--color-success)' : 'none',
            }}
          >
            <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isChange ? 'var(--color-text-muted)' : muted, textDecoration: isChange && r.was > 0 ? 'line-through' : 'none' }}>
              {r.was > 0 ? r.was : '\u2013'}
            </span>
            <span style={{ display: 'inline-flex', justifyContent: 'center' }}>
              {isChange && <ArrowRight size={13} color="var(--color-success)" strokeWidth={2.4} />}
            </span>
            <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isChange ? 'var(--color-success)' : muted }}>
              {r.now}
              {isChange && (
                <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 4 }}>({delta > 0 ? '+' : ''}{delta})</span>
              )}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: isChange ? 600 : 500, color: muted }}>
                {r.line.itemAsWritten}
                {r.was === 0 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--color-success)', letterSpacing: '0.04em' }}>NEW</span>}
              </div>
              {sub.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 1 }}>{sub.join(' \u00b7 ')}</div>}
            </div>
            <span style={{ textAlign: 'right', fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
              {gbp(r.line.unitPrice)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: muted }}>
              {r.line.match ? (
                <>
                  {r.line.match.by === 'operator'
                    ? <Check size={12} color="var(--color-success)" strokeWidth={2.6} />
                    : <EdifyMark size={12} color={isChange ? 'var(--color-accent-active)' : 'var(--color-text-muted)'} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.line.match.posItemName}</span>
                </>
              ) : (
                <span style={{ color: 'var(--color-warning)' }}>Not matched</span>
              )}
            </span>
          </div>
        );
      })}

      {/* Totals row, laid out like every other order's: count, lines, total, match status. */}
      <div style={{ ...grid, padding: '9px 14px', borderTop: '1px solid var(--color-border)' }}>
        <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
          {wasItems}
        </span>
        <span style={{ display: 'inline-flex', justifyContent: 'center' }}>
          <ArrowRight size={13} color="var(--color-text-muted)" strokeWidth={2.4} />
        </span>
        <span style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{nowItems}</span>
        <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
          {rows.length} {rows.length === 1 ? 'line' : 'lines'}
        </span>
        <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{gbp(nowValue)}</span>
        <span style={{ fontSize: 12.5, color: unmatched > 0 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
          {unmatched > 0 ? `${unmatched} to match` : `${rows.length} of ${rows.length} matched`}
        </span>
      </div>
    </div>
  );
}

function Head({ children, align }: { children?: React.ReactNode; align?: 'right' }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', textAlign: align }}>
      {children}
    </span>
  );
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px 20px 56px minmax(0, 1.6fr) 72px minmax(0, 1.3fr)',
  columnGap: 12,
  alignItems: 'center',
};
