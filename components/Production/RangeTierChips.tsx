'use client';

import { Clock, Layers } from 'lucide-react';
import {
  PRET_RANGES,
  tierForSiteOnDate,
  dayOfWeek,
  getSite,
  type SelectionTag,
  type SkuId,
  type SiteId,
} from './fixtures';

const TAG_STYLES: Record<SelectionTag, { bg: string; color: string; label: string }> = {
  breakfast: { bg: '#FEF3C7', color: '#92400E', label: 'breakfast' },
  morning:   { bg: '#E0F2FE', color: '#0369A1', label: 'morning' },
  midday:    { bg: '#DCFCE7', color: '#15803D', label: 'midday' },
  afternoon: { bg: '#FFE4E6', color: '#9F1239', label: 'afternoon' },
  closing:   { bg: '#E0E7FF', color: '#3730A3', label: 'closing' },
  core:      { bg: '#F5F4F2', color: '#3A3028', label: 'core' },
};

export function SelectionTagChip({ tag, size = 'sm' }: { tag: SelectionTag; size?: 'xs' | 'sm' }) {
  const s = TAG_STYLES[tag];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'xs' ? '2px 6px' : '3px 8px',
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        fontSize: size === 'xs' ? 10 : 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

/**
 * Shows the tier + composed ranges for a site on a given date.
 * Compact pill-card suitable for a header strip.
 */
export function RangeTierIndicator({ siteId, date }: { siteId: SiteId; date: string }) {
  const tier = tierForSiteOnDate(siteId, date);
  const site = getSite(siteId);
  if (!tier || !site) return null;
  const ranges = tier.rangeIds
    .map(rid => PRET_RANGES.find(r => r.id === rid))
    .filter((r): r is NonNullable<typeof r> => !!r);
  const activeRanges = ranges.filter(r => !r.formatFilter || r.formatFilter.includes(site.formatId));
  const dow = dayOfWeek(date);

  const skuCount = new Set(activeRanges.flatMap(r => r.entries.map(e => e.skuId))).size;
  const timedWindowCount = activeRanges
    .flatMap(r => r.entries)
    .filter(e => e.availability.daysOfWeek.includes(dow) && e.availability.windows.length > 0)
    .length;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <Layers size={14} color="var(--color-accent-active)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Tier: {tier.name}
          </span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
            · {dow}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {activeRanges.map(r => (
            <span
              key={r.id}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                background: 'var(--color-bg-hover)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 4,
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              {r.name}
            </span>
          ))}
        </div>
      </div>
      <div style={{ height: 20, width: 1, background: 'var(--color-border-subtle)', margin: '0 4px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Stat icon={<Layers size={12} color="var(--color-text-muted)" />} label="SKUs" value={skuCount} />
        <Stat icon={<Clock size={12} color="var(--color-text-muted)" />} label="Timed" value={timedWindowCount} />
      </div>
    </div>
  );
}

/**
 * Inline row showing the intra-day windows for a given SKU at a site.
 * Useful inside BatchDetailPanel.
 */
export function AvailabilityWindows({
  skuId,
  siteId,
  date,
}: {
  skuId: SkuId;
  siteId: SiteId;
  date: string;
}) {
  const tier = tierForSiteOnDate(siteId, date);
  const site = getSite(siteId);
  if (!tier || !site) return null;
  const dow = dayOfWeek(date);

  const ranges = tier.rangeIds
    .map(rid => PRET_RANGES.find(r => r.id === rid))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .filter(r => !r.formatFilter || r.formatFilter.includes(site.formatId));

  const windows: Array<{ rangeName: string; label: string; allDay: boolean }> = [];
  for (const r of ranges) {
    for (const entry of r.entries.filter(e => e.skuId === skuId)) {
      if (!entry.availability.daysOfWeek.includes(dow)) continue;
      if (entry.availability.windows.length === 0) {
        windows.push({ rangeName: r.name, label: 'All day', allDay: true });
      } else {
        for (const w of entry.availability.windows) {
          windows.push({ rangeName: r.name, label: `${w.start}–${w.end}`, allDay: false });
        }
      }
    }
  }

  if (windows.length === 0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'var(--color-error-light)',
          border: '1px solid var(--color-error-border)',
          color: 'var(--color-error)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <Clock size={12} /> Not in today&rsquo;s tier
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {windows.map((w, i) => (
        <span
          key={`${w.rangeName}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            background: w.allDay ? 'var(--color-success-light)' : 'var(--color-info-light)',
            border: `1px solid ${w.allDay ? 'var(--color-success-border)' : 'var(--color-info)'}`,
            color: w.allDay ? 'var(--color-success)' : 'var(--color-info)',
            fontSize: 11,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Clock size={10} /> {w.label}
          <span style={{ opacity: 0.6, fontWeight: 500 }}>· {w.rangeName}</span>
        </span>
      ))}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {icon}
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
        {value}
      </span>
    </div>
  );
}
