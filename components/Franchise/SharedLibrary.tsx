'use client';

import { Share2 } from 'lucide-react';
import { useFranchise } from '@/components/Franchise/FranchiseContext';

/**
 * Slim "Shared across the group" banner shown on library surfaces
 * (recipes / suppliers / products) when the demo is in the franchise-admin
 * group view. Makes the "one library, shared to every franchise" story
 * legible without touching the underlying data.
 *
 * Renders nothing in normal store mode.
 */
export function SharedLibraryBanner({ noun }: { noun: string }) {
  const { isGroupView, group } = useFranchise();
  if (!isGroupView) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
        marginBottom: 16,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <Share2 size={15} color="var(--color-accent-active)" strokeWidth={2.2} />
      <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
        <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
          Shared across {group.name}
        </strong>{' '}
        — these {noun} are maintained centrally and shared to every franchise.
      </span>
    </div>
  );
}

/**
 * Compact "Shared" pill for individual list rows. Only renders in the
 * group view so the normal single-store app is untouched.
 */
export function SharedBadge() {
  const { isGroupView } = useFranchise();
  if (!isGroupView) return null;
  return (
    <span
      title="Shared from the group library"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 7px',
        borderRadius: 100,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-accent-active)',
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      <Share2 size={9} strokeWidth={2.4} />
      Shared
    </span>
  );
}
