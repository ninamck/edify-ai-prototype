'use client';

/**
 * /production/productivity — Pret P013 / P040 / P041 / P058 / P059 / P060 / P132
 *
 * Expected time vs actual time, at every level a GM asks about: per product,
 * bench, employee, production run, and all productions together.
 *
 * Expected time is the product's standard time scaled to the batch size
 * (ProductionItem.targetMinutes). Pret supplies these per product.
 *
 * Layout (top → bottom):
 *  1. Period strip
 *  2. One-line headline
 *  3. All productions — expected, actual, difference, units per labour hour
 *  4. Expected vs actual, switchable by product / bench / employee / run,
 *     with drill-down and very-slow staff flags (PAC089 / PAC168 / PAC169 / PAC172)
 *  5. Four-week kitchen trend (PAC161 / PAC162 / PAC170)
 *  6. All batches, collapsed
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Gauge,
  Timer,
  Users,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ListChecks,
  TrendingUp,
  Rows3,
} from 'lucide-react';
import {
  Bar,
  Cell,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import { DEMO_TODAY, dayOffset } from '@/components/Production/fixtures';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import {
  siteProductivity,
  productivityTrend,
  formatMinutes,
  RUN_OVER_PERCENT,
  type BatchProductivity,
  type BreakdownBy,
  type SiteProductivity,
  type TimeRow,
  type TrendPoint,
} from '@/components/Production/productivity';

type DateRange = 'today' | 'yesterday' | 'last7' | 'last28';

const RANGES: Array<{ id: DateRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last28', label: 'Last 4 weeks' },
];

const VIEWS: Array<{ id: BreakdownBy; label: string; noun: string }> = [
  { id: 'product', label: 'Product', noun: 'products' },
  { id: 'bench', label: 'Bench', noun: 'benches' },
  { id: 'employee', label: 'Employee', noun: 'employees' },
  { id: 'run', label: 'Production run', noun: 'runs' },
];

/** Orange is allowed for graphics only (3.6:1 non-text), never for text. */
const OVER_COLOUR = '#EA580C';
const ROWS_SHOWN = 8;

function datesFor(range: DateRange): string[] {
  if (range === 'today') return [DEMO_TODAY];
  if (range === 'yesterday') return [dayOffset(-1)];
  const n = range === 'last7' ? 7 : 28;
  return Array.from({ length: n }, (_, i) => dayOffset(-i));
}

function priorFor(range: DateRange): { dates: string[]; label: string } | undefined {
  if (range === 'today') return { dates: [dayOffset(-1)], label: 'Yesterday' };
  if (range === 'yesterday') return { dates: [dayOffset(-2)], label: 'Day before' };
  if (range === 'last7') return { dates: Array.from({ length: 7 }, (_, i) => dayOffset(-7 - i)), label: 'Previous 7 days' };
  return undefined;
}

