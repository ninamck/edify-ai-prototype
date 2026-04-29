'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { VenueRow, VenueStatus } from '@/components/Dashboard/data/playtomicMockData';

const STATUS_COLOUR: Record<VenueStatus, string> = {
  red: '#d44d4d',
  amber: '#e6a52e',
  green: '#21a87a',
};

const POSITIVE = '#21a87a';
const NEGATIVE = '#d44d4d';

type SortKey = 'name' | 'occPct' | 'revenue' | 'pricePerHr' | 'cancelPct' | 'newPlayers' | 'repeatPct' | 'wow';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'name', label: 'Venue', align: 'left' },
  { key: 'occPct', label: 'Occ %', align: 'right' },
  { key: 'revenue', label: 'Revenue', align: 'right' },
  { key: 'pricePerHr', label: '£ / hr', align: 'right' },
  { key: 'cancelPct', label: 'Cancel %', align: 'right' },
  { key: 'newPlayers', label: 'New', align: 'right' },
  { key: 'repeatPct', label: 'Repeat %', align: 'right' },
  { key: 'wow', label: 'WoW', align: 'right' },
];

function formatCell(row: VenueRow, key: SortKey): string {
  switch (key) {
    case 'name': return row.name;
    case 'occPct': return `${row.occPct}%`;
    case 'revenue': return `£${row.revenue.toLocaleString('en-GB')}`;
    case 'pricePerHr': return `£${row.pricePerHr}`;
    case 'cancelPct': return `${row.cancelPct.toFixed(1)}%`;
    case 'newPlayers': return `${row.newPlayers}`;
    case 'repeatPct': return `${row.repeatPct}%`;
    case 'wow': return wowLabel(row.wow);
  }
}

function wowLabel(v: number): string {
  if (v === 0) return '0 pts';
  const abs = Math.abs(v);
  const unit = abs === 1 ? 'pt' : 'pts';
  return `${v > 0 ? '+' : '−'}${abs} ${unit}`;
}

export default function VenueTable({
  venues,
  onVenueClick,
}: {
  venues: VenueRow[];
  /** Optional row-click handler. Receives the venue name (e.g. 'Manchester'). */
  onVenueClick?: (venueName: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('occPct');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    const copy = [...venues];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [venues, sortKey, sortDir]);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(58,48,40,0.06)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr repeat(7, minmax(0, 1fr))',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-canvas)',
        }}
      >
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="columnheader"
            aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            onClick={() => onSort(c.key)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              textAlign: c.align,
              fontFamily: 'var(--font-primary)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: sortKey === c.key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              display: 'flex',
              justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
              gap: 4,
              alignItems: 'center',
            }}
          >
            <span>{c.label}</span>
            {sortKey === c.key && (
              <span aria-hidden style={{ fontSize: 9 }}>
                {sortDir === 'asc' ? '▲' : '▼'}
              </span>
            )}
          </button>
        ))}
      </div>

      {sorted.map((row) => (
        <div
          key={row.name}
          role="row"
          tabIndex={onVenueClick ? 0 : -1}
          onClick={() => onVenueClick?.(row.name)}
          onKeyDown={(e) => {
            if (!onVenueClick) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onVenueClick(row.name);
            }
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr repeat(7, minmax(0, 1fr))',
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            alignItems: 'center',
            transition: 'background 0.1s',
            cursor: onVenueClick ? 'pointer' : 'default',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: STATUS_COLOUR[row.status],
                flexShrink: 0,
              }}
            />
            {row.name}
          </div>
          <Cell>{formatCell(row, 'occPct')}</Cell>
          <Cell>{formatCell(row, 'revenue')}</Cell>
          <Cell>{formatCell(row, 'pricePerHr')}</Cell>
          <Cell>{formatCell(row, 'cancelPct')}</Cell>
          <Cell>{formatCell(row, 'newPlayers')}</Cell>
          <Cell>{formatCell(row, 'repeatPct')}</Cell>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
            <WowPill value={row.wow} />
            <ChevronRight size={14} color="var(--color-text-muted)" strokeWidth={2} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: 'right',
        fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--color-text-primary)',
      }}
    >
      {children}
    </div>
  );
}

function WowPill({ value }: { value: number }) {
  const positive = value > 0;
  const bg = positive ? 'rgba(33,168,122,0.12)' : 'rgba(212,77,77,0.12)';
  const colour = positive ? POSITIVE : NEGATIVE;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        background: bg,
        color: colour,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {wowLabel(value)}
    </span>
  );
}
