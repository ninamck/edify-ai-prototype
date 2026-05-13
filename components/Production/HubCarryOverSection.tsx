'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ArrowRight, Package } from 'lucide-react';
import {
  PRET_CARRY_OVER,
  PRET_SITES,
  getRecipe,
  getSite,
  type CarryOverEntry,
  type SiteId,
} from '@/components/Production/fixtures';

/**
 * HubCarryOverSection — read-only summary card for the dispatch Today
 * page showing yesterday's leftovers across this hub and the spokes it
 * supplies. Carry-over is already netted into each spoke's order, so
 * this section is informational only — it gives the hub manager
 * visibility into why a spoke's number is lower than expected and a
 * one-click jump into the full carry-over review screen.
 *
 * Two halves:
 *   - "This hub" — counter unsold from yesterday that nets out of the
 *     hub's own plan. Live count + deep-link to /production/carry-over.
 *   - "Spokes" — per-spoke totals so the manager can see at a glance
 *     which spoke is starting the day with stock already on the shelf.
 */
export default function HubCarryOverSection({ hubId }: { hubId: SiteId }) {
  const [open, setOpen] = useState(true);

  const { hubEntries, spokeBuckets, hubTotal, spokeTotal } = useMemo(() => {
    // Hub's own counter carry-over (excludes already-expired/zero rows
    // since those auto-route to waste and don't affect dispatch).
    const hubEntries = PRET_CARRY_OVER.filter(
      (c) => c.siteId === hubId && c.carriedUnits > 0,
    );

    // Spokes that pull from this hub.
    const spokes = PRET_SITES.filter(
      (s) => s.type !== 'HUB' && s.hubId === hubId,
    );

    const spokeBuckets = spokes
      .map((s) => {
        const entries = PRET_CARRY_OVER.filter(
          (c) => c.siteId === s.id && c.carriedUnits > 0,
        );
        const total = entries.reduce((a, b) => a + b.carriedUnits, 0);
        return { site: s, entries, total };
      })
      .filter((b) => b.entries.length > 0);

    const hubTotal = hubEntries.reduce((a, b) => a + b.carriedUnits, 0);
    const spokeTotal = spokeBuckets.reduce((a, b) => a + b.total, 0);

    return { hubEntries, spokeBuckets, hubTotal, spokeTotal };
  }, [hubId]);

  const grandTotal = hubTotal + spokeTotal;
  const hubName = getSite(hubId)?.name ?? 'This hub';

  // Empty state — render nothing rather than an empty card so the page
  // doesn't carry visual debt when nobody has leftovers.
  if (grandTotal === 0) return null;

  return (
    <section
      style={{
        margin: '12px 32px 0',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-primary)',
          textAlign: 'left',
        }}
      >
        <Package size={16} color="var(--color-text-muted)" />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          Carry-over from yesterday
        </h3>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            background: 'var(--color-bg-hover)',
            color: 'var(--color-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {grandTotal} units
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontWeight: 500,
          }}
        >
          {hubTotal > 0 && `${hubTotal} on this hub`}
          {hubTotal > 0 && spokeTotal > 0 && ' · '}
          {spokeTotal > 0 &&
            `${spokeTotal} across ${spokeBuckets.length} ${
              spokeBuckets.length === 1 ? 'spoke' : 'spokes'
            }`}
        </span>
        <div style={{ flex: 1 }} />
        {open ? (
          <ChevronUp size={14} color="var(--color-text-muted)" />
        ) : (
          <ChevronDown size={14} color="var(--color-text-muted)" />
        )}
      </button>

      {open && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
            gap: 0,
            borderTop: '1px solid var(--color-border-subtle)',
          }}
        >
          {/* This hub */}
          <div
            style={{
              padding: '14px 16px',
              borderRight: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-muted)',
                }}
              >
                This hub · {hubName}
              </span>
              <Link
                href="/production/carry-over"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-accent-active)',
                  textDecoration: 'none',
                }}
              >
                Review
                <ArrowRight size={11} />
              </Link>
            </div>
            {hubEntries.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic',
                }}
              >
                No counter unsold to carry over.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {hubEntries.map((e) => (
                  <RecipeRow key={e.id} entry={e} />
                ))}
              </div>
            )}
          </div>

          {/* Spokes */}
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted)',
              }}
            >
              Spokes · already netted out of today&rsquo;s orders
            </span>
            {spokeBuckets.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  fontStyle: 'italic',
                }}
              >
                No spoke carry-over flagged for today.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 8,
                }}
              >
                {spokeBuckets.map((b) => (
                  <SpokeBucket
                    key={b.site.id}
                    name={b.site.name}
                    total={b.total}
                    entries={b.entries}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function RecipeRow({ entry }: { entry: CarryOverEntry }) {
  const recipe = getRecipe(entry.recipeId);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          color: 'var(--color-text-primary)',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {recipe?.name ?? entry.recipeId}
      </span>
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-secondary)',
          fontWeight: 700,
        }}
      >
        {entry.carriedUnits}
      </span>
    </div>
  );
}

function SpokeBucket({
  name,
  total,
  entries,
}: {
  name: string;
  total: number;
  entries: CarryOverEntry[];
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-hover)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--color-text-secondary)',
          }}
        >
          {total} units
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        {entries.map((e) => {
          const r = getRecipe(e.recipeId);
          return (
            <span
              key={e.id}
              title={e.reason}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 999,
                background: '#ffffff',
                border: '1px solid var(--color-border-subtle)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r?.name ?? e.recipeId}
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  fontWeight: 700,
                }}
              >
                ·{e.carriedUnits}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
