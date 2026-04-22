'use client';

import { use, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Lock, CheckCircle2, Sparkles, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import {
  useBenches,
  useDemandLines,
  useProducts,
  useProductionRuns,
  useSites,
  assignToBench,
  addDemandToRun,
  lockRun,
  type ProductionRun,
  type Bench,
  type Site,
} from '@/components/Production/productionStore';
import { buildMatrix, siteCode, type MatrixRow, type ProductMatrix } from '@/components/Production/planMatrix';
import {
  benchesFor,
  recommendedBench,
  isMadeProduct,
} from '@/components/Production/benchRouting';
import { getBatchMinutes, formatMinutes } from '@/components/Production/batchTimeLookup';
import StatusPill, { type PillTone } from '@/components/Production/primitives/StatusPill';

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

export default function ProductionPlanPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = use(params);
  const allRuns = useProductionRuns();
  const allDemand = useDemandLines();
  const benches = useBenches();
  const products = useProducts();
  const sites = useSites();

  const runsToday = allRuns.filter(r => r.scheduledDate === date);

  // Single top-level toggle for forecast visibility. Default: show.
  const [showForecast, setShowForecast] = useState(true);

  // Unassigned demand = not linked to any run's linkedDemandLineIds, for this date.
  const linkedDemandIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of runsToday) for (const id of r.linkedDemandLineIds) s.add(id);
    return s;
  }, [runsToday]);

  const unassignedDemand = useMemo(
    () =>
      allDemand.filter(d => {
        const linked = linkedDemandIds.has(d.id);
        const sameDate = d.requiredByDateTime.startsWith(date);
        return !linked && sameDate;
      }),
    [allDemand, linkedDemandIds, date],
  );

  const unassignedMatrix = useMemo(
    () => buildMatrix(unassignedDemand, products, sites),
    [unassignedDemand, products, sites],
  );

  const [expandedRunId, setExpandedRunId] = useState<string | null>(
    runsToday.find(r => r.status === 'draft')?.id ?? runsToday[0]?.id ?? null,
  );

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalAssignedMinutes = 0;
    let totalUnassignedProducts = unassignedMatrix.rows.length;

    for (const run of runsToday) {
      const linked = allDemand.filter(d => run.linkedDemandLineIds.includes(d.id));
      const matrix = buildMatrix(linked, products, sites);
      for (const row of matrix.rows) {
        totalUnits += row.total;
        if (row.product && isMadeProduct(row.product)) {
          const a = run.benchAssignments.find(x => x.productId === row.productId);
          if (a) totalAssignedMinutes += a.estimatedMinutes;
          else totalUnassignedProducts += 1;
        }
      }
    }

    return {
      runs: runsToday.length,
      totalUnits,
      totalAssignedHours: (totalAssignedMinutes / 60).toFixed(1),
      totalUnassignedProducts,
    };
  }, [runsToday, allDemand, products, sites, unassignedMatrix]);

  function handleAutoAssign(runId: string) {
    const run = runsToday.find(r => r.id === runId);
    if (!run) return;
    const linked = allDemand.filter(d => run.linkedDemandLineIds.includes(d.id));
    const matrix = buildMatrix(linked, products, sites);
    for (const row of matrix.rows) {
      if (!row.product || !isMadeProduct(row.product)) continue;
      const already = run.benchAssignments.find(b => b.productId === row.productId);
      if (already) continue;
      const bench = recommendedBench(row.productId, benches);
      if (!bench) continue;
      assignToBench({
        runId,
        benchId: bench.id,
        productId: row.productId,
        quantity: row.total,
        estimatedMinutes: getBatchMinutes(row.productId, row.total),
      });
    }
  }

  return (
    <div style={{ fontFamily: 'var(--font-primary)', padding: '20px 24px 60px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Summary strip + forecast toggle */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <SummaryMetric value={summary.runs} label="Runs today" />
          <SummaryMetric value={summary.totalUnits} label="Units to produce" />
          <SummaryMetric value={`${summary.totalAssignedHours}h`} label="Bench-hours assigned" />
          <SummaryMetric
            value={summary.totalUnassignedProducts}
            label="Unassigned products"
            tone={summary.totalUnassignedProducts > 0 ? 'warning' : 'success'}
          />
        </div>
        <ForecastToggle showForecast={showForecast} onChange={setShowForecast} />
      </div>

      {/* Unassigned section */}
      {unassignedMatrix.rows.length > 0 && (
        <UnassignedCard
          matrix={unassignedMatrix}
          sites={sites}
          showForecast={showForecast}
          runs={runsToday}
        />
      )}

      {runsToday.length === 0 && unassignedMatrix.rows.length === 0 && (
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
          No runs scheduled for {date}.
        </div>
      )}

      {/* Run matrices */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {runsToday.map(run => (
          <RunCard
            key={run.id}
            run={run}
            benches={benches}
            products={products}
            sites={sites}
            allDemand={allDemand}
            expanded={expandedRunId === run.id}
            onToggle={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
            showForecast={showForecast}
            onAutoAssign={() => handleAutoAssign(run.id)}
            onLock={() => lockRun(run.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── subcomponents ───────────────────────────

function ForecastToggle({
  showForecast,
  onChange,
}: {
  showForecast: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!showForecast)}
      aria-pressed={showForecast}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '6px 12px',
        borderRadius: '100px',
        border: `1px solid ${showForecast ? 'var(--color-accent-active)' : 'var(--color-border-subtle)'}`,
        background: showForecast ? 'rgba(34,68,68,0.06)' : '#fff',
        color: showForecast ? 'var(--color-accent-active)' : 'var(--color-text-muted)',
        fontSize: '11px',
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        cursor: 'pointer',
        letterSpacing: '0.02em',
      }}
    >
      {showForecast ? <Eye size={12} strokeWidth={2.2} /> : <EyeOff size={12} strokeWidth={2.2} />}
      Forecast {showForecast ? 'shown' : 'hidden'}
    </button>
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
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '2px' }}>
        {label}
      </span>
    </div>
  );
}

function UnassignedCard({
  matrix,
  sites,
  showForecast,
  runs,
}: {
  matrix: ProductMatrix;
  sites: readonly Site[];
  showForecast: boolean;
  runs: ProductionRun[];
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid var(--color-warning)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        marginBottom: '14px',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(146,64,14,0.06)',
          borderBottom: '1px solid var(--color-warning)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <AlertTriangle size={14} strokeWidth={2.4} color="var(--color-warning)" />
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-warning)' }}>
          Unassigned demand
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {matrix.rows.length} {matrix.rows.length === 1 ? 'product' : 'products'} · {matrix.grandTotal} units · not in any run
        </div>
      </div>
      <PlanMatrixTable
        matrix={matrix}
        sites={sites}
        showForecast={showForecast}
        mode="unassigned"
        runs={runs}
      />
    </div>
  );
}

function RunCard({
  run,
  benches,
  products,
  sites,
  allDemand,
  expanded,
  onToggle,
  showForecast,
  onAutoAssign,
  onLock,
}: {
  run: ProductionRun;
  benches: readonly Bench[];
  products: ReturnType<typeof useProducts>;
  sites: readonly Site[];
  allDemand: ReturnType<typeof useDemandLines>;
  expanded: boolean;
  onToggle: () => void;
  showForecast: boolean;
  onAutoAssign: () => void;
  onLock: () => void;
}) {
  const linkedDemand = allDemand.filter(d => run.linkedDemandLineIds.includes(d.id));
  const matrix = buildMatrix(linkedDemand, products, sites);

  const madeRows = matrix.rows.filter(r => r.product && isMadeProduct(r.product));
  const stockedRows = matrix.rows.filter(r => !r.product || !isMadeProduct(r.product));
  const unassignedCount = madeRows.filter(
    r => !run.benchAssignments.some(a => a.productId === r.productId),
  ).length;
  const lockable = run.status === 'draft' && unassignedCount === 0 && madeRows.length > 0;
  const benchesUsed = new Set(run.benchAssignments.map(a => a.benchId)).size;

  const madeMatrix: ProductMatrix = { ...matrix, rows: madeRows };
  const stockedMatrix: ProductMatrix = { ...matrix, rows: stockedRows };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid',
        borderColor: run.status === 'locked' ? 'var(--color-success)' : 'var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
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
            {run.scheduledStart}–{run.scheduledEnd} · {matrix.rows.length} {matrix.rows.length === 1 ? 'product' : 'products'} · {benchesUsed} {benchesUsed === 1 ? 'bench' : 'benches'}
          </div>
        </div>
        <StatusPill label={RUN_TYPE_LABEL[run.runType]} tone={RUN_TYPE_TONE[run.runType]} />
        <StatusPill
          label={run.status.replace('_', ' ').toUpperCase()}
          tone={RUN_STATUS_TONE[run.status]}
        />
        {unassignedCount > 0 ? (
          <StatusPill
            label={`${unassignedCount} to assign`}
            tone="warning"
            icon={<AlertTriangle size={10} strokeWidth={2.4} />}
          />
        ) : (
          <span />
        )}
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'right' }}>
          {matrix.grandTotal}
          <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '4px' }}>units</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border-subtle)', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {run.status === 'draft' && unassignedCount > 0 && (
              <button type="button" onClick={onAutoAssign} style={outlineButton}>
                <Sparkles size={12} strokeWidth={2.2} />
                Auto-assign ({unassignedCount})
              </button>
            )}
            {run.status === 'draft' && (
              <button
                type="button"
                onClick={onLock}
                disabled={!lockable}
                style={lockable ? primaryButton : primaryButtonDisabled}
              >
                <Lock size={12} strokeWidth={2.4} />
                Lock plan
              </button>
            )}
            {run.status === 'locked' && (
              <div style={lockedChip}>
                <CheckCircle2 size={12} strokeWidth={2.4} />
                Plan locked — bench tasks ready
              </div>
            )}
          </div>

          {madeRows.length > 0 && (
            <>
              <SectionTitle>Made products</SectionTitle>
              <PlanMatrixTable
                matrix={madeMatrix}
                sites={sites}
                showForecast={showForecast}
                mode="run"
                run={run}
                benches={benches}
              />
            </>
          )}

          {stockedRows.length > 0 && (
            <>
              <div style={{ marginTop: '14px' }}>
                <SectionTitle>Stocked (pick-list only)</SectionTitle>
              </div>
              <PlanMatrixTable
                matrix={stockedMatrix}
                sites={sites}
                showForecast={showForecast}
                mode="stocked"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PlanMatrixTable({
  matrix,
  sites,
  showForecast,
  mode,
  run,
  benches,
  runs,
}: {
  matrix: ProductMatrix;
  sites: readonly Site[];
  showForecast: boolean;
  mode: 'run' | 'stocked' | 'unassigned';
  run?: ProductionRun;
  benches?: readonly Bench[];
  runs?: ProductionRun[];
}) {
  const siteObjects = matrix.siteIds
    .map(id => sites.find(s => s.id === id))
    .filter((s): s is Site => Boolean(s));

  const showBenchColumn = mode === 'run';
  const showActionColumn = mode === 'unassigned';

  function visibleTotal(row: MatrixRow) {
    return showForecast ? row.total : row.committedTotal;
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-item)',
        overflow: 'auto',
      }}
    >
      <div style={{ minWidth: 'max-content' }}>
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: buildColumns(siteObjects.length, showBenchColumn, showActionColumn),
            alignItems: 'center',
            gap: '10px',
            padding: '8px 14px',
            background: 'var(--color-bg-hover)',
            borderBottom: '1px solid var(--color-border-subtle)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          <div>Product</div>
          {siteObjects.map(site => (
            <div
              key={site.id}
              title={site.name}
              style={{ textAlign: 'right', fontSize: '10px', fontWeight: 700 }}
            >
              {siteCode(site)}
            </div>
          ))}
          <div style={{ textAlign: 'right' }}>Total</div>
          {showBenchColumn && <div>Bench</div>}
          {showBenchColumn && <div style={{ textAlign: 'right' }}>~Min</div>}
          {showActionColumn && <div style={{ textAlign: 'right' }}>Action</div>}
        </div>

        {/* Rows */}
        {matrix.rows.map((row, idx) => {
          const assignment = run?.benchAssignments.find(a => a.productId === row.productId);
          const shownTotal = visibleTotal(row);
          const hiddenForecast = showForecast ? 0 : row.forecastTotal;
          const compatibleBenches = benches ? benchesFor(row.productId, benches) : [];
          const locked = run?.status !== 'draft';
          const estMin = assignment?.estimatedMinutes ?? getBatchMinutes(row.productId, shownTotal || row.total);

          return (
            <div
              key={row.productId}
              style={{
                display: 'grid',
                gridTemplateColumns: buildColumns(siteObjects.length, showBenchColumn, showActionColumn),
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderBottom: idx === matrix.rows.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
                background: assignment || mode !== 'run' ? '#fff' : 'rgba(146,64,14,0.04)',
              }}
            >
              {/* Product name + priority */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.priority && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        borderRadius: '4px',
                        marginRight: '6px',
                        background: 'rgba(146,64,14,0.12)',
                        color: 'var(--color-warning)',
                        fontSize: '10px',
                        fontWeight: 800,
                        lineHeight: 1,
                        verticalAlign: 'middle',
                      }}
                      aria-label="priority"
                      title="Priority product — make first"
                    >
                      !
                    </span>
                  )}
                  {row.product?.name ?? row.productId}
                </div>
              </div>

              {/* Per-spoke cells */}
              {siteObjects.map(site => {
                const cell = row.bySite.get(site.id);
                if (!cell) return <div key={site.id} style={emptyCell}>—</div>;
                const isPureForecast = cell.hasForecast && !cell.hasCommitted;
                if (isPureForecast && !showForecast) {
                  return <div key={site.id} style={emptyCell}>—</div>;
                }
                return (
                  <div
                    key={site.id}
                    title={cell.sources.join(' · ')}
                    style={{
                      textAlign: 'right',
                      fontSize: '14px',
                      fontWeight: isPureForecast ? 500 : 700,
                      fontStyle: isPureForecast ? 'italic' : 'normal',
                      color: isPureForecast ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                      opacity: isPureForecast ? 0.75 : 1,
                    }}
                  >
                    {cell.qty}
                    {cell.hasCatering && (
                      <sup style={{ fontSize: '9px', marginLeft: '1px', color: 'var(--color-warning)' }}>c</sup>
                    )}
                  </div>
                );
              })}

              {/* Total */}
              <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {shownTotal}
                {hiddenForecast > 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      marginLeft: '4px',
                      fontStyle: 'italic',
                    }}
                    title={`${hiddenForecast} forecast units hidden — toggle on to reveal`}
                  >
                    +{hiddenForecast}
                  </span>
                )}
              </div>

              {/* Bench picker */}
              {showBenchColumn && (
                <div>
                  {compatibleBenches.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--color-error)' }}>
                      No compatible bench
                    </span>
                  ) : (
                    <select
                      value={assignment?.benchId ?? ''}
                      onChange={(e) => {
                        if (!run) return;
                        assignToBench({
                          runId: run.id,
                          benchId: e.target.value,
                          productId: row.productId,
                          quantity: row.total,
                          estimatedMinutes: getBatchMinutes(row.productId, row.total),
                        });
                      }}
                      disabled={locked}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border-subtle)',
                        background: locked ? 'var(--color-bg-hover)' : '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: assignment ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                        fontFamily: 'var(--font-primary)',
                        cursor: locked ? 'default' : 'pointer',
                      }}
                    >
                      {!assignment && <option value="" disabled>Assign…</option>}
                      {compatibleBenches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {showBenchColumn && (
                <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {assignment || compatibleBenches.length > 0 ? `~${formatMinutes(estMin)}` : '—'}
                </div>
              )}

              {showActionColumn && runs && (
                <div style={{ textAlign: 'right' }}>
                  <AddToRunMenu row={row} runs={runs} />
                </div>
              )}
            </div>
          );
        })}

        {/* Column totals footer */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: buildColumns(siteObjects.length, showBenchColumn, showActionColumn),
            alignItems: 'center',
            gap: '10px',
            padding: '8px 14px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-hover)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
          }}
        >
          <div>Totals</div>
          {siteObjects.map(site => {
            const totalMap = showForecast ? matrix.siteTotals : matrix.siteCommittedTotals;
            return (
              <div key={site.id} style={{ textAlign: 'right', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                {totalMap.get(site.id) ?? 0}
              </div>
            );
          })}
          <div style={{ textAlign: 'right', color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '14px' }}>
            {showForecast ? matrix.grandTotal : matrix.grandCommittedTotal}
          </div>
          {showBenchColumn && <div />}
          {showBenchColumn && <div />}
          {showActionColumn && <div />}
        </div>
      </div>
    </div>
  );
}

