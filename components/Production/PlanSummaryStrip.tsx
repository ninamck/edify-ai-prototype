'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { usePlan, usePlanStore } from './PlanStore';
import { effectiveBatchRules, proposeBatchSplit, type SiteId } from './fixtures';
import { useRole } from './RoleContext';

type Props = {
  siteId: SiteId;
  date: string;
  /** When true, strip links to the Amounts page. Default true. */
  linkToAmounts?: boolean;
};

/**
 * Compact read-only summary of the current plan, designed to sit atop any view
 * downstream of Amounts (board, plan, PCR). Reacts live to overrides.
 */
export default function PlanSummaryStrip({ siteId, date, linkToAmounts = true }: Props) {
  const lines = usePlan(siteId, date);
  const { overrideCount, resetAll } = usePlanStore();
  const { can } = useRole();
  const canEdit = can('plan.editQuantity');
  const dateOverrideCount = overrideCount(date);

  const summary = useMemo(() => {
    let units = 0;
    let batches = 0;
    let shortfalls = 0;
    let variance = 0;
    for (const line of lines) {
      const eff = effectiveBatchRules(line.recipe.batchRules, line.primaryBench?.batchRules);
      const split = proposeBatchSplit(line.effectivePlanned, eff);
      units += line.effectivePlanned;
      batches += split.batches.length;
      variance += line.planned - line.quinnProposed;
      if (line.assemblyDemand.totalUnits > line.planned) shortfalls += 1;
    }
    return { units, batches, shortfalls, variance, recipeCount: lines.length };
  }, [lines]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 14px',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: summary.shortfalls > 0 ? 'var(--color-error-light)' : '#ffffff',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
        }}
      >
        <Sparkles size={11} color="var(--color-text-muted)" /> Today&rsquo;s plan
      </span>
      <SummaryChip label="Recipes" value={summary.recipeCount} />
      <SummaryChip label="Units" value={summary.units} emphasise />
      <SummaryChip label="Batches" value={summary.batches} />
      {dateOverrideCount > 0 && (
        <SummaryChip
          label="Manager edits"
          value={`${dateOverrideCount} · ${formatSigned(summary.variance)} vs Quinn`}
          tone="warning"
        />
      )}
      {summary.shortfalls > 0 && (
        <SummaryChip
          label="Shortfalls"
          value={summary.shortfalls}
          tone="error"
          icon={<AlertTriangle size={11} />}
        />
      )}
      <div style={{ flex: 1 }} />
      {dateOverrideCount > 0 && canEdit && (
        <button
          type="button"
          onClick={() => resetAll(date)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 5,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            background: '#ffffff',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={10} /> Reset all to Quinn
        </button>
      )}
      {linkToAmounts && (
          <Link
          href="/production/amounts"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 5,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--font-primary)',
            background: '#ffffff',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Adjust amounts <ArrowRight size={10} />
        </Link>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  emphasise,
  tone = 'default',
  icon,
}: {
  label: string;
  value: number | string;
  emphasise?: boolean;
  tone?: 'default' | 'warning' | 'error';
  icon?: React.ReactNode;
}) {
  const color =
    tone === 'error'
      ? 'var(--color-error)'
      : 'var(--color-text-primary)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 5,
        fontSize: 11,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {icon && (
        <span style={{ color, alignSelf: 'center' }}>{icon}</span>
      )}
      <span
        style={{
          fontSize: 9,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasise ? 15 : 13,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </span>
  );
}

function formatSigned(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}
