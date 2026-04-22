'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Lock, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import {
  useBenches,
  useDemandLines,
  useProducts,
  useProductionRuns,
  assignToBench,
  removeBenchAssignment,
  lockRun,
  type ProductionRun,
  type Bench,
  type Product,
  type DemandLine,
  type BenchAssignment,
} from '@/components/Production/productionStore';
import {
  benchesFor,
  recommendedBench,
  isMadeProduct,
} from '@/components/Production/benchRouting';
import { getBatchMinutes, formatMinutes } from '@/components/Production/batchTimeLookup';
import StatusPill, { type PillTone } from '@/components/Production/primitives/StatusPill';

type AggregatedProduct = {
  productId: string;
  product: Product | undefined;
  quantity: number;
  demandLineIds: string[];
  earliestRequiredBy: string;
  latestRequiredBy: string;
  sites: Set<string>;
};

function aggregateDemandByProduct(
  run: ProductionRun,
  allDemand: readonly DemandLine[],
  products: readonly Product[],
): AggregatedProduct[] {
  const linked = allDemand.filter(d => run.linkedDemandLineIds.includes(d.id));
  const byProduct = new Map<string, AggregatedProduct>();
  for (const d of linked) {
    const product = products.find(p => p.id === d.productId);
    const existing = byProduct.get(d.productId);
    if (existing) {
      existing.quantity += d.quantity;
      existing.demandLineIds.push(d.id);
      if (d.requiredByDateTime < existing.earliestRequiredBy) existing.earliestRequiredBy = d.requiredByDateTime;
      if (d.requiredByDateTime > existing.latestRequiredBy) existing.latestRequiredBy = d.requiredByDateTime;
      existing.sites.add(d.siteId);
    } else {
      byProduct.set(d.productId, {
        productId: d.productId,
        product,
        quantity: d.quantity,
        demandLineIds: [d.id],
        earliestRequiredBy: d.requiredByDateTime,
        latestRequiredBy: d.requiredByDateTime,
        sites: new Set([d.siteId]),
      });
    }
  }
  return [...byProduct.values()].sort((a, b) =>
    (a.product?.name ?? '').localeCompare(b.product?.name ?? ''),
  );
}

const RUN_TYPE_TONE: Record<string, PillTone> = {
  fixed: 'info',
  variable: 'accent',
  on_demand: 'warning',
};

const RUN_TYPE_LABEL: Record<string, string> = {
  fixed: 'Fixed',
  variable: 'Variable',
  on_demand: 'On-demand',
};

const RUN_STATUS_TONE: Record<string, PillTone> = {
  draft: 'neutral',
  locked: 'success',
  in_progress: 'info',
  complete: 'success',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
}

