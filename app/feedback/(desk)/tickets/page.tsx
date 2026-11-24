'use client';

import Link from 'next/link';
import { Suspense, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { STORES } from '@/components/Feedback/dunkinData';
import { needsReply, useFeedback, type LiveTicket } from '@/components/Feedback/feedbackState';
import { STATUS_LABEL, type Reason, type StoreId, type TicketStatus } from '@/components/Feedback/model';
import { ReplyLink, TicketRow, secondaryBtn, whiteCard } from '@/components/Feedback/ui';

type StatusFilter = 'all' | TicketStatus;
const STATUS_ORDER: Record<TicketStatus, number> = { open: 0, replied: 1, resolved: 2 };

const selectStyle: CSSProperties = {
  minHeight: 44, padding: '0 36px 0 12px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: '#ffffff',
  fontFamily: 'var(--font-primary)', fontSize: 14, color: 'var(--color-text-primary)',
};

export default function AllTicketsPage() {
  return (
    <Suspense>
      <AllTickets />
    </Suspense>
  );
}

/** Every ticket this week. Open first, oldest first; then replied; then resolved, newest first. */
function AllTickets() {
  const { tickets } = useFeedback();
  const reasonParam = useSearchParams().get('reason') as Reason | null;
  const reasons = [...new Set(tickets.map(t => t.reason))].sort();
  const [status, setStatus] = useState<StatusFilter>(reasonParam ? 'all' : 'open');
  const [store, setStore] = useState<'all' | StoreId>('all');
  const [reason, setReason] = useState<'all' | Reason>(reasonParam && reasons.includes(reasonParam) ? reasonParam : 'all');

  const scoped = tickets.filter(t => (store === 'all' || t.storeId === store) && (reason === 'all' || t.reason === reason));
  const count = (s: StatusFilter) => (s === 'all' ? scoped.length : scoped.filter(t => t.status === s).length);
  const shown = scoped
    .filter(t => status === 'all' || t.status === status)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.status === 'resolved' ? b.at - a.at : a.at - b.at));

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px clamp(20px, 4vw, 40px) 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Tickets</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          {tickets.length} this week across {STORES.length}{' '}stores. Each one is a complaint or compliment, as Dunkin&apos;s feedback system files it.
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
              <option value="all">All {STORES.length} stores</option>
              {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 700 }}>
            Reason
            <select value={reason} onChange={e => setReason(e.target.value as 'all' | Reason)} style={selectStyle}>
              <option value="all">Every reason</option>
              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={{ ...whiteCard, overflow: 'hidden' }}>
        <p aria-live="polite" style={{ margin: 0, padding: '12px 18px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {shown.length} {shown.length === 1 ? 'ticket' : 'tickets'}
        </p>
        {shown.length === 0 ? (
          <p style={{ margin: 0, padding: '14px 18px 18px', fontSize: 14, borderTop: '1px solid var(--color-border-subtle)' }}>No tickets match. Try another store or reason.</p>
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
  if (needsReply(t)) return <ReplyLink t={t} />;
  return (
    <Link href={`/feedback/tickets/${t.id}`} aria-label={`Open ticket from ${t.guest}`} style={{ ...secondaryBtn, padding: '0 16px', border: '1.5px solid var(--color-border)' }}>
      Open
    </Link>
  );
}