export default function ProductivityPage() {
  const { siteId } = useProductionSite();
  const [range, setRange] = useState<DateRange>('yesterday');
  const [view, setView] = useState<BreakdownBy>('product');
  const [showAllRows, setShowAllRows] = useState(false);
  const [showBatches, setShowBatches] = useState(false);
  const [batchSort, setBatchSort] = useState<{ by: BatchSortKey; dir: 'asc' | 'desc' }>({ by: 'date', dir: 'desc' });
  const [batchFilter, setBatchFilter] = useState<'all' | 'fast' | 'on-target' | 'slow' | 'failed'>('all');

  const dates = useMemo(() => datesFor(range), [range]);
  const multiDay = dates.length > 1;
  const summary = useMemo(() => siteProductivity(siteId, dates), [siteId, dates]);
  const prior = useMemo(() => {
    const p = priorFor(range);
    return p ? { label: p.label, summary: siteProductivity(siteId, p.dates) } : undefined;
  }, [siteId, range]);
  const trend = useMemo(() => productivityTrend(siteId), [siteId]);

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
        case 'expected':
          return dir * ((a.targetMinutes ?? -1) - (b.targetMinutes ?? -1));
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

  const headline = headlineFor(summary);
  const total = diffLabel(summary.total);
  const rows = summary.breakdown[view];
  const visibleRows = showAllRows ? rows : rows.slice(0, ROWS_SHOWN);
  const viewMeta = VIEWS.find(v => v.id === view)!;
  const periodDates = new Set(dates);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Period strip ───────────────────────────────────────────── */}
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
        <span style={LABEL_STYLE}>Period</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(opt => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              aria-pressed={opt.id === range}
              style={pillStyle(opt.id === range)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
          {summary.batchCount} batch{summary.batchCount === 1 ? '' : 'es'} · {summary.totalUnits} units ·{' '}
          {multiDay ? `${dates.length} days` : formatHumanDate(dates[0])}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-card)',
              border: `1px solid ${headline.tone === 'warning' ? 'var(--color-warning-border)' : 'var(--color-info-border)'}`,
              background: headline.tone === 'warning' ? 'var(--color-warning-light)' : 'var(--color-info-light)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <EdifyMark
              size={20}
              color={headline.tone === 'warning' ? 'var(--color-warning)' : 'var(--color-info)'}
              style={{ flexShrink: 0 }}
            />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{headline.title}</h2>
          </div>

          {/* All productions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <KPICard
              icon={<Clock size={16} />}
              label="Expected time"
              value={formatMinutes(summary.total.expectedMinutes)}
              sub={`All productions · ${summary.total.batchCount} batches`}
            />
            <KPICard
              icon={<Timer size={16} />}
              label="Actual time"
              value={formatMinutes(summary.total.actualMinutes)}
              sub="Start to finish on the bench"
            />
            <KPICard
              icon={<Gauge size={16} />}
              label="Difference"
              value={total.main}
              sub={[total.sub, prior && `${prior.label}: ${vsExpected(prior.summary.total.deltaPercent)}`]
                .filter(Boolean)
                .join(' · ')}
              alert={total.isOver}
            />
            <KPICard
              icon={<Users size={16} />}
              label="Units per labour hour"
              value={summary.labour.unitsPerLabourHour == null ? '—' : summary.labour.unitsPerLabourHour.toFixed(1)}
              sub={`${formatMinutes(summary.labour.teamHours * 60)} team · ${formatMinutes(summary.labour.managerHours * 60)} manager on duty`}
            />
          </div>

          <Section
            title="Expected vs actual time"
            icon={<ListChecks size={16} />}
            subtitle="Expected time is Pret's standard time for each product, scaled to the batch size."
          >
            <div
              style={{
                padding: '12px 32px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div
                role="tablist"
                aria-label="Break down by"
                style={{
                  display: 'flex',
                  background: 'var(--color-bg-hover)',
                  borderRadius: 100,
                  padding: 3,
                  width: 'fit-content',
                }}
              >
                {VIEWS.map(v => {
                  const active = view === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setView(v.id);
                        setShowAllRows(false);
                      }}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 100,
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'var(--font-primary)',
                        cursor: 'pointer',
                        background: active ? 'var(--color-accent-active)' : 'transparent',
                        color: active ? '#fff' : 'var(--color-text-secondary)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
              <BarLegend />
            </div>
            {rows.length === 0 ? (
              <EmptyState text="No timed batches in this period." />
            ) : (
              <TimeTable rows={visibleRows} total={summary.total} view={view} />
            )}
            {rows.length > ROWS_SHOWN && (
              <button onClick={() => setShowAllRows(v => !v)} style={LINK_BUTTON_STYLE}>
                {showAllRows ? `Show fewer ${viewMeta.noun}` : `Show all ${rows.length} ${viewMeta.noun}`}
              </button>
            )}
          </Section>

          <Section title="Kitchen trend" icon={<TrendingUp size={16} />} badge="last 4 weeks">
            <TrendChart points={trend} periodDates={periodDates} />
          </Section>

          <Section
            title="All batches"
            icon={<Rows3 size={16} />}
            badge={`${summary.batchCount}`}
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {showBatches && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {BATCH_FILTERS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setBatchFilter(opt.id)}
                        aria-pressed={batchFilter === opt.id}
                        style={pillStyle(batchFilter === opt.id, true)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowBatches(v => !v)}
                  aria-expanded={showBatches}
                  style={{ ...pillStyle(false, true), display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {showBatches ? 'Hide' : 'Show'}
                  {showBatches ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            }
          >
            {showBatches &&
              (sortedBatches.length === 0 ? (
                <EmptyState text="No batches match this filter." />
              ) : (
                <BatchTable
                  rows={sortedBatches}
                  sort={batchSort}
                  onSort={by =>
                    setBatchSort(prev =>
                      prev.by === by ? { by, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { by, dir: 'asc' },
                    )
                  }
                />
              ))}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
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
  children?: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 32px',
          borderBottom: children ? '1px solid var(--color-border-subtle)' : undefined,
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
        {subtitle && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{subtitle}</span>}
        {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function KPICard({
  icon,
  label,
  value,
  sub,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          lineHeight: 1.1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {alert && <AlertTriangle size={16} color={OVER_COLOUR} aria-label="Over expected time" />}
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {swatch}
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Expected vs actual table
// ─────────────────────────────────────────────────────────────────────────────

/** Only products and employees carry slow-staff flags, so only they get the column. */
function timeGrid(view: BreakdownBy): string {
  return view === 'product' || view === 'employee' ? '220px 1fr 76px 76px 120px 170px 16px' : '220px 1fr 76px 76px 120px 16px';
}

function hasFlagColumn(view: BreakdownBy): boolean {
  return view === 'product' || view === 'employee';
}

function ActualSwatch({ over, width = 16 }: { over?: boolean; width?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width,
        height: 8,
        borderRadius: 2,
        background: over ? OVER_COLOUR : 'var(--viz-2)',
      }}
    />
  );
}

