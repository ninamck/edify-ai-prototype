'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { STORES } from '@/components/Feedback/bronxData';
import { canDraft, needsReply, useFeedback, type LiveTicket } from '@/components/Feedback/feedbackState';
import { SOURCE_LABEL, STATUS_LABEL, type Source, type StoreId, type TicketStatus } from '@/components/Feedback/model';
import { ReplyLink, TicketRow, secondaryBtn, whiteCard } from '@/components/Feedback/ui';

type StatusFilter = 'all' | TicketStatus;
const STATUS_ORDER: Record<TicketStatus, number> = { open: 0, replied: 1, resolved: 2 };

const selectStyle: CSSProperties = {
  minHeight: 44, padding: '0 36px 0 12px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: '#ffffff',
  fontFamily: 'var(--font-primary)', fontSize: 14, color: 'var(--color-text-primary)',
};

/** Every ticket this week. Open first, oldest first; then replied; then resolved, newest first. */
export default function AllTicketsPage() {
  const { tickets } = useFeedback();
  const [status, setStatus] = useState<StatusFilter>('open');
  const [store, setStore] = useState<'all' | StoreId>('all');
  const [source, setSource] = useState<'all' | Source>('all');

  const scoped = tickets.filter(t => (store === 'all' || t.storeId === store) && (source === 'all' || t.source === source));
  const count = (s: StatusFilter) => (s === 'all' ? scoped.length : scoped.filter(t => t.status === s).length);
  const shown = scoped
    .filter(t => status === 'all' || t.status === status)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.status === 'resolved' ? b.at - a.at : a.at - b.at));

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px clamp(20px, 4vw, 40px) 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Tickets</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          {tickets.length} this week across {STORES.length}{' '}stores. Each one is a guest&apos;s rating or review, from wherever they left it.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div role="group" aria-label="Status" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['open', 'replied', 'resolved', 'all'] as StatusFilter[]).map(s => {
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setStatus(s)}
                style={{
                  ...secondaryBtn, minHeight: 44, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 600,
                  background: on ? 'var(--color-text-primary)' : '#ffffff', color: on ? '#ffffff' : 'var(--color-text-primary)',
                  border: on ? '1.5px solid var(--color-text-primary)' : '1.5px solid var(--color-border)',
                }}
              >
                {s === 'all' ? 'All' : STATUS_LABEL[s]} <span style={{ fontWeight: 400 }}>{count(s)}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 700 }}>
            Store
            <select value={store} onChange={e => setStore(e.target.value as 'all' | StoreId)} style={selectStyle}>
              <option value="all">All 6 stores</option>
              {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 700 }}>
            Source
            <select value={source} onChange={e => setSource(e.target.value as 'all' | Source)} style={selectStyle}>
              <option value="all">Every source</option>
              {(Object.keys(SOURCE_LABEL) as Source[]).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={{ ...whiteCard, overflow: 'hidden' }}>
        <p aria-live="polite" style={{ margin: 0, padding: '12px 18px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {shown.length} {shown.length === 1 ? 'ticket' : 'tickets'}
        </p>
        {shown.length === 0 ? (
          <p style={{ margin: 0, padding: '14px 18px 18px', fontSize: 14, borderTop: '1px solid var(--color-border-subtle)' }}>No tickets match. Try another store or source.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {shown.map(t => <TicketRow key={t.id} t={t} action={<RowAction t={t} />} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function RowAction({ t }: { t: LiveTicket }) {
  if (needsReply(t)) return <ReplyLink t={t} label={canDraft(t) ? 'Reply' : 'Write reply'} />;
  return (
    <Link href={`/feedback/tickets/${t.id}`} aria-label={`Open ticket from ${t.guest}`} style={{ ...secondaryBtn, padding: '0 16px', border: '1.5px solid var(--color-border)' }}>
      Open
    </Link>
  );
}
