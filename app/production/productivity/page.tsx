'use client';

/**
 * /production/productivity — PAC169 + PAC172
 *
 * GMs land here to see how the team performed: who's fast, who's slow,
 * which benches are humming, and how each individual batch landed against
 * its target time.
 *
 * Layout (top → bottom):
 *  1. Filter strip   — site + date-range chooser (today / D-1 / 7 days)
 *  2. Quinn insight  — single-line headline framing the period
 *  3. Aggregate KPIs — total batches, units, avg vs target, failed
 *  4. Per-employee leaderboard (PAC169)
 *  5. Per-bench utilisation
 *  6. Per-batch detail table (PAC172)
 */

import { useMemo, useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Award,
  Users,
  Clock,
  Package,
  Activity,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import {
  PRET_SITES,
  DEMO_TODAY,
  dayOffset,
  type SiteId,
} from '@/components/Production/fixtures';
import {
  siteProductivity,
  formatDelta,
  formatMinutes,
  type BatchProductivity,
  type EmployeeSummary,
  type BenchSummary,
} from '@/components/Production/productivity';

type DateRange = 'today' | 'yesterday' | 'last7';

export default function ProductivityPage() {
  const [siteId, setSiteId] = useState<SiteId>('hub-central');
  const [range, setRange] = useState<DateRange>('yesterday');
  const [batchSort, setBatchSort] = useState<{
    by: 'date' | 'recipe' | 'worker' | 'bench' | 'qty' | 'duration' | 'delta';
    dir: 'asc' | 'desc';
  }>({ by: 'date', dir: 'desc' });
  const [batchFilter, setBatchFilter] = useState<'all' | 'fast' | 'on-target' | 'slow' | 'failed'>('all');

  const dates = useMemo<string[]>(() => {
    if (range === 'today') return [DEMO_TODAY];
    if (range === 'yesterday') return [dayOffset(-1)];
    // last7 — DEMO_TODAY + 6 prior days
    return Array.from({ length: 7 }, (_, i) => dayOffset(-i));
  }, [range]);

  const summary = useMemo(() => siteProductivity(siteId, dates), [siteId, dates]);

  const sortedBatches = useMemo(() => {
    const filtered = summary.batches.filter(b => {
      if (b.batch.status === 'planned') return false;
      if (batchFilter === 'all') return true;
      return b.bucket === batchFilter;
    });
    const dir = batchSort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (batchSort.by) {
        case 'date':
          return dir * (a.batch.date.localeCompare(b.batch.date) || a.batch.startTime.localeCompare(b.batch.startTime));
        case 'recipe':
          return dir * a.recipeName.localeCompare(b.recipeName);
        case 'worker':
          return dir * a.workerName.localeCompare(b.workerName);
        case 'bench':
          return dir * a.benchName.localeCompare(b.benchName);
        case 'qty':
          return dir * (a.batch.actualQty - b.batch.actualQty);
        case 'duration':
          return dir * (a.actualMinutes - b.actualMinutes);
        case 'delta': {
          const av = a.deltaPercent ?? Number.POSITIVE_INFINITY;
          const bv = b.deltaPercent ?? Number.POSITIVE_INFINITY;
          return dir * (av - bv);
        }
      }
    });
  }, [summary.batches, batchSort, batchFilter]);

  const headline = quinnHeadline(summary);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Filter strip ───────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          flexWrap: 'wrap',
        }}
      >
        <span style={LABEL_STYLE}>Site</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {PRET_SITES.map(s => (
            <button key={s.id} onClick={() => setSiteId(s.id)} style={pillStyle(s.id === siteId)}>
              {s.name}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--color-border-subtle)' }} />

        <span style={LABEL_STYLE}>Period</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last7', label: 'Last 7 days' },
          ] as Array<{ id: DateRange; label: string }>).map(opt => (
            <button key={opt.id} onClick={() => setRange(opt.id)} style={pillStyle(opt.id === range)}>
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
          {summary.batchCount} batch{summary.batchCount === 1 ? '' : 'es'} ·{' '}
          {summary.totalUnits} units ·{' '}
          {dates.length === 1 ? formatHumanDate(dates[0]) : `${dates.length} days`}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Quinn insight banner */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-card)',
              border: `1px solid ${headline.borderColor}`,
              background: headline.bg,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <Sparkles size={20} color={headline.iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{headline.title}</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {headline.body}
              </p>
            </div>
          </div>

          {/* Aggregate KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <KPICard icon={<Package size={16} />} label="Batches completed" value={String(summary.batchCount - summary.failedCount)} sub={`${summary.totalUnits} units`} />
            <KPICard icon={<Clock size={16} />} label="Bench-time" value={formatMinutes(summary.totalMinutes)} sub={`${summary.batchCount} runs`} />
            <KPICard
              icon={deltaIcon(summary.avgDeltaPercent)}
              label="Avg vs target"
              value={summary.avgDeltaPercent == null ? '—' : formatDelta(summary.avgDeltaPercent)}
              sub={summary.avgDeltaPercent == null ? 'no targets' : 'weighted by target'}
              tone={deltaTone(summary.avgDeltaPercent)}
            />
            <KPICard
              icon={<AlertTriangle size={16} />}
              label="Failed batches"
              value={String(summary.failedCount)}
              sub={summary.failedCount === 0 ? 'all clean' : 'check waste log'}
              tone={summary.failedCount > 0 ? 'warning' : undefined}
            />
          </div>

          {/* Employee leaderboard */}
          <Section
            title="Employee leaderboard"
            icon={<Users size={16} />}
            badge={`${summary.employees.length} active`}
            subtitle="Ranked by average time vs target. Faster is better."
          >
            {summary.employees.length === 0 ? (
              <EmptyState text="No batches recorded for this period." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {summary.employees.map((emp, i) => (
                  <EmployeeRow key={emp.userId} rank={i + 1} emp={emp} />
                ))}
              </div>
            )}
          </Section>

          {/* Bench utilisation */}
          <Section
            title="Bench utilisation"
            icon={<Activity size={16} />}
            badge={`${summary.benches.length} bench${summary.benches.length === 1 ? '' : 'es'}`}
            subtitle="Where the work landed. Faded benches were quiet."
          >
            {summary.benches.length === 0 ? (
              <EmptyState text="No benches active in this period." />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                  padding: 12,
                }}
              >
                {summary.benches.map(b => (
                  <BenchCard key={b.benchId} bench={b} />
                ))}
              </div>
            )}
          </Section>

          {/* Per-batch detail */}
          <Section
            title="Batch detail"
            icon={<Clock size={16} />}
            badge={`${sortedBatches.length} of ${summary.batchCount}`}
            subtitle="Every completed batch with its actual time vs target."
            actions={
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'fast', 'on-target', 'slow', 'failed'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setBatchFilter(opt)}
                    style={pillStyle(batchFilter === opt, true)}
                  >
                    {opt === 'all' ? 'All' : opt === 'on-target' ? 'On target' : opt[0].toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            }
          >
            {sortedBatches.length === 0 ? (
              <EmptyState text="No batches match this filter." />
            ) : (
              <BatchTable
                rows={sortedBatches}
                sort={batchSort}
                onSort={(by) =>
                  setBatchSort(prev =>
                    prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' }
                  )
                }
              />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  badge,
  subtitle,
  actions,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{title}</h3>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            · {badge}
          </span>
        )}
        {subtitle && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 4 }}>{subtitle}</span>
        )}
        {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function KPICard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'warning';
}) {
  const toneColor =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad' ? 'var(--color-error)' :
    tone === 'warning' ? 'var(--color-warning)' :
    'var(--color-text-primary)';
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: toneColor, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );
}

