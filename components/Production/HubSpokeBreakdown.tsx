'use client';

import { useMemo } from 'react';
import { Truck, Sparkles, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  dayOffset,
  dayOfWeek,
  getSite,
  getRecipe,
  submissionsForHub,
  type SiteId,
  type SkuId,
  type SpokeSubmission,
  type ProductionRecipe,
} from './fixtures';

type Props = {
  hubId: SiteId;
  /** ISO date the spokes are ordering FOR. Defaults to tomorrow. */
  forDate?: string;
};

/**
 * Aggregate dispatch matrix shown to a hub manager: rows are recipes the
 * spokes have asked for, columns are the spokes themselves, cells are the
 * units the hub must dispatch (confirmed, falling back to Quinn-proposed
 * for drafts that haven't been touched yet). The right-most column sums
 * the row across all spokes; the bottom row sums each spoke's total.
 *
 * Cells render `—` (em dash) when a spoke didn't ask for the recipe at all.
 * The header chips badge each spoke's submission status (draft / submitted
 * / acknowledged) so the hub manager can see at a glance which orders are
 * locked in vs still moving.
 */
export default function HubSpokeBreakdown({ hubId, forDate = dayOffset(1) }: Props) {
  const submissions = useMemo(() => submissionsForHub(hubId, forDate), [hubId, forDate]);

  // Build a stable union of recipes referenced across all submissions, in
  // category-order then by recipe name so the table reads consistently.
  const rows = useMemo(() => {
    const seen = new Map<SkuId, ProductionRecipe>();
    for (const sub of submissions) {
      for (const line of sub.lines) {
        if (seen.has(line.skuId)) continue;
        const recipe = getRecipe(line.recipeId);
        if (recipe) seen.set(line.skuId, recipe);
      }
    }
    return Array.from(seen.values()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  }, [submissions]);

  // Pre-index each submission's lines by skuId for O(1) cell lookup.
  const linesBySpoke = useMemo(() => {
    const m = new Map<SiteId, Map<SkuId, { confirmed: number | null; quinn: number }>>();
    for (const sub of submissions) {
      const inner = new Map<SkuId, { confirmed: number | null; quinn: number }>();
      for (const line of sub.lines) {
        inner.set(line.skuId, { confirmed: line.confirmedUnits, quinn: line.quinnProposedUnits });
      }
      m.set(sub.fromSiteId, inner);
    }
    return m;
  }, [submissions]);

  const colTotals = useMemo(() => {
    const totals = new Map<SiteId, number>();
    for (const sub of submissions) {
      const sum = sub.lines.reduce((a, l) => a + effectiveUnits(l.confirmedUnits, l.quinnProposedUnits), 0);
      totals.set(sub.fromSiteId, sum);
    }
    return totals;
  }, [submissions]);

  const grandTotal = useMemo(
    () => Array.from(colTotals.values()).reduce((a, b) => a + b, 0),
    [colTotals],
  );

  if (submissions.length === 0) {
    return null;
  }

  // Column template: recipe name | one column per spoke | total
  const cols = `minmax(220px, 1.6fr) ${submissions.map(() => 'minmax(110px, 1fr)').join(' ')} 110px`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px 8px',
          flexWrap: 'wrap',
        }}
      >
        <Truck size={16} color="var(--color-text-secondary)" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
            }}
          >
            Spoke dispatch
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {submissions.length} {submissions.length === 1 ? 'spoke' : 'spokes'} ordering for {dayOfWeek(forDate)} {forDate}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <SummaryChip label="Lines" value={rows.length} />
        <SummaryChip label="Total units" value={grandTotal} bold />
        <Link
          href="/production/spokes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            background: '#ffffff',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            textDecoration: 'none',
          }}
        >
          Open spoke flow <ChevronRight size={12} />
        </Link>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          gap: 0,
          padding: '6px 16px',
          background: 'var(--color-bg-surface)',
          borderTop: '1px solid var(--color-border-subtle)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <span style={headerCell('left')}>Recipe</span>
        {submissions.map(sub => {
          const spoke = getSite(sub.fromSiteId);
          return (
            <div key={sub.fromSiteId} style={{ ...headerCell('right'), display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {spoke?.name ?? sub.fromSiteId}
              </span>
              <StatusChip status={sub.status} />
            </div>
          );
        })}
        <span style={{ ...headerCell('right'), color: 'var(--color-text-primary)' }}>Total</span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(recipe => {
          const skuId = recipe.skuId;
          const cells = submissions.map(sub => {
            const entry = linesBySpoke.get(sub.fromSiteId)?.get(skuId);
            if (!entry) return { value: null, isQuinn: false };
            const confirmed = entry.confirmed;
            return {
              value: effectiveUnits(confirmed, entry.quinn),
              isQuinn: confirmed === null,
            };
          });
          const rowTotal = cells.reduce((a, c) => a + (c.value ?? 0), 0);

          return (
            <div
              key={skuId}
              style={{
                display: 'grid',
                gridTemplateColumns: cols,
                gap: 0,
                padding: '8px 16px',
                borderBottom: '1px solid var(--color-border-subtle)',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {recipe.name}
                </span>
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  {recipe.category}
                </span>
              </div>
              {cells.map((c, i) => (
                <div
                  key={submissions[i].fromSiteId}
                  style={{
                    textAlign: 'right',
                    fontSize: 13,
                    fontWeight: c.value === null ? 400 : 700,
                    color: c.value === null ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 4,
                  }}
                  title={
                    c.value === null
                      ? `${getSite(submissions[i].fromSiteId)?.name ?? submissions[i].fromSiteId} did not order this`
                      : c.isQuinn
                        ? `Quinn-proposed (not yet confirmed by spoke)`
                        : `Confirmed by spoke`
                  }
                >
                  {c.value === null ? '—' : c.value}
                  {c.isQuinn && c.value !== null && (
                    <Sparkles size={10} color="var(--color-text-muted)" />
                  )}
                </div>
              ))}
              <span
                style={{
                  textAlign: 'right',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  borderLeft: '1px solid var(--color-border-subtle)',
                  paddingLeft: 12,
                }}
              >
                {rowTotal}
              </span>
            </div>
          );
        })}

        {/* Footer total row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: cols,
            gap: 0,
            padding: '10px 16px',
            background: 'var(--color-bg-surface)',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
            }}
          >
            Total
          </span>
          {submissions.map(sub => (
            <span
              key={sub.fromSiteId}
              style={{
                textAlign: 'right',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {colTotals.get(sub.fromSiteId) ?? 0}
            </span>
          ))}
          <span
            style={{
              textAlign: 'right',
              fontSize: 15,
              fontWeight: 800,
              color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              borderLeft: '1px solid var(--color-border-subtle)',
              paddingLeft: 12,
            }}
          >
            {grandTotal}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function effectiveUnits(confirmed: number | null, quinn: number): number {
  return confirmed ?? quinn;
}

const CATEGORY_ORDER: ProductionRecipe['category'][] = ['Bakery', 'Sandwich', 'Salad', 'Snack', 'Beverage'];

function headerCell(align: 'left' | 'right'): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    textAlign: align,
  };
}

function SummaryChip({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 6,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 11,
        fontFamily: 'var(--font-primary)',
      }}
    >
      <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 9 }}>
        {label}
      </span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: bold ? 800 : 700, fontVariantNumeric: 'tabular-nums', fontSize: bold ? 13 : 12 }}>
        {value}
      </span>
    </span>
  );
}

function StatusChip({ status }: { status: SpokeSubmission['status'] }) {
  const treatments: Record<SpokeSubmission['status'], { label: string; bg: string; color: string; border: string }> = {
    draft:           { label: 'Draft',        bg: 'var(--color-warning-light)', color: 'var(--color-warning)', border: 'var(--color-warning-border)' },
    submitted:       { label: 'Submitted',    bg: 'var(--color-info-light)',    color: 'var(--color-info)',    border: 'var(--color-info)' },
    acknowledged:    { label: 'Acknowledged', bg: 'var(--color-bg-hover)',      color: 'var(--color-text-secondary)', border: 'var(--color-border-subtle)' },
    'modified-by-hub': { label: 'Modified',   bg: 'var(--color-bg-hover)',      color: 'var(--color-text-secondary)', border: 'var(--color-border-subtle)' },
  };
  const t = treatments[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {t.label}
    </span>
  );
}
