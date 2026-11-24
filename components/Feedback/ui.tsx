'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Check, CircleDot, CornerUpLeft, Heart } from 'lucide-react';
import { ageLabel } from './dunkinData';
import { SOURCE_LABEL, STATUS_LABEL, type ContextLine, type TicketStatus } from './model';
import type { LiveTicket } from './feedbackState';

/** A person speaking: guests' words and the manager's own line. Same font as the rest, so it reads easily. */
export const quote: CSSProperties = {
  fontFamily: 'var(--font-primary)',
  fontStyle: 'normal',
  fontWeight: 400,
  color: 'var(--color-text-primary)',
};

/** The bar down the left of a person's words, so they stand apart from what Edify wrote. */
export const spoken: CSSProperties = { borderLeft: '3px solid var(--color-border)', paddingLeft: 12 };

export const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-primary)',
};

export const hairline = '1px solid var(--color-border-subtle)';

const btnBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 44,
  padding: '0 18px',
  borderRadius: 10,
  fontFamily: 'var(--font-primary)',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
};

/** The one main action in an area. */
export const primaryBtn: CSSProperties = { ...btnBase, background: 'var(--color-accent-active)', color: '#ffffff', border: '1px solid var(--color-accent-active)' };
export const secondaryBtn: CSSProperties = { ...btnBase, background: '#ffffff', color: 'var(--color-text-primary)', border: '1.5px solid var(--color-text-primary)' };

export const whiteCard: CSSProperties = {
  background: '#ffffff', borderRadius: 16, border: '1px solid var(--color-border-subtle)',
  boxShadow: '0 1px 2px rgba(10, 20, 25, 0.04), 0 4px 12px rgba(10, 20, 25, 0.04)',
};

const chipBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  color: 'var(--color-text-primary)',
  lineHeight: 1.5,
};

/** An event or cause. */
export function CauseChip({ children, marker = 'dot' }: { children: ReactNode; marker?: 'dot' | 'heart' }) {
  if (marker === 'heart') {
    return (
      <span style={{ ...chipBase, background: '#ffffff', border: '1px solid var(--color-border)' }}>
        <Heart size={12} aria-hidden /> {children}
      </span>
    );
  }
  return (
    <span style={{ ...chipBase, background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: 'var(--color-text-primary)' }} />
      {children}
    </span>
  );
}

/** Something Edify or the team has already done. */
export function DoneChip({ children }: { children: ReactNode }) {
  return (
    <span style={{ ...chipBase, background: 'var(--color-review-light)', border: '1px solid var(--color-review-border)' }}>
      <Check size={12} aria-hidden /> {children}
    </span>
  );
}

export function OutlineChip({ children }: { children: ReactNode }) {
  return <span style={{ ...chipBase, background: '#ffffff', border: '1px solid var(--color-text-primary)' }}>{children}</span>;
}

const STATUS_ICON: Record<TicketStatus, typeof Check> = { open: CircleDot, replied: CornerUpLeft, resolved: Check };

/** Open, Replied or Resolved, with a different icon for each so colour is never the only signal. */
export function StatusTag({ status }: { status: TicketStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      style={{
        ...chipBase,
        padding: '2px 8px',
        fontSize: 11.5,
        background: status === 'resolved' ? 'var(--color-bg-hover)' : '#ffffff',
        border: '1px solid var(--color-border)',
      }}
    >
      <Icon size={12} aria-hidden /> {STATUS_LABEL[status]}
    </span>
  );
}

/** Bolds the given parts of a sentence, such as a time. */
export function withStrong(text: string, strong: string[] = []): ReactNode {
  if (!strong.length) return text;
  const parts = text.split(new RegExp(`(${strong.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`));
  return parts.map((p, i) => (strong.includes(p) ? <strong key={i}>{p}</strong> : p));
}

/** What Edify knows, one plain sentence per line, each with the module it came from. */
export function ContextList({ lines, extra }: { lines: ContextLine[]; extra?: ReactNode }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {lines.map(l => (
        <li
          key={l.text}
          style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0', borderTop: hairline, fontSize: 14, lineHeight: 1.5 }}
        >
          <span>{withStrong(l.text, l.strong)}</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{l.from}</span>
        </li>
      ))}
      {extra && <li style={{ padding: '12px 0', borderTop: hairline, fontSize: 14 }}>{extra}</li>}
    </ul>
  );
}

/** Where it came in: the route through Dunkin's feedback system when known, otherwise the source. */
export const sourceLine = (t: Pick<LiveTicket, 'source' | 'origin'>) => t.origin ?? SOURCE_LABEL[t.source];

export function ticketMeta(t: LiveTicket, opts: { store?: boolean } = {}) {
  return [t.guest, t.reason, sourceLine(t), opts.store === false ? null : t.store.name].filter(Boolean).join(' · ');
}

/** Shown in place of the guest's words when there are none. */
export const noWordsLabel = (t: Pick<LiveTicket, 'reason'>) => (t.reason === 'Compliment' ? 'Compliment, no comment' : `${t.reason}, no comment`);

/** One ticket as a row: wait, the guest's words, its ripple, its status and the action. */
export function TicketRow({ t, action, hideStatus }: { t: LiveTicket; action?: ReactNode; hideStatus?: boolean }) {
  return (
    <li
      style={{
        display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) auto', gap: 20, alignItems: 'center', padding: '18px 22px', borderTop: hairline,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.status === 'open' ? ageLabel(t.at) : ''}</span>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ ...quote, ...(t.words ? spoken : {}), display: 'block', fontSize: 15, lineHeight: 1.5 }}>
          {t.words ? `“${t.words}”` : noWordsLabel(t)}
        </span>
        <span style={{ display: 'block', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{ticketMeta(t)}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {t.ripple ? <CauseChip marker={t.ripple.kind === 'praise' ? 'heart' : 'dot'}>{t.ripple.tag}</CauseChip> : t.fyiOnly ? <OutlineChip>FYI only</OutlineChip> : null}
        {!hideStatus && <StatusTag status={t.status} />}
        {action}
      </span>
    </li>
  );
}

export function ReplyLink({ t, label = 'Reply' }: { t: LiveTicket; label?: string }) {
  return (
    <Link href={`/feedback/tickets/${t.id}`} style={{ ...primaryBtn, padding: '0 16px' }} aria-label={`${label} to ${t.guest}`}>
      {label}
    </Link>
  );
}