function EmployeeRow({ rank, emp }: { rank: number; emp: EmployeeSummary }) {
  const tone = deltaTone(emp.avgDeltaPercent);
  const toneColor =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad' ? 'var(--color-error)' :
    'var(--color-text-secondary)';
  const showTrophy = rank === 1 && emp.avgDeltaPercent != null && emp.avgDeltaPercent < 0;
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'grid',
        gridTemplateColumns: '36px 1fr 80px 80px 110px 100px',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: showTrophy ? 'var(--color-warning-light)' : 'var(--color-bg-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: showTrophy ? 'var(--color-warning)' : 'var(--color-text-secondary)',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {showTrophy ? <Award size={14} /> : rank}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {emp.workerName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {emp.user?.role ?? 'Unassigned'}
          {emp.byBench.length > 0 && ` · mainly ${emp.byBench[0].benchName}`}
          {emp.failedCount > 0 && (
            <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>
              {' · '}
              {emp.failedCount} failed
            </span>
          )}
        </div>
      </div>
      <Stat value={emp.batchCount} label="batches" />
      <Stat value={emp.totalUnits} label="units" />
      <Stat value={formatMinutes(emp.totalMinutes)} label="bench-time" />
      <div
        style={{
          textAlign: 'right',
          color: toneColor,
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
        }}
      >
        {deltaIcon(emp.avgDeltaPercent, 14)}
        {formatDelta(emp.avgDeltaPercent)}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  );
}

