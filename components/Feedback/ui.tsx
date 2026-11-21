'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Check, CircleDot, CornerUpLeft, Heart } from 'lucide-react';
import { ageLabel } from './bronxData';
import { SOURCE_LABEL, STATUS_LABEL, type ContextLine, type TicketStatus } from './model';
import type { LiveTicket } from './feedbackState';

/** A person speaking: guests' words and the manager's own line. */
export const quote: CSSProperties = {
  fontFamily: 'var(--font-quote), Georgia, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  color: 'var(--color-text-primary)',
};

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

export const whiteCard: CSSProperties = { background: '#ffffff', borderRadius: 16, border: '1px solid var(--color-border-subtle)' };

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} style={{ display: 'inline-flex', gap: 1, lineHeight: 1, verticalAlign: '-1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden>
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L10 14.9l-5.25 2.7 1-5.8L1.5 7.7l5.9-.9z"
            fill={i <= value ? 'var(--color-text-primary)' : 'none'}
            stroke="var(--color-text-primary)"
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

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

/** An event or cause. The pink marker is kept for the biggest problem. */
export function CauseChip({ children, marker = 'dot' }: { children: ReactNode; marker?: 'pink' | 'dot' | 'heart' }) {
  if (marker === 'heart') {
    return (
      <span style={{ ...chipBase, background: '#ffffff', border: '1px solid var(--color-border)' }}>
        <Heart size={12} aria-hidden /> {children}
      </span>
    );
  }
  return (
    <span style={{ ...chipBase, background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)' }}>
      <span
        aria-hidden
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: marker === 'pink' ? 'var(--color-accent-pink)' : 'var(--color-text-primary)',
        }}
      />
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

export function ticketMeta(t: LiveTicket, opts: { store?: boolean } = {}) {
  return [t.guest, `${t.stars} ${t.stars === 1 ? 'star' : 'stars'}`, SOURCE_LABEL[t.source], opts.store === false ? null : t.store.name].filter(Boolean).join(' · ');
}

/** One ticket as a row: wait, the guest's words, its ripple, its status and the action. */
export function TicketRow({ t, action }: { t: LiveTicket; action?: ReactNode }) {
  return (
    <li
      style={{
        display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) auto', gap: 16, alignItems: 'center', padding: '14px 18px', borderTop: hairline,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.status === 'open' ? ageLabel(t.at) : ''}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ ...quote, display: 'block', fontSize: 15, lineHeight: 1.4 }}>
          {t.words ? `“${t.words}”` : <span style={{ fontFamily: 'var(--font-primary)', fontStyle: 'normal', fontSize: 14 }}>Rating only, no comment</span>}
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 3 }}>{ticketMeta(t)}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {t.ripple ? <CauseChip>{t.ripple.tag}</CauseChip> : <OutlineChip>No pattern</OutlineChip>}
        <StatusTag status={t.status} />
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
