'use client';

import { useState } from 'react';
import * as ui from '@/components/Pret/supportCentreUi';
import { useCashShop } from '@/components/Pret/cash/useCashShop';
import { NoShop, Stat } from '@/components/Pret/cash/CashUi';
import PaidOutRow from '@/components/Pret/cash/PaidOutRow';
import { money, round2 } from '@/components/Pret/cashFixtures';
import { paidOutSummary, paidOutsFor, usePaidOutNotes } from '@/components/Pret/paidOuts';

export default function PaidOutsPage() {
  const cash = useCashShop();
  const [notes, setNotes] = usePaidOutNotes();
  const [show, setShow] = useState<'open' | 'all'>('open');
  const { shop } = cash;
  if (!shop) return <NoShop />;

  const rows = paidOutsFor(shop, notes);
  const summary = paidOutSummary(rows);
  const week = rows.filter(r => r.day >= -6);
  const listed = show === 'open' ? summary.open : rows;

  return (
    <div style={ui.page}>
      <div>
        <h1 style={ui.h1}>Paid outs</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat
          label="To explain"
          value={summary.open.length ? `${summary.open.length}, ${money(summary.openValue)}` : 'None'}
          sub={summary.late.length ? `${summary.late.length} older than two days.` : 'Taken from the till. Explain them any time.'}
          tone={summary.late.length ? 'warn' : 'neutral'}
        />
        <Stat
          label="Paid out, last 7 days"
          value={money(round2(week.reduce((s, r) => s + r.value, 0)))}
          sub={`${week.length} from the tills. Already taken off expected cash.`}
        />
      </div>

      <section style={ui.card} aria-labelledby="po-h">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 id="po-h" style={ui.h2}>{show === 'open' ? 'To explain' : 'All paid outs, 14 days'}</h2>
          <div role="radiogroup" aria-label="Show" style={{ display: 'flex', gap: 6 }}>
            {(['open', 'all'] as const).map(v => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={show === v}
                style={{ ...ui.ghostBtn, ...(show === v ? { background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', border: '1px solid var(--color-accent-active)' } : {}) }}
                onClick={() => setShow(v)}
              >
                {v === 'open' ? 'To explain' : 'All'}
              </button>
            ))}
          </div>
        </div>
        {listed.length === 0 ? (
          <p style={ui.muted}>{show === 'open' ? 'All paid outs explained.' : 'No paid outs in the last 14 days.'}</p>
        ) : (
          <ul className="row-list" style={ui.rowList}>
            {listed.map(p => (
              <PaidOutRow
                key={`${p.id}-${p.explained?.when ?? 'open'}`}
                p={p}
                me={cash.me.name}
                onSave={(id, note) => setNotes(prev => ({ ...prev, [id]: note }))}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