function BenchCard({ bench }: { bench: BenchSummary }) {
  const tone = deltaTone(bench.avgDeltaPercent);
  const toneColor =
    tone === 'good' ? 'var(--color-success)' :
    tone === 'bad' ? 'var(--color-error)' :
    'var(--color-text-secondary)';
  const dim = bench.batchCount === 0;
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 8,
        padding: '10px 12px',
        opacity: dim ? 0.55 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>{bench.benchName}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: toneColor,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {deltaIcon(bench.avgDeltaPercent, 12)}
          {formatDelta(bench.avgDeltaPercent)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <span>
          <strong style={{ color: 'var(--color-text-primary)' }}>{bench.batchCount}</strong> batches
        </span>
        <span>
          <strong style={{ color: 'var(--color-text-primary)' }}>{bench.totalUnits}</strong> units
        </span>
        <span>
          <strong style={{ color: 'var(--color-text-primary)' }}>{formatMinutes(bench.totalMinutes)}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <span>{bench.workerCount} worker{bench.workerCount === 1 ? '' : 's'}</span>
        {bench.failedCount > 0 && (
          <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>
            {bench.failedCount} failed
          </span>
        )}
      </div>
    </div>
  );
}

function BatchTable({
  rows,
  sort,
  onSort,
}: {
  rows: BatchProductivity[];
  sort: { by: string; dir: 'asc' | 'desc' };
  onSort: (by: 'date' | 'recipe' | 'worker' | 'bench' | 'qty' | 'duration' | 'delta') => void;
}) {
  const cols: Array<{ id: 'date' | 'recipe' | 'worker' | 'bench' | 'qty' | 'duration' | 'delta'; label: string; align?: 'left' | 'right' }> = [
    { id: 'date', label: 'When' },
    { id: 'recipe', label: 'Recipe' },
    { id: 'worker', label: 'Worker' },
    { id: 'bench', label: 'Bench' },
    { id: 'qty', label: 'Qty', align: 'right' },
    { id: 'duration', label: 'Actual', align: 'right' },
    { id: 'delta', label: 'vs target', align: 'right' },
  ];
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--color-bg-surface)' }}>
            {cols.map(c => (
              <th
                key={c.id}
                onClick={() => onSort(c.id)}
                style={{
                  textAlign: c.align ?? 'left',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {c.label}
                  {sort.by === c.id ? (
                    sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                  ) : (
                    <ArrowUpDown size={11} style={{ opacity: 0.3 }} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <BatchRow key={r.batch.id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatchRow({ row }: { row: BatchProductivity }) {
  const tone = row.bucket;
  const deltaColor =
    tone === 'fast' ? 'var(--color-success)' :
    tone === 'slow' ? 'var(--color-error)' :
    tone === 'failed' ? 'var(--color-error)' :
    'var(--color-text-secondary)';
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
        {formatHumanDate(row.batch.date)} · {row.batch.startTime}
      </td>
      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
        {row.recipeName}
        {row.batch.status === 'failed' && (
          <span
            style={{
              marginLeft: 6,
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              background: 'var(--color-error-light)',
              color: 'var(--color-error)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            failed{row.batch.failureReason ? ` · ${row.batch.failureReason}` : ''}
          </span>
        )}
      </td>
      <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{row.workerName}</td>
      <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: 11 }}>{row.benchName}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.batch.actualQty}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
        {formatMinutes(row.actualMinutes)}
        {row.targetMinutes != null && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            target {formatMinutes(row.targetMinutes)}
          </div>
        )}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: deltaColor, fontWeight: 700 }}>
        {row.deltaPercent == null ? '—' : formatDelta(row.deltaPercent)}
      </td>
    </tr>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function pillStyle(active: boolean, small = false): React.CSSProperties {
  return {
    padding: small ? '4px 8px' : '6px 10px',
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-primary)',
    background: active ? 'var(--color-accent-active)' : '#ffffff',
    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function deltaTone(delta: number | undefined): 'good' | 'bad' | undefined {
  if (delta == null) return undefined;
  if (delta <= -3) return 'good';
  if (delta >= 3) return 'bad';
  return undefined;
}

function deltaIcon(delta: number | undefined, size = 16) {
  if (delta == null) return <Minus size={size} />;
  if (delta <= -3) return <TrendingDown size={size} color="var(--color-success)" />;
  if (delta >= 3) return <TrendingUp size={size} color="var(--color-error)" />;
  return <Minus size={size} />;
}

function formatHumanDate(iso: string): string {
  if (iso === DEMO_TODAY) return 'Today';
  if (iso === dayOffset(-1)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Quinn headline
// ─────────────────────────────────────────────────────────────────────────────

type Headline = { title: string; body: string; bg: string; borderColor: string; iconColor: string };

function quinnHeadline(s: ReturnType<typeof siteProductivity>): Headline {
  if (s.batchCount === 0) {
    return {
      title: 'No bench activity in this period yet.',
      body: 'Once batches start running, productivity, employee leaderboards and per-bench stats will land here.',
      bg: 'var(--color-info-light)',
      borderColor: 'var(--color-info)',
      iconColor: 'var(--color-info)',
    };
  }
  const top = s.employees.find(e => e.avgDeltaPercent != null && e.avgDeltaPercent < -3);
  const bottom = [...s.employees].reverse().find(e => e.avgDeltaPercent != null && e.avgDeltaPercent > 5);
  const slowestBench = [...s.benches].sort((a, b) => (a.avgDeltaPercent ?? 0) - (b.avgDeltaPercent ?? 0)).reverse().find(b => (b.avgDeltaPercent ?? 0) > 5);

  if (top && bottom) {
    return {
      title: `${top.workerName} led the team — ${formatDelta(top.avgDeltaPercent)} across ${top.batchCount} batches.`,
      body: `${bottom.workerName} ran ${formatDelta(bottom.avgDeltaPercent)}. Worth a five-minute coaching chat about pacing on ${bottom.byBench[0]?.benchName ?? 'their benches'}.`,
      bg: 'var(--color-info-light)',
      borderColor: 'var(--color-info)',
      iconColor: 'var(--color-info)',
    };
  }
  if (top) {
    return {
      title: `${top.workerName} crushed it — ${formatDelta(top.avgDeltaPercent)} across ${top.batchCount} batches.`,
      body: `Whole team averaged ${formatDelta(s.avgDeltaPercent)} over ${s.batchCount} batches. Consider giving ${top.workerName} a mention on the next stand-up.`,
      bg: 'var(--color-success-light)',
      borderColor: 'var(--color-success)',
      iconColor: 'var(--color-success)',
    };
  }
  if (slowestBench) {
    return {
      title: `${slowestBench.benchName} ran ${formatDelta(slowestBench.avgDeltaPercent)} this period.`,
      body: `${slowestBench.batchCount} batches, ${slowestBench.workerCount} worker${slowestBench.workerCount === 1 ? '' : 's'}. Could be equipment, recipe complexity or unfamiliar staff — worth a peek.`,
      bg: 'var(--color-warning-light)',
      borderColor: 'var(--color-warning-border)',
      iconColor: 'var(--color-warning)',
    };
  }
  return {
    title: `Solid run — team averaged ${formatDelta(s.avgDeltaPercent)} over ${s.batchCount} batches.`,
    body: `${s.totalUnits} units produced across ${s.benches.length} bench${s.benches.length === 1 ? '' : 'es'}. No outliers worth flagging.`,
    bg: 'var(--color-success-light)',
    borderColor: 'var(--color-success)',
    iconColor: 'var(--color-success)',
  };
}
