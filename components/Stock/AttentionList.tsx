'use client';

import { useMemo } from 'react';
import type { StockItem } from './status';
import { getStockStatus, sortByUrgency } from './status';
import AttentionCard from './AttentionCard';

interface Props {
  items: StockItem[];
}

// Centre of gravity for the page. Filters to non-healthy items so the
// operator only sees things needing a decision; healthy items live in
// the All items table.

export default function AttentionList({ items }: Props) {
  // Memoised so we don't re-sort the entire item list on every parent
  // render — `sortByUrgency` is O(N log N) with multiple
  // `getStockStatus` calls per comparison, which adds up on a 50-item
  // site any time the page re-renders for an unrelated reason
  // (overrides change, drawer opens, etc).
  const needsAttention = useMemo(
    () => sortByUrgency(items.filter(item => getStockStatus(item) !== 'healthy')),
    [items],
  );

  if (needsAttention.length === 0) {
    return (
      <div
        style={{
          padding: '36px 24px',
          textAlign: 'center',
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-secondary)',
          fontSize: '13px',
          border: '1px dashed var(--color-border-subtle)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-bg-hover)',
        }}
      >
        Nothing on the attention list. Every item is on plan.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {needsAttention.map(item => (
        <AttentionCard key={item.id} item={item} />
      ))}
    </div>
  );
}