function BarLegend() {
  return (
    <span aria-hidden style={{ display: 'flex', gap: 14, fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)' }}>
      <LegendItem swatch={<ActualSwatch />} label="Actual" />
      <LegendItem swatch={<ExpectedTick />} label="Expected" />
      <LegendItem swatch={<ActualSwatch over />} label={`Over by ${RUN_OVER_PERCENT}%+`} />
    </span>
  );
}

const AXIS_STEPS = [5, 10, 15, 30, 60, 120, 180, 240, 300, 360, 480, 600, 720, 1200, 1800, 2400, 3000, 6000];

/** Round-number ticks from 0, at most five, with the last one at or above `max`. */
function axisTicks(max: number): number[] {
  const step = AXIS_STEPS.find(s => max / s <= 4) ?? AXIS_STEPS[AXIS_STEPS.length - 1];
  const count = Math.max(1, Math.ceil(max / step));
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

function TimeTable({ rows, total, view }: { rows: TimeRow[]; total: TimeRow; view: BreakdownBy }) {
  const ticks = axisTicks(Math.max(1, ...rows.map(r => Math.max(r.expectedMinutes, r.actualMinutes))));
  const max = ticks[ticks.length - 1];
  const label = VIEWS.find(v => v.id === view)!.label;
  return (
    <div>
      <div aria-hidden style={{ ...COLUMN_HEADER_STYLE, gridTemplateColumns: timeGrid(view) }}>
        <span>{label}</span>
        <span />
        <span style={{ textAlign: 'right' }}>Expected</span>
        <span style={{ textAlign: 'right' }}>Actual</span>
        <span style={{ textAlign: 'right' }}>Difference</span>
        {hasFlagColumn(view) && <span>Needs support</span>}
        <span />
      </div>
      {/* The total is ~10x any single row, so it gets its own scale rather than flattening every other bar. */}
      <TimeRowView
        row={{ ...total, flags: [] }}
        view={view}
        max={Math.max(1, total.expectedMinutes, total.actualMinutes)}
        ticks={[]}
        emphasis
      />
      <div
        aria-hidden
        style={{
          display: 'grid',
          gridTemplateColumns: timeGrid(view),
          gap: 16,
          padding: '8px 32px 2px',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
        }}
      >
        <span />
        <span style={{ position: 'relative', display: 'block', height: 14 }}>
          {ticks.map((t, i) => (
            <span
              key={t}
              style={{
                position: 'absolute',
                top: 0,
                left: `${(t / max) * 100}%`,
                transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t === 0 ? '0' : formatMinutes(t)}
            </span>
          ))}
        </span>
      </div>
      {rows.map(r => (
        <TimeRowView key={r.id} row={r} view={view} max={max} ticks={ticks} />
      ))}
    </div>
  );
}

function TimeRowView({
  row,
  view,
  max,
  ticks,
  emphasis,
}: {
  row: TimeRow;
  view: BreakdownBy;
  max: number;
  ticks: number[];
  emphasis?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expandable = (row.children?.length ?? 0) > 0;
  const diff = diffLabel(row);
  const sublabel = rowSublabel(row, view);
  const description =
    `${row.label}: expected ${formatMinutes(row.expectedMinutes)}, actual ${formatMinutes(row.actualMinutes)}, ${diff.main}` +
    (diff.sub ? ` (${diff.sub})` : '') +
    `. ${row.batchCount} batch${row.batchCount === 1 ? '' : 'es'}.` +
    (row.flags.length > 0 ? ` Needs support: ${row.flags.map(f => `${flagSubject(f, view)} ${vsExpected(f.deltaPercent)}`).join(', ')}.` : '');

  const cells = (
    <>
      <span style={{ display: 'block', minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: emphasis ? 14 : 13,
            fontWeight: emphasis ? 700 : 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.label}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)' }}>{sublabel}</span>
      </span>
      <BulletBar row={row} max={max} ticks={ticks} over={diff.isOver} />
      <span style={NUMBER_CELL}>{formatMinutes(row.expectedMinutes)}</span>
      <span style={NUMBER_CELL}>{formatMinutes(row.actualMinutes)}</span>
      <DiffCell diff={diff} />
      {hasFlagColumn(view) && <span style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
        {row.flags.length > 0 && (
          <FlagChip
            label={
              view === 'employee'
                ? `Slow on ${row.flags.length} product${row.flags.length === 1 ? '' : 's'}`
                : `${flagSubject(row.flags[0], view)} · ${vsExpected(row.flags[0].deltaPercent)}`
            }
          />
        )}
        {view === 'product' && row.flags.length > 1 && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{row.flags.length - 1}</span>
        )}
      </span>}
      <span style={{ color: 'var(--color-text-muted)', display: 'flex' }}>
        {expandable && (open ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </span>
    </>
  );

  const rowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: timeGrid(view),
    gap: 16,
    alignItems: 'center',
    padding: '10px 32px',
    width: '100%',
    fontFamily: 'var(--font-primary)',
  };

  return (
    <div style={{ borderBottom: `${emphasis ? 2 : 1}px solid var(--color-border${emphasis ? '' : '-subtle'})` }}>
      {expandable ? (
        <button
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-label={description}
          style={{ ...RESET_BUTTON, ...rowStyle, cursor: 'pointer' }}
        >
          {cells}
        </button>
      ) : (
        <div role="group" aria-label={description} style={rowStyle}>
          {cells}
        </div>
      )}
      {open && row.children && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 10px' }}>
          {row.children.map(c => {
            const cd = diffLabel(c);
            return (
              <li key={c.id} style={{ ...rowStyle, padding: '6px 32px' }}>
                <span style={{ fontSize: 12, paddingLeft: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.label}
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {' '}
                    · {c.batchCount} batch{c.batchCount === 1 ? '' : 'es'}
                  </span>
                </span>
                <BulletBar row={c} max={max} ticks={ticks} over={cd.isOver} thin />
                <span style={{ ...NUMBER_CELL, fontSize: 12, fontWeight: 500 }}>{formatMinutes(c.expectedMinutes)}</span>
                <span style={{ ...NUMBER_CELL, fontSize: 12, fontWeight: 500 }}>{formatMinutes(c.actualMinutes)}</span>
                <DiffCell diff={cd} small />
                {hasFlagColumn(view) && <span>{c.flags.length > 0 && <FlagChip label="Very slow" />}</span>}
                <span />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Bullet bar: actual time as the bar, expected time as a navy tick.
 * Only the stretch past the tick turns orange, and only once the row is
 * over the tolerance, so the colour and the Difference column agree.
 */
function BulletBar({
  row,
  max,
  ticks,
  over,
  thin,
}: {
  row: TimeRow;
  max: number;
  ticks: number[];
  over: boolean;
  thin?: boolean;
}) {
  const pct = (m: number) => Math.max(0.5, Math.min(100, (m / max) * 100));
  const actual = pct(row.actualMinutes);
  const expected = pct(row.expectedMinutes);
  const barHeight = thin ? 8 : 12;
  const tickHeight = thin ? 14 : 20;
  return (
    <span aria-hidden style={{ position: 'relative', display: 'block', height: tickHeight }}>
      {ticks.slice(1).map(t => (
        <span
          key={t}
          style={{
            position: 'absolute',
            top: thin ? -6 : -10,
            bottom: thin ? -6 : -10,
            left: `${(t / max) * 100}%`,
            width: 1,
            background: 'var(--color-border-subtle)',
          }}
        />
      ))}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: (tickHeight - barHeight) / 2,
          height: barHeight,
          width: `${over ? expected : actual}%`,
          borderRadius: over ? '3px 0 0 3px' : 3,
          background: 'var(--viz-2)',
        }}
      />
      {over && (
        <span
          style={{
            position: 'absolute',
            left: `${expected}%`,
            top: (tickHeight - barHeight) / 2,
            height: barHeight,
            width: `${actual - expected}%`,
            borderRadius: '0 3px 3px 0',
            background: OVER_COLOUR,
          }}
        />
      )}
      <ExpectedTick height={tickHeight} style={{ position: 'absolute', top: 0, left: `${expected}%`, transform: 'translateX(-1px)' }} />
    </span>
  );
}

function ExpectedTick({ height = 14, style }: { height?: number; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 3,
        height,
        borderRadius: 1.5,
        background: 'var(--viz-1)',
        boxShadow: '0 0 0 1px #ffffff',
        ...style,
      }}
    />
  );
}

type Diff = { main: string; sub: string; isOver: boolean };

function DiffCell({ diff, small }: { diff: Diff; small?: boolean }) {
  return (
    <span style={{ display: 'block', textAlign: 'right' }}>
      <span
        style={{
          fontSize: small ? 12 : 13,
          fontWeight: small ? 600 : 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {diff.isOver && <AlertTriangle size={12} color={OVER_COLOUR} />}
        {diff.main}
      </span>
      {diff.sub && <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)' }}>{diff.sub}</span>}
    </span>
  );
}

function FlagChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--radius-badge)',
        background: 'var(--color-warning-light)',
        border: '1px solid var(--color-warning-border)',
        color: 'var(--color-warning)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <AlertTriangle size={11} color={OVER_COLOUR} style={{ flexShrink: 0 }} />
      {label}
    </span>
  );
}

function flagSubject(f: { workerName: string; recipeName: string }, view: BreakdownBy): string {
  return view === 'employee' ? f.recipeName : f.workerName;
}

function rowSublabel(row: TimeRow, view: BreakdownBy): string {
  const batches = `${row.batchCount} batch${row.batchCount === 1 ? '' : 'es'}`;
  return view === 'run' && row.sublabel ? `${row.sublabel} · ${batches}` : batches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen trend
// ─────────────────────────────────────────────────────────────────────────────

type TrendMetric = 'expected' | 'uplh';

function TrendChart({ points, periodDates }: { points: TrendPoint[]; periodDates: Set<string> }) {
  const [metric, setMetric] = useState<TrendMetric>('expected');
  const data = points.map((p, i) => {
    const value = metric === 'expected' ? p.deltaPercent : p.unitsPerLabourHour;
    const lastWeek = points
      .slice(Math.max(0, i - 6), i + 1)
      .map(w => (metric === 'expected' ? w.deltaPercent : w.unitsPerLabourHour))
      .filter((v): v is number => v != null);
    return {
      date: p.date,
      label: shortDate(p.date),
      value: value == null ? null : Math.round(value * 10) / 10,
      rolling: lastWeek.length === 0 ? null : Math.round((lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length) * 10) / 10,
      inPeriod: periodDates.has(p.date),
    };
  });
  const format = (v: number) => (metric === 'expected' ? expectedAxisLabel(v) : v.toFixed(1));

  return (
    <div style={{ padding: '12px 32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { id: 'expected', label: 'Actual vs expected' },
            { id: 'uplh', label: 'Units per labour hour' },
          ] as Array<{ id: TrendMetric; label: string }>).map(opt => (
            <button
              key={opt.id}
              onClick={() => setMetric(opt.id)}
              aria-pressed={metric === opt.id}
              style={pillStyle(metric === opt.id, true)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <LegendItem swatch={<span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--viz-2)' }} />} label="Selected period" />
          <LegendItem
            swatch={<span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--viz-2)', opacity: 0.3 }} />}
            label="Other days"
          />
          <LegendItem swatch={<span style={{ width: 16, height: 2, background: 'var(--viz-1)' }} />} label="7-day average" />
        </div>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={metric === 'expected' ? 76 : 40}
              tickFormatter={format}
            />
            {metric === 'expected' && <ReferenceLine y={0} stroke="var(--viz-1)" strokeDasharray="4 4" />}
            <Tooltip
              formatter={(v, name) => [
                typeof v === 'number' ? format(v) : '—',
                name === 'rolling' ? '7-day average' : 'Day',
              ]}
              labelFormatter={(_, payload) => {
                const iso = payload?.[0]?.payload?.date as string | undefined;
                return iso ? formatHumanDate(iso) : '';
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-border-subtle)' }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false}>
              {data.map(d => (
                <Cell key={d.date} fill="var(--viz-2)" fillOpacity={d.inPeriod ? 1 : 0.3} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="rolling"
              stroke="var(--viz-1)"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch table
// ─────────────────────────────────────────────────────────────────────────────

type BatchSortKey = 'date' | 'recipe' | 'worker' | 'bench' | 'qty' | 'expected' | 'duration' | 'delta';

const BATCH_FILTERS: Array<{ id: 'all' | 'fast' | 'on-target' | 'slow' | 'failed'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'fast', label: 'Under' },
  { id: 'on-target', label: 'On track' },
  { id: 'slow', label: 'Over' },
  { id: 'failed', label: 'Failed' },
];

function BatchTable({
  rows,
  sort,
  onSort,
}: {
  rows: BatchProductivity[];
  sort: { by: BatchSortKey; dir: 'asc' | 'desc' };
  onSort: (by: BatchSortKey) => void;
}) {
  const cols: Array<{ id: BatchSortKey; label: string; align?: 'left' | 'right' }> = [
    { id: 'date', label: 'When' },
    { id: 'recipe', label: 'Product' },
    { id: 'worker', label: 'Employee' },
    { id: 'bench', label: 'Bench' },
    { id: 'qty', label: 'Qty', align: 'right' },
    { id: 'expected', label: 'Expected', align: 'right' },
    { id: 'duration', label: 'Actual', align: 'right' },
    { id: 'delta', label: 'Difference', align: 'right' },
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
                aria-sort={sort.by === c.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
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
  const failed = row.batch.status === 'failed';
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
        {formatHumanDate(row.batch.date)} · {row.batch.startTime}
      </td>
      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
        {row.recipeName}
        {failed && (
          <span
            style={{
              marginLeft: 6,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              background: '#ffffff',
              color: 'var(--color-error)',
              border: '1.5px solid var(--color-error)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
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
        {row.targetMinutes == null ? '—' : formatMinutes(row.targetMinutes)}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
        {formatMinutes(row.actualMinutes)}
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {row.bucket === 'slow' && <AlertTriangle size={11} color={OVER_COLOUR} />}
          {row.deltaPercent == null ? '—' : vsExpected(row.deltaPercent)}
        </span>
      </td>
    </tr>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{text}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const COLUMN_HEADER_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: 16,
  alignItems: 'center',
  padding: '8px 32px',
  borderBottom: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-hover)',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const NUMBER_CELL: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

/** Strips button chrome but keeps the browser focus ring (no `all: unset`). */
const RESET_BUTTON: React.CSSProperties = {
  background: 'none',
  border: 'none',
  margin: 0,
  textAlign: 'left',
  color: 'inherit',
  boxSizing: 'border-box',
};

const LINK_BUTTON_STYLE: React.CSSProperties = {
  ...RESET_BUTTON,
  cursor: 'pointer',
  display: 'block',
  padding: '10px 32px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--color-link)',
  fontFamily: 'var(--font-primary)',
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

/**
 * Within the tolerance either way a row reads "On track", with the exact minutes
 * underneath, so the orange colour and the words always agree.
 * Minutes come from the rounded figures shown beside them.
 */
function diffLabel(row: TimeRow): Diff {
  const d = Math.round(row.actualMinutes) - Math.round(row.expectedMinutes);
  const pct = row.deltaPercent;
  const isOver = (pct ?? 0) >= RUN_OVER_PERCENT;
  if (isOver) return { main: `${formatMinutes(d)} over`, sub: pctText(pct), isOver };
  if ((pct ?? 0) <= -RUN_OVER_PERCENT) return { main: `${formatMinutes(-d)} under`, sub: pctText(pct), isOver };
  const within = d >= 1 ? `${formatMinutes(d)} over` : d <= -1 ? `${formatMinutes(-d)} under` : '';
  return { main: 'On track', sub: [within, pctText(pct)].filter(Boolean).join(' · '), isOver };
}

/** Exact percentage with direction, e.g. "2% under". Empty when it rounds to 0. */
function pctText(delta: number | undefined): string {
  if (delta == null || Math.round(delta) === 0) return '';
  return `${Math.abs(Math.round(delta))}% ${delta > 0 ? 'over' : 'under'}`;
}

/** "12% over" / "8% under" / "on track". */
function vsExpected(delta: number | undefined): string {
  if (delta == null) return '—';
  if (delta <= -3) return `${Math.abs(Math.round(delta))}% under`;
  if (delta >= 3) return `${Math.round(delta)}% over`;
  return 'on track';
}

function expectedAxisLabel(v: number): string {
  if (v === 0) return 'Expected';
  return v > 0 ? `${Math.round(v)}% over` : `${Math.abs(Math.round(v))}% under`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function formatHumanDate(iso: string): string {
  if (iso === DEMO_TODAY) return 'Today';
  if (iso === dayOffset(-1)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline
// ─────────────────────────────────────────────────────────────────────────────

function headlineFor(s: SiteProductivity): { title: string; tone: 'info' | 'warning' } {
  if (s.batchCount === 0) return { title: 'No bench activity in this period yet.', tone: 'info' };
  const flag = s.flags[0];
  if (flag) {
    const next = flag.quickest
      ? ` ${flag.quickest.workerName} is ${Math.abs(Math.round(flag.quickest.deltaPercent))}% quicker, so pair them on the next run.`
      : ' Worth a five-minute chat before the next run.';
    return {
      title: `${flag.workerName} takes ${Math.round(flag.deltaPercent)}% longer than expected on ${flag.recipeName}.${next}`,
      tone: 'warning',
    };
  }
  const run = s.breakdown.run.find(r => (r.deltaPercent ?? 0) >= RUN_OVER_PERCENT);
  if (run) {
    const d = Math.round(run.actualMinutes) - Math.round(run.expectedMinutes);
    return { title: `${run.label} took ${formatMinutes(d)} longer than expected.`, tone: 'warning' };
  }
  const pct = s.total.deltaPercent ?? 0;
  const n = `${s.total.batchCount} batches`;
  if (pct <= -3) return { title: `The kitchen was ${Math.abs(Math.round(pct))}% quicker than expected across ${n}.`, tone: 'info' };
  if (pct >= 3) return { title: `The kitchen took ${Math.round(pct)}% longer than expected across ${n}.`, tone: 'info' };
  return { title: `The kitchen ran to expected time across ${n}.`, tone: 'info' };
}
