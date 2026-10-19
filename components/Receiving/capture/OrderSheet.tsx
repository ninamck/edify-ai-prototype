'use client';

import { useId, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import type { PO } from '../mockData';
import { orderOptions, paperLineCount, type OrderOption } from './match';
import type { Sample } from './samples';
import { C, keepIds, PrimaryButton, SecondaryButton, Sheet } from './ui';

// "Which order is this?": every open order at the site, best fit first, with
// how well each one fits the paper in words. Recent orders from the paper's
// supplier show straight away; older ones and other suppliers' sit under
// "More orders". Ticking two covers a delivery that brings two orders.

function shortDate(d: string) {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fitWords(o: OrderOption, n: number, kind: string) {
  if (o.covered === 0) return `None of the products on the ${kind} are on it.`;
  const has = o.covered === n ? `Has all ${n} products on the ${kind}` : `Has ${o.covered} of the ${n} products on the ${kind}`;
  return o.extra > 0 ? `${has}, plus ${o.extra} that ${o.extra === 1 ? 'isn\u2019t' : 'aren\u2019t'}.` : `${has}.`;
}

/** "PO-10495 fits this delivery note exactly", with the switch one tap away. */
export function BetterOrder({ po, sample, onUse }: { po: PO; sample: Sample; onUse: () => void }) {
  const kind = sample.kind === 'invoice' ? 'invoice' : 'delivery note';
  return (
    <div role="status" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, background: '#FFF6E5' }}>
      <AlertCircle size={18} aria-hidden style={{ flexShrink: 0, color: '#8A4B00' }} />
      <span style={{ flex: 1, minWidth: 180, fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
        {keepIds(`${po.poNumber}, sent ${shortDate(po.dateSent)}, fits this ${kind} exactly.`)}
      </span>
      <button
        type="button"
        onClick={onUse}
        style={{ minHeight: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: C.navy, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer' }}
      >
        {keepIds(`Check against ${po.poNumber}`)}
      </button>
    </div>
  );
}

export default function OrderSheet({ sample, isPhone, onPick, onClose }: { sample: Sample; isPhone: boolean; onPick: (orders: string[]) => void; onClose: () => void }) {
  const options = useMemo(() => orderOptions(sample), [sample]);
  const [ticked, setTicked] = useState<string[]>(sample.poNumbers);
  const [showMore, setShowMore] = useState(() => options.some(o => o.current && !(o.sameSupplier && o.recent)));
  const moreId = useId();
  const kind = sample.kind === 'invoice' ? 'invoice' : 'delivery note';
  const n = paperLineCount(sample);
  const main = options.filter(o => o.sameSupplier && o.recent);
  const more = options.filter(o => !main.includes(o));
  const unchanged = ticked.length === sample.poNumbers.length && ticked.every(p => sample.poNumbers.includes(p));

  const toggle = (po: string) => setTicked(prev => (prev.includes(po) ? prev.filter(p => p !== po) : [...prev, po]));
  const label =
    ticked.length === 0 ? 'Tick an order' : unchanged ? `Keep ${ticked.join(' and ')}` : ticked.length === 1 ? `Check against ${ticked[0]}` : `Check against ${ticked.length} orders`;

  const row = (o: OrderOption, showSupplier: boolean) => {
    const on = ticked.includes(o.po.poNumber);
    return (
      <label
        key={o.po.id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 12,
          border: on ? `2px solid ${C.navy}` : `1.5px solid ${C.border}`,
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={on}
          onChange={() => toggle(o.po.poNumber)}
          style={{ width: 20, height: 20, margin: '2px 0 0', accentColor: '#001C35', flexShrink: 0, cursor: 'pointer' }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
            {keepIds(o.po.poNumber)}
            {o.current && <span style={{ fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 100, background: C.page, color: C.ink }}>Checking against now</span>}
          </span>
          <span style={{ display: 'block', fontSize: 14, color: C.muted, lineHeight: 1.45, marginTop: 2 }}>
            {showSupplier ? `${o.po.supplier} \u00b7 ` : ''}Sent {shortDate(o.po.dateSent)}. {fitWords(o, n, kind)}
          </span>
        </span>
      </label>
    );
  };

  return (
    <Sheet
      title="Which order is this?"
      subtitle={`Tick the order this ${kind} is for. If it brings two orders, tick both.`}
      isPhone={isPhone}
      width={540}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryButton disabled={ticked.length === 0} onClick={() => (unchanged ? onClose() : onPick(ticked))}>
            {keepIds(label)}
          </PrimaryButton>
          <SecondaryButton onClick={() => onPick([])}>It isn&rsquo;t on any order</SecondaryButton>
        </div>
      }
    >
      <h3 style={{ margin: '4px 0 8px', fontSize: 14, fontWeight: 600 }}>From {sample.supplier}</h3>
      {main.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{main.map(o => row(o, false))}</div>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.45 }}>
          Nothing open from {sample.supplier} at {sample.site} in the last 30 days.
        </p>
      )}

      {more.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${C.subtle}`, paddingTop: 4 }}>
          <button
            type="button"
            aria-expanded={showMore}
            aria-controls={moreId}
            onClick={() => setShowMore(v => !v)}
            style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 14, fontWeight: 600, color: C.ink, textAlign: 'left' }}
          >
            <span style={{ flex: 1 }}>
              Older orders and other suppliers<span style={{ fontWeight: 500, color: C.muted }}> &middot; {more.length}</span>
            </span>
            <ChevronDown size={20} aria-hidden style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          <div id={moreId} hidden={!showMore} style={{ display: showMore ? 'flex' : 'none', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {more.map(o => row(o, true))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
