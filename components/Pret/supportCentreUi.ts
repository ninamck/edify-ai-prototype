import type { CSSProperties } from 'react';

/** Shared look for the Pret Support Centre screens. */

export const page: CSSProperties = {
  padding: '20px 28px 48px',
  maxWidth: 1180,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  fontFamily: 'var(--font-primary)',
};

export const h1: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' };
export const h2: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' };
export const lede: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 13.5,
  lineHeight: 1.55,
  color: 'var(--color-text-secondary)',
  maxWidth: 760,
};
export const muted: CSSProperties = { margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' };

export const card: CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 14,
  padding: '16px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

export const list: CSSProperties = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 };
/** Pair with className="row-list" so rows get dividers between them, not boxes. */
export const rowList: CSSProperties = { ...list, gap: 0 };
export const listRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  justifyContent: 'space-between',
  padding: '10px 0',
  fontSize: 13,
  color: 'var(--color-text-primary)',
};

export const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
export const th: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  borderBottom: '1px solid var(--color-border)',
  whiteSpace: 'nowrap',
};
export const thNum: CSSProperties = { ...th, textAlign: 'right' };
export const td: CSSProperties = {
  padding: '9px 10px',
  borderBottom: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text-primary)',
  verticalAlign: 'top',
};
export const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

export const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
export const fieldLabel: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-secondary)' };
export const input: CSSProperties = {
  padding: '7px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'var(--font-primary)',
  background: '#ffffff',
  color: 'var(--color-text-primary)',
  minHeight: 36,
};

export const primaryBtn: CSSProperties = {
  padding: '8px 16px',
  minHeight: 36,
  borderRadius: 8,
  border: 'none',
  background: 'var(--color-accent-active)',
  color: 'var(--color-text-on-active)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};
export const ghostBtn: CSSProperties = {
  padding: '6px 12px',
  minHeight: 32,
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: '#ffffff',
  color: 'var(--color-text-primary)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
  whiteSpace: 'nowrap',
};

const PILL: Record<string, { bg: string; fg: string; border: string }> = {
  'hub-makes': { bg: 'var(--color-bg-hover)', fg: 'var(--color-text-primary)', border: 'var(--color-border)' },
  'spoke-makes': { bg: 'var(--color-success-light)', fg: 'var(--color-success)', border: 'var(--color-success-border)' },
  direct: { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)', border: 'var(--color-warning-border)' },
  reporting: { bg: '#ffffff', fg: 'var(--color-text-secondary)', border: 'var(--color-border)' },
  good: { bg: 'var(--color-success-light)', fg: 'var(--color-success)', border: 'var(--color-success-border)' },
  warn: { bg: 'var(--color-warning-light)', fg: 'var(--color-warning)', border: 'var(--color-warning-border)' },
  bad: { bg: 'var(--color-error-light)', fg: 'var(--color-error)', border: 'var(--color-error-border)' },
  neutral: { bg: 'var(--color-bg-hover)', fg: 'var(--color-text-primary)', border: 'var(--color-border)' },
};

export function pill(kind: string): CSSProperties {
  const t = PILL[kind] ?? PILL.neutral;
  return {
    display: 'inline-block',
    padding: '2px 9px',
    borderRadius: 999,
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}