export default function ProductionPlanPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = use(params);
  const router = useRouter();
  const allRuns = useProductionRuns();
  const allDemand = useDemandLines();
  const benches = useBenches();
  const products = useProducts();

  const runsToday = allRuns.filter(r => r.scheduledDate === date);

  const [expandedRunId, setExpandedRunId] = useState<string | null>(
    runsToday.find(r => r.status === 'draft')?.id ?? runsToday[0]?.id ?? null,
  );

  // Totals across all runs for the summary strip.
  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalAssignedMinutes = 0;
    let totalUnassignedProducts = 0;

    for (const run of runsToday) {
      const aggregated = aggregateDemandByProduct(run, allDemand, products);
      for (const a of aggregated) {
        totalUnits += a.quantity;
        if (a.product && isMadeProduct(a.product)) {
          const assignment = run.benchAssignments.find(b => b.productId === a.productId);
          if (assignment) {
            totalAssignedMinutes += assignment.estimatedMinutes;
          } else {
            totalUnassignedProducts += 1;
          }
        }
      }
    }

    return {
      runs: runsToday.length,
      totalUnits,
      totalAssignedHours: (totalAssignedMinutes / 60).toFixed(1),
      totalUnassignedProducts,
    };
  }, [runsToday, allDemand, products]);

  function handleAutoAssign(runId: string) {
    const run = runsToday.find(r => r.id === runId);
    if (!run) return;
    const aggregated = aggregateDemandByProduct(run, allDemand, products);
    for (const a of aggregated) {
      if (!a.product || !isMadeProduct(a.product)) continue;
      const already = run.benchAssignments.find(b => b.productId === a.productId);
      if (already) continue;
      const bench = recommendedBench(a.productId, benches);
      if (!bench) continue;
      assignToBench({
        runId,
        benchId: bench.id,
        productId: a.productId,
        quantity: a.quantity,
        estimatedMinutes: getBatchMinutes(a.productId, a.quantity),
      });
    }
  }

  function handleAssign(runId: string, productId: string, quantity: number, benchId: string) {
    assignToBench({
      runId,
      benchId,
      productId,
      quantity,
      estimatedMinutes: getBatchMinutes(productId, quantity),
    });
  }

  function handleLock(runId: string) {
    lockRun(runId);
  }

  return (
    <div style={{ fontFamily: 'var(--font-primary)', padding: '20px 24px 60px', maxWidth: '1160px', margin: '0 auto' }}>
      {/* Summary strip */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          marginBottom: '18px',
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <SummaryMetric value={summary.runs} label="Runs today" />
        <SummaryMetric value={summary.totalUnits} label="Units to produce" />
        <SummaryMetric value={`${summary.totalAssignedHours}h`} label="Bench-hours assigned" />
        <SummaryMetric
          value={summary.totalUnassignedProducts}
          label="Unassigned products"
          tone={summary.totalUnassignedProducts > 0 ? 'warning' : 'success'}
        />
      </div>

      {runsToday.length === 0 && (
        <div
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            background: '#fff',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-card)',
            fontSize: '13px',
          }}
        >
          No runs scheduled for {date}. Head to the Demand Dashboard to create one from pending demand.
        </div>
      )}

      {/* Run cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {runsToday.map(run => {
          const expanded = expandedRunId === run.id;
          const aggregated = aggregateDemandByProduct(run, allDemand, products);
          const madeAggregated = aggregated.filter(a => a.product && isMadeProduct(a.product));
          const stockedAggregated = aggregated.filter(a => !a.product || !isMadeProduct(a.product));
          const unassignedCount = madeAggregated.filter(a => !run.benchAssignments.some(b => b.productId === a.productId)).length;
          const lockable = run.status === 'draft' && unassignedCount === 0 && madeAggregated.length > 0;
          const benchesUsed = new Set(run.benchAssignments.map(a => a.benchId)).size;

          return (
            <div
              key={run.id}
              style={{
                background: '#fff',
                border: '1px solid',
                borderColor: run.status === 'locked' ? 'var(--color-success)' : 'var(--color-border-subtle)',
                borderRadius: 'var(--radius-card)',
                overflow: 'hidden',
              }}
            >
              {/* Run header */}
              <button
                type="button"
                onClick={() => setExpandedRunId(expanded ? null : run.id)}
                style={{
                  all: 'unset',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1.5fr auto auto auto auto',
                  alignItems: 'center',
                  gap: '14px',
                  width: 'calc(100% - 32px)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  background: expanded ? 'var(--color-bg-hover)' : 'transparent',
                  fontFamily: 'var(--font-primary)',
                }}
              >
                {expanded ? (
                  <ChevronDown size={16} strokeWidth={2.2} color="var(--color-text-secondary)" />
                ) : (
                  <ChevronRight size={16} strokeWidth={2.2} color="var(--color-text-secondary)" />
                )}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {run.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {run.scheduledStart}–{run.scheduledEnd} · {aggregated.length} {aggregated.length === 1 ? 'product' : 'products'} · {benchesUsed} {benchesUsed === 1 ? 'bench' : 'benches'}
                  </div>
                </div>
                <StatusPill label={RUN_TYPE_LABEL[run.runType]} tone={RUN_TYPE_TONE[run.runType]} />
                <StatusPill
                  label={run.status.replace('_', ' ').toUpperCase()}
                  tone={RUN_STATUS_TONE[run.status]}
                />
                {unassignedCount > 0 && (
                  <StatusPill
                    label={`${unassignedCount} to assign`}
                    tone="warning"
                    icon={<AlertTriangle size={10} strokeWidth={2.4} />}
                  />
                )}
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>
                  {aggregated.reduce((s, a) => s + a.quantity, 0)}
                  <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '4px' }}>units</span>
                </div>
              </button>

              {/* Expanded body */}
              {expanded && (
                <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border-subtle)', background: '#fff' }}>
                  {/* Action row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {run.status === 'draft' && unassignedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAutoAssign(run.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: '#fff',
                          border: '1px solid var(--color-accent-active)',
                          color: 'var(--color-accent-active)',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <Sparkles size={12} strokeWidth={2.2} />
                        Auto-assign ({unassignedCount})
                      </button>
                    )}
                    {run.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleLock(run.id)}
                        disabled={!lockable}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: lockable ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                          border: 'none',
                          color: lockable ? '#fff' : 'var(--color-text-muted)',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-primary)',
                          cursor: lockable ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Lock size={12} strokeWidth={2.4} />
                        Lock plan
                      </button>
                    )}
                    {run.status === 'locked' && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          background: 'rgba(21,128,61,0.08)',
                          color: 'var(--color-success)',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: '1px solid var(--color-success)',
                        }}
                      >
                        <CheckCircle2 size={12} strokeWidth={2.4} />
                        Plan locked — bench tasks ready
                      </div>
                    )}
                  </div>

                  {/* Products section */}
                  {madeAggregated.length > 0 && (
                    <>
                      <SectionTitle>Made products to assign</SectionTitle>
                      <ProductTable
                        aggregated={madeAggregated}
                        run={run}
                        benches={benches}
                        onAssign={handleAssign}
                        onUnassign={(productId) => removeBenchAssignment(run.id, productId)}
                      />
                    </>
                  )}

                  {stockedAggregated.length > 0 && (
                    <>
                      <div style={{ marginTop: '14px' }}>
                        <SectionTitle>Stocked products (pick-list only)</SectionTitle>
                      </div>
                      <div
                        style={{
                          background: 'var(--color-bg-hover)',
                          border: '1px dashed var(--color-border-subtle)',
                          borderRadius: 'var(--radius-item)',
                          padding: '10px 12px',
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {stockedAggregated.map(a => `${a.product?.name ?? a.productId} × ${a.quantity}`).join(' · ')}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryMetric({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: 'warning' | 'success';
}) {
  const color =
    tone === 'warning' ? 'var(--color-warning)' :
    tone === 'success' ? 'var(--color-success)' :
    'var(--color-text-primary)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '22px', fontWeight: 700, color, lineHeight: 1.1 }}>{value}</span>
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>{label}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: 'var(--color-text-muted)',
        marginBottom: '8px',
      }}
    >
      {children}
    </div>
  );
}

function ProductTable({
  aggregated,
  run,
  benches,
  onAssign,
  onUnassign,
}: {
  aggregated: AggregatedProduct[];
  run: ProductionRun;
  benches: readonly Bench[];
  onAssign: (runId: string, productId: string, quantity: number, benchId: string) => void;
  onUnassign: (productId: string) => void;
}) {
  const locked = run.status !== 'draft';
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-item)',
        overflow: 'hidden',
      }}
    >
      {aggregated.map((a, idx) => {
        const assignment = run.benchAssignments.find(b => b.productId === a.productId);
        const compatibleBenches = benchesFor(a.productId, benches);
        const estMin = assignment?.estimatedMinutes ?? getBatchMinutes(a.productId, a.quantity);
        return (
          <div
            key={a.productId}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 100px 120px 1.3fr 80px',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderBottom: idx === aggregated.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
              background: assignment ? '#fff' : 'rgba(146,64,14,0.04)',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {a.product?.name ?? a.productId}
                {a.product?.priorityFlag && (
                  <span style={{ marginLeft: '8px', fontSize: '9px', fontWeight: 700, color: 'var(--color-warning)', letterSpacing: '0.04em' }}>
                    ·&nbsp;PRIORITY
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {a.sites.size} {a.sites.size === 1 ? 'site' : 'sites'}
              </div>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>
              {a.quantity}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              ~{formatMinutes(estMin)}
            </div>
            <div>
              {assignment ? (
                <BenchPicker
                  benches={compatibleBenches}
                  value={assignment.benchId}
                  disabled={locked}
                  onChange={(benchId) => onAssign(run.id, a.productId, a.quantity, benchId)}
                />
              ) : (
                <BenchPicker
                  benches={compatibleBenches}
                  value={null}
                  placeholder="Assign bench…"
                  disabled={locked}
                  onChange={(benchId) => onAssign(run.id, a.productId, a.quantity, benchId)}
                />
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {assignment && !locked && (
                <button
                  type="button"
                  onClick={() => onUnassign(a.productId)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BenchPicker({
  benches,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  benches: Bench[];
  value: string | null;
  placeholder?: string;
  disabled?: boolean;
  onChange: (benchId: string) => void;
}) {
  if (benches.length === 0) {
    return (
      <span style={{ fontSize: '11px', color: 'var(--color-error)' }}>
        No bench with this capability
      </span>
    );
  }
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid var(--color-border-subtle)',
        background: disabled ? 'var(--color-bg-hover)' : '#fff',
        fontSize: '12px',
        fontWeight: 600,
        color: value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
        fontFamily: 'var(--font-primary)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {!value && <option value="" disabled>{placeholder ?? 'Select bench'}</option>}
      {benches.map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}
