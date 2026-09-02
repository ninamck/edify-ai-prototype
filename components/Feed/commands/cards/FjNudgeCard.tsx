'use client';

import Link from 'next/link';
import { Play, Zap } from 'lucide-react';
import { hhmm } from '@/components/Production/farmerj/fjClock';

export type FjNudgePayload = {
  id: string;
  taskId: string;
  atMins: number;
  title: string;
  body: string;
  /** Cook programme minutes, so Start can set the timer from the chat. */
  cookMins?: number;
  taskTitle: string;
};

/**
 * A timing prompt posted by Edify into the chat when the simulated clock
 * crosses a cook trigger. Two actions: Start (timer runs, Sections shows
 * it) or Not now.
 */
export default function FjNudgeCard({ nudge, state, onStart, onLater }: {
  nudge: FjNudgePayload;
  state: 'pending' | 'started' | 'dismissed';
  onStart: () => void;
  onLater: () => void;
}) {
  return (
    <div style={{ border: '1px solid var(--color-warning-border)', background: 'var(--color-warning-light)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-primary)', maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: '#ffffff', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={14} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{hhmm(nudge.atMins)} · Hot section</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-primary)' }}>{nudge.title}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{nudge.body}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {state === 'pending' ? (
          <>
            <button type="button" onClick={onStart} style={primary}><Play size={12} /> Start{nudge.cookMins ? ` · ${nudge.cookMins} min timer` : ''}</button>
            <button type="button" onClick={onLater} style={secondary}>Not now</button>
          </>
        ) : state === 'started' ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-success)' }}>Started. Timer on the Sections board.</span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Not now.</span>
        )}
        <Link href="/production/sections" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--color-link)', textDecoration: 'underline' }}>Open sections</Link>
      </div>
    </div>
  );
}

const primary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-primary)', background: 'var(--color-accent-active)', color: '#fff', border: '1px solid var(--color-accent-active)', cursor: 'pointer' };
const secondary: React.CSSProperties = { ...primary, background: '#ffffff', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', fontWeight: 600 };
