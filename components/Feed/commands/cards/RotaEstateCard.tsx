'use client';

/**
 * Estate answer: which sites ran under the labour guide last week and
 * what the same day parts cost. The HQ front door for the rota skill.
 *
 * One row per site, ranked most under guide first, with the cost read
 * from last week's outcomes: waste against the weekday average,
 * checklist completion, speed of service. Confirm opens the rebalance
 * for the site that ran furthest under and has a draft in Deputy, so
 * the store-level work is one click down. The full table lives on the
 * Labour page, linked from the foot of the card.
 */

import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';
import type { EstateLabourRow } from '@/components/Feed/commands/rota/siteData/estate';
import { body, label, small } from '@/components/Feed/commands/rota/ui/tokens';

export interface RotaEstateCardRow extends EstateLabourRow {
  siteName: string;
  /** True when the site has a Deputy draft and can be rebalanced. */
  hasDraft: boolean;
}

function signedHours(h: number): string {
  if (h === 0) return 'on guide';
  return `${h > 0 ? '+' : '-'}${Math.abs(h)}h`;
}

function tone(h: number): { color: string; bg: string } {
  if (h <= -2) return { color: 'var(--color-error)', bg: 'var(--color-error-light)' };
  if (h < 0) return { color: 'var(--color-text-primary)', bg: 'var(--color-warning-light)' };
  if (h >= 3) return { color: 'var(--color-text-secondary)', bg: 'var(--color-bg-hover)' };
  return { color: 'var(--color-text-primary)', bg: 'transparent' };
}

export default function RotaEstateCard({
  rows,
  weekLabel,
  rebalanceSite,
  state,
  onRebalance,
  onNotNow,
}: {
  rows: RotaEstateCardRow[];
  weekLabel: string;
  /** The site the confirm button rebalances, if any has a draft. */
  rebalanceSite?: { siteId: string; siteName: string };
  state: CardState;
  onRebalance: () => void;
  onNotNow: () => void;
}) {
  const under = rows.filter((r) => r.hoursVsGuide < 0);
  return (
    <CardShell
      icon={Building2}
      title={`Hours against guide, ${weekLabel}`}
      subtitle={under.length === 0 ? 'Every site on or over guide' : `${under.length} of ${rows.length} sites ran under guide`}
      state={state}
      confirmLabel={rebalanceSite ? `Rebalance ${rebalanceSite.siteName} for next week` : 'Done'}
      cancelLabel="Not now"
      onConfirm={onRebalance}
      onCancel={onNotNow}
      confirmDisabled={!rebalanceSite}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          role="table"
          aria-label="Sites ranked by hours against the labour guide last week, with waste, checklists and speed of service"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) auto auto auto auto', gap: '6px 14px', alignItems: 'center' }}
        >
          <div role="row" style={{ display: 'contents' }}>
            <span role="columnheader" style={label}>
              Site
            </span>
            <span role="columnheader" style={{ ...label, textAlign: 'right' }}>
              vs guide
            </span>
            <span role="columnheader" style={{ ...label, textAlign: 'right' }}>
              Waste
            </span>
            <span role="columnheader" style={{ ...label, textAlign: 'right' }}>
              Checks
            </span>
            <span role="columnheader" style={{ ...label, textAlign: 'right' }}>
              Service
            </span>
          </div>
          {rows.map((r) => {
            const t = tone(r.hoursVsGuide);
            return (
              <div key={r.siteId} role="row" style={{ display: 'contents' }}>
                <span role="cell" style={{ ...body, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{r.siteName}</span>
                  {r.note && (
                    <span style={{ ...small, display: 'block', fontWeight: 500, lineHeight: 1.35 }}>{r.note}</span>
                  )}
                </span>
                <span
                  role="cell"
                  style={{
                    ...body,
                    fontWeight: 700,
                    color: t.color,
                    background: t.bg,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    justifySelf: 'end',
                  }}
                >
                  {signedHours(r.hoursVsGuide)}
                </span>
                <span role="cell" style={{ ...body, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.wasteVsWeekday >= 1.4 ? 'var(--color-error)' : undefined }}>
                  {r.wasteVsWeekday.toFixed(1)}x
                </span>
                <span role="cell" style={{ ...body, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.checklistCompletion < 0.9 ? 'var(--color-error)' : undefined }}>
                  {Math.round(r.checklistCompletion * 100)}%
                </span>
                <span role="cell" style={{ ...body, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {r.speedOfServiceSec > 0 ? `${r.speedOfServiceSec}s` : <span style={small}>no counter</span>}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ ...small, lineHeight: 1.45 }}>
          Waste is the week&apos;s multiple of the weekday average. Checks are checklist steps completed; red is under 90%. Service is average speed at the counter.
        </div>
        <Link
          href="/labour?tab=estate"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-accent-active)', textDecoration: 'none', width: 'fit-content' }}
        >
          Open the estate view <ArrowRight size={12} aria-hidden="true" />
        </Link>
        {state === 'cancelled' && <div style={{ ...small, fontStyle: 'italic' }}>Left as it is. The table stays on the Labour page.</div>}
      </div>
    </CardShell>
  );
}
