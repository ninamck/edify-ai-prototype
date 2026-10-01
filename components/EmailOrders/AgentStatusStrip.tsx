'use client';

/**
 * AgentStatusStrip — one slim bar at the top of Email orders. Left half:
 * when Edify last read the inbox and what it did today, with a Check
 * now button. Right half: whether the till is live, read from the same
 * store the POS connection tab manages.
 *
 * Deliberately one sentence per side. Each order row carries its own
 * last event, and the expanded row carries the full timeline, so there
 * is no cross-order log here. If one is ever needed it belongs on the
 * Activity page under Performance (`dayLog` in the store is the shape
 * to feed it).
 */

import { useRouter } from 'next/navigation';
import { Inbox, RefreshCw } from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePrimaryPosConnection } from './posConnection';
import { checkInbox, minutesAgo, useEmailOrdersState } from './store';

export default function AgentStatusStrip() {
  const { orders, run, checking, now } = useEmailOrdersState();
  const pos = usePrimaryPosConnection();
  const router = useRouter();
  const narrow = useMediaQuery('(max-width: 820px)');

  const waiting = orders.filter((o) => o.status === 'review').length;
  const scheduled = orders.filter((o) => o.status === 'scheduled').length;
  const updated = orders.filter((o) => (o.amendments ?? []).some((a) => a.at.startsWith(now.slice(0, 10)))).length;
  const queued = orders.filter((o) => o.status === 'waiting' || o.status === 'failed').length;
  const posLive = pos?.status === 'connected';

  return (
      <div
        style={{
          marginTop: 4,
          display: 'grid',
          gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 1.5fr) minmax(0, 1fr)',
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* ── Edify ──────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', minWidth: 0,
            borderRight: narrow ? 'none' : '1px solid var(--color-border)',
            borderBottom: narrow ? '1px solid var(--color-border)' : 'none',
          }}
        >
          <EdifyMark size={18} color="var(--color-accent-active)" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {checking ? (
              <Strong>Reading the inbox…</Strong>
            ) : (
              <>
                <Strong>Checks every {run.cadenceMinutes} min</Strong>, last {minutesAgo(run.lastCheckedAt, now)}.{' '}
                {run.ordersSentToday} on the till today
                {scheduled > 0 && <>, {scheduled} on the plan</>}
                {updated > 0 && <>, <Strong>{updated} ticket{updated === 1 ? '' : 's'} updated</Strong></>}
                {waiting > 0 && <>, <Strong>{waiting} waiting for you</Strong></>}
                .
              </>
            )}
          </p>
          <button
            type="button"
            onClick={checkInbox}
            disabled={checking}
            title={`Read the inbox now instead of waiting for the next automatic check`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 9, minHeight: 36,
              border: '1px solid var(--color-accent-active)',
              background: checking ? 'var(--color-bg-hover)' : 'var(--color-accent-active)',
              color: checking ? 'var(--color-text-secondary)' : '#fff',
              fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)',
              cursor: checking ? 'wait' : 'pointer', flexShrink: 0,
            }}
          >
            {checking ? <RefreshCw size={13} className="spin" /> : <Inbox size={13} />}
            {checking ? 'Checking\u2026' : 'Check now'}
          </button>
        </div>

        {/* ── Till ───────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', minWidth: 0,
            background: posLive ? '#fff' : 'var(--color-warning-bg)',
          }}
        >
          <LiveDot live={posLive} />
          <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pos && posLive ? (
              <><Strong>{pos.vendor} connected.</Strong> Synced {pos.lastSyncedAt}.</>
            ) : (
              <><Strong>Till not connected.</Strong> {queued > 0 ? `${queued} waiting.` : 'Nothing is sent until it\u2019s back.'}</>
            )}
          </p>
          <button type="button" onClick={() => router.push('/pos-connection')} style={textBtn}>
            Manage
          </button>
        </div>
      </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{children}</strong>;
}

function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      role="img"
      aria-label={live ? 'Live' : 'Not connected'}
      style={{
        width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
        background: live ? 'var(--color-success)' : 'var(--color-warning-border)',
        boxShadow: live ? '0 0 0 3px var(--color-success-light)' : 'none',
        display: 'inline-block',
      }}
    />
  );
}

const textBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 8px', borderRadius: 7, minHeight: 32,
  border: 'none', background: 'transparent',
  fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)', cursor: 'pointer', flexShrink: 0,
};