function AddToRunMenu({ row, runs }: { row: MatrixRow; runs: ProductionRun[] }) {
  const drafts = runs.filter(r => r.status === 'draft');
  if (drafts.length === 0) {
    return <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No draft runs</span>;
  }
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const runId = e.target.value;
        if (!runId) return;
        addDemandToRun(runId, row.demandLineIds);
      }}
      style={{
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid var(--color-accent-active)',
        background: '#fff',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-accent-active)',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <option value="">+ Add to run…</option>
      {drafts.map(r => (
        <option key={r.id} value={r.id}>{r.name.split(' · ')[0]}</option>
      ))}
    </select>
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

// ─────────────────────────── style helpers ───────────────────────────

function buildColumns(spokeCount: number, showBenchColumn: boolean, showActionColumn: boolean) {
  const cols: string[] = ['minmax(200px, 1.5fr)'];
  for (let i = 0; i < spokeCount; i++) cols.push('60px');
  cols.push('80px');
  if (showBenchColumn) cols.push('minmax(140px, 180px)');
  if (showBenchColumn) cols.push('64px');
  if (showActionColumn) cols.push('150px');
  return cols.join(' ');
}

const emptyCell: React.CSSProperties = {
  textAlign: 'right',
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
};

const outlineButton: React.CSSProperties = {
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
};

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: '8px',
  background: 'var(--color-accent-active)',
  border: 'none',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  cursor: 'pointer',
};

const primaryButtonDisabled: React.CSSProperties = {
  ...primaryButton,
  background: 'var(--color-bg-hover)',
  color: 'var(--color-text-muted)',
  cursor: 'not-allowed',
};

const lockedChip: React.CSSProperties = {
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
};
