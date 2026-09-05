import type { CSSProperties } from 'react';
import type { ProposalKind, ProposalTag } from '../types';

/** Visual language for shift chips and proposal lines. All text on
 *  white stays at AA or better: navy, the semantic tokens, or the
 *  secondary grey. Tints are backgrounds only. */
export const KIND_STYLE: Record<ProposalKind | 'unchanged', { bg: string; border: string; label: string }> = {
  unchanged: { bg: '#fff', border: 'var(--color-border-subtle)', label: '' },
  add: { bg: 'var(--color-success-light)', border: 'var(--color-success-border)', label: 'Add' },
  amend: { bg: 'var(--color-review-light)', border: 'var(--color-review-border)', label: 'Amend' },
  remove: { bg: 'var(--color-bg-hover)', border: 'var(--color-border)', label: 'Remove' },
};

export const TAG_LABEL: Record<ProposalTag, string> = {
  demand: 'Demand',
  workload: 'Workload',
  capacity: 'Capacity',
  'rule-fix': 'Rule fix',
};

export const TAG_TONE: Record<ProposalTag, 'info' | 'neutral' | 'warning' | 'success'> = {
  demand: 'info',
  workload: 'neutral',
  capacity: 'neutral',
  'rule-fix': 'warning',
};

export const label: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
};

export const small: CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
};

export const body: CSSProperties = {
  fontSize: '12.5px',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

export const ghostButton: CSSProperties = {
  padding: '7px 14px',
  borderRadius: '100px',
  border: '1.5px solid var(--color-border)',
  background: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

export const primaryButton: CSSProperties = {
  padding: '7px 16px',
  borderRadius: '100px',
  border: 'none',
  background: 'var(--color-accent-active)',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,28,53,0.22)',
};

export const textButton: CSSProperties = {
  padding: '7px 10px',
  borderRadius: '100px',
  border: 'none',
  background: 'transparent',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

export const segmentedWrap: CSSProperties = {
  display: 'inline-flex',
  padding: '2px',
  borderRadius: '8px',
  background: 'var(--color-bg-hover)',
  gap: '2px',
};

export function segment(active: boolean): CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '11.5px',
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    cursor: 'pointer',
    background: active ? '#fff' : 'transparent',
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    boxShadow: active ? '0 1px 2px rgba(0,28,53,0.12)' : 'none',
  };
}
