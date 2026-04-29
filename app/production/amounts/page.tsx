'use client';

import { useMemo, useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Split,
  Layers,
  Plus,
  Minus,
  RotateCcw,
  AlertTriangle,
  Info,
  ArrowDown,
  Combine,
} from 'lucide-react';
import Link from 'next/link';
import StatusPill from '@/components/Production/StatusPill';
import { SelectionTagChip } from '@/components/Production/RangeTierChips';
import { useRole, StaffLockBanner } from '@/components/Production/RoleContext';
import { usePlan, usePlanStore, FILLING_TRAY_GRAMS, type PlanLine } from '@/components/Production/PlanStore';
import {
  effectiveBatchRules,
  proposeBatchSplit,
  PRET_SITES,
  DEMO_TODAY,
  getRecipe,
  type ProductionRecipe,
  type DemandSignal,
} from '@/components/Production/fixtures';

const CATEGORY_ORDER: ProductionRecipe['category'][] = [
  'Bakery',
  'Sandwich',
  'Salad',
  'Snack',
  'Beverage',
];

const MODE_STYLE = {
  run: { bg: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', label: 'Run' },
  variable: { bg: 'var(--color-info-light)', color: 'var(--color-info)', label: 'Variable' },
  increment: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', label: 'Increment' },
} as const;

const SIGNAL_LABELS: Record<DemandSignal, string> = {
  'sales-history': 'Sales history',
  weather: 'Weather',
  'stock-on-hand': 'Stock on hand',
  'online-orders': 'Online orders',
  'waste-history': 'Waste history',
  event: 'Event',
  promo: 'Promo',
};

export default function AmountsPage() {
  const { can } = useRole();
  const canEdit = can('plan.editQuantity');
  const { setPlanned, resetToQuinn, resetAll, overrideCount } = usePlanStore();
  const [siteId, setSiteId] = useState('hub-central');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProductionRecipe['category']>('All');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const site = PRET_SITES.find(s => s.id === siteId) ?? PRET_SITES[0];
  const lines = usePlan(site.id, DEMO_TODAY);

  const filtered = useMemo(() => {
    if (categoryFilter === 'All') return lines;
    return lines.filter(l => l.recipe.category === categoryFilter);
  }, [lines, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<ProductionRecipe['category'], PlanLine[]>();
    for (const l of filtered) {
      const arr = map.get(l.recipe.category) ?? [];
      arr.push(l);
      map.set(l.recipe.category, arr);
    }
    return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({ category: c, rows: map.get(c)! }));
  }, [filtered]);

  const totals = useMemo(() => {
    let units = 0;
    let batches = 0;
    const benchSet = new Set<string>();
    let variance = 0;
    let shortfalls = 0;
    for (const l of lines) {
      const producible = l.effectivePlanned;
      units += producible;
      variance += l.planned - l.quinnProposed;
      if (l.assemblyDemand.totalUnits > l.planned) shortfalls += 1;
      const eff = effectiveBatchRules(l.recipe.batchRules, l.primaryBench?.batchRules);
      const split = proposeBatchSplit(producible, eff);
      batches += split.batches.length;
      for (const b of l.benches) benchSet.add(b.id);
    }
    return {
      units,
      batches,
      benchesUsed: benchSet.size,
      totalBenches: new Set(lines.flatMap(l => l.benches.map(b => b.id))).size,
      variance,
      shortfalls,
      recipeCount: lines.length,
    };
  }, [lines]);

  function bump(line: PlanLine, delta: number) {
    const step = line.recipe.batchRules?.multipleOf ?? 1;
    const current = line.planned;
    const next = Math.max(0, current + delta * step);
    setPlanned(line.item.id, next);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function absorbAssemblyDemand(line: PlanLine) {
    if (line.assemblyDemand.totalUnits <= line.planned) return;
    setPlanned(line.item.id, line.assemblyDemand.totalUnits);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header + totals */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Site
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {PRET_SITES.map(s => {
              const active = s.id === siteId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSiteId(s.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                    background: active ? 'var(--color-accent-active)' : '#ffffff',
                    color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.name} · {s.type}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
            Planning {DEMO_TODAY} (Thu)
          </span>
        </div>

        {/* KPI strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          <KPI label="Recipes on plan" value={totals.recipeCount} />
          <KPI label="Units today" value={totals.units} emphasise />
          <KPI label="Batches scheduled" value={totals.batches} />
          <KPI label="Benches used" value={`${totals.benchesUsed} of ${totals.totalBenches}`} />
          <KPI label="Variance vs Quinn" value={formatSigned(totals.variance)} tone={totals.variance === 0 ? 'neutral' : totals.variance > 0 ? 'warning' : 'info'} />
        </div>

        {/* Filters + reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Category
          </span>
          {(['All', ...CATEGORY_ORDER] as const).map(c => {
            const active = c === categoryFilter;
            return (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  background: active ? 'var(--color-accent-active)' : '#ffffff',
                  color: active ? 'var(--color-text-on-active)' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          {totals.shortfalls > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                background: 'var(--color-error-light)',
                color: 'var(--color-error)',
                border: '1px solid var(--color-error-border)',
              }}
            >
              <AlertTriangle size={12} /> {totals.shortfalls} component shortfall
              {totals.shortfalls === 1 ? '' : 's'}
            </span>
          )}
          {overrideCount > 0 && canEdit && (
            <button
              type="button"
              onClick={resetAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                background: '#ffffff',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={12} /> Reset {overrideCount} to Quinn
            </button>
          )}
          <Link
            href="/production/board"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              background: 'var(--color-info-light)',
              color: 'var(--color-info)',
              border: '1px solid var(--color-info)',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Open on board <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px 32px', background: 'var(--color-bg-surface)' }}>
        <StaffLockBanner reason="Managers finalise the amounts plan before the first run." />

        {/* Ledger table */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-border-subtle)',
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(240px, 1.6fr) 92px 92px 100px 150px 150px 140px',
              padding: '10px 14px',
              gap: 10,
              background: 'var(--color-bg-hover)',
              borderBottom: '1px solid var(--color-border-subtle)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <span>Recipe</span>
            <span style={{ textAlign: 'right' }}>Forecast</span>
            <span style={{ textAlign: 'right' }}>Carry-over</span>
            <span style={{ textAlign: 'right' }}>Quinn</span>
            <span style={{ textAlign: 'center' }}>You plan</span>
            <span>Batches</span>
            <span>Lands on</span>
          </div>

          {grouped.map((group, gi) => (
            <div key={group.category}>
              <div
                style={{
                  padding: '8px 14px',
                  background: 'var(--color-bg-surface)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  borderTop: gi === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <StatusPill tone="neutral" label={group.category} size="xs" />
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {group.rows.length} SKU{group.rows.length === 1 ? '' : 's'} ·{' '}
                  {group.rows.reduce((a, r) => a + r.effectivePlanned, 0)}{' '}
                  units · {group.rows.reduce((a, r) => {
                    const eff = effectiveBatchRules(r.recipe.batchRules, r.primaryBench?.batchRules);
                    return a + proposeBatchSplit(r.effectivePlanned, eff).batches.length;
                  }, 0)}{' '}
                  batches
                </span>
              </div>
              {group.rows.map(line => (
                <AmountRow
                  key={line.item.id}
                  line={line}
                  expanded={expanded.has(line.item.id)}
                  onToggle={() => toggleExpand(line.item.id)}
                  canEdit={canEdit}
                  onBump={d => bump(line, d)}
                  onSet={v => setPlanned(line.item.id, v)}
                  onResetToQuinn={() => resetToQuinn(line.item.id)}
                  onAbsorb={() => absorbAssemblyDemand(line)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function AmountRow({
  line,
  expanded,
  onToggle,
  canEdit,
  onBump,
  onSet,
  onResetToQuinn,
  onAbsorb,
}: {
  line: PlanLine;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onBump: (delta: number) => void;
  onSet: (v: number) => void;
  onResetToQuinn: () => void;
  onAbsorb: () => void;
}) {
  const { recipe, forecast, carryOver, quinnProposed, primaryBench, benches, planned, effectivePlanned, assemblyDemand } = line;
  const eff = effectiveBatchRules(recipe.batchRules, primaryBench?.batchRules);
  const split = proposeBatchSplit(effectivePlanned, eff);
  const deltaFromQuinn = planned - quinnProposed;
  const modeStyle = MODE_STYLE[line.item.mode];
  const isComponent = assemblyDemand.totalUnits > 0;
  const assemblyShort = assemblyDemand.totalUnits > planned;
  const underBatchMin = effectivePlanned > 0 && effectivePlanned < eff.min;
  const isAssembly = !!recipe.subRecipes && recipe.subRecipes.length > 0;

  // Row tint priority: error (component short) > warning (manager override) > normal
  const rowBg = assemblyShort
    ? 'var(--color-error-light)'
    : deltaFromQuinn !== 0
    ? 'var(--color-warning-light)'
    : '#ffffff';

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 1.6fr) 92px 92px 100px 150px 150px 140px',
          padding: '10px 14px',
          gap: 10,
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: rowBg,
          cursor: 'pointer',
          fontSize: 12,
        }}
        onClick={onToggle}
      >
        {/* Recipe column */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              width: 22,
              height: 22,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 4,
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                lineHeight: 1.3,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {recipe.name}
              </span>
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: modeStyle.bg,
                  color: modeStyle.color,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
                title={`${modeStyle.label} mode`}
              >
                {modeStyle.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              {recipe.selectionTags.slice(0, 2).map(t => (
                <SelectionTagChip key={t} tag={t} size="xs" />
              ))}
              {isAssembly && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-info)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: 'var(--color-info-light)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Layers size={9} /> Assembly
                </span>
              )}
              {isComponent && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-info)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: 'var(--color-info-light)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title={`${assemblyDemand.sources.length} assemblies pull from this recipe`}
                >
                  <ArrowDown size={9} /> Component
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Forecast */}
        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {forecast ? forecast.projectedUnits : <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>—</span>}
          {forecast?.status === 'draft' && (
            <div style={{ fontSize: 9, color: 'var(--color-warning)', fontWeight: 600 }}>draft</div>
          )}
        </div>

        {/* Carry-over */}
        <div style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {carryOver && carryOver.carriedUnits > 0 ? (
            <span style={{ fontWeight: 700, color: 'var(--color-info)' }}>
              −{carryOver.carriedUnits}
            </span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>0</span>
          )}
        </div>

        {/* Quinn */}
        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Sparkles size={11} color="var(--color-info)" />
            {quinnProposed}
          </div>
        </div>

        {/* You plan stepper */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            justifySelf: 'center',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#ffffff',
              border: `1px solid ${assemblyShort ? 'var(--color-error-border)' : deltaFromQuinn !== 0 ? 'var(--color-warning-border)' : 'var(--color-border)'}`,
              borderRadius: 6,
              padding: '3px 4px',
            }}
          >
            <button type="button" onClick={() => onBump(-1)} disabled={!canEdit || planned === 0} style={stepBtn(!canEdit || planned === 0)}>
              <Minus size={11} />
            </button>
            <input
              type="number"
              value={planned}
              disabled={!canEdit}
              onChange={e => onSet(Number(e.target.value) || 0)}
              style={{
                width: 48,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                appearance: 'textfield',
                MozAppearance: 'textfield',
              }}
            />
            <button type="button" onClick={() => onBump(1)} disabled={!canEdit} style={stepBtn(!canEdit)}>
              <Plus size={11} />
            </button>
            {deltaFromQuinn !== 0 && canEdit && (
              <button
                type="button"
                aria-label="Reset to Quinn"
                onClick={onResetToQuinn}
                style={{
                  width: 22,
                  height: 22,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Reset to Quinn's proposal"
              >
                <RotateCcw size={11} />
              </button>
            )}
          </div>
          {isComponent && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: assemblyShort ? 'var(--color-error)' : 'var(--color-info)',
                fontVariantNumeric: 'tabular-nums',
              }}
              title="Demand from assemblies"
            >
              + {assemblyDemand.totalUnits} from assemblies
              {assemblyShort && canEdit && (
                <button
                  type="button"
                  onClick={onAbsorb}
                  style={{
                    marginLeft: 4,
                    padding: '0 5px',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-error)',
                    background: '#ffffff',
                    border: '1px solid var(--color-error-border)',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                  title="Bump your plan to match assembly demand"
                >
                  Cover
                </button>
              )}
            </span>
          )}
        </div>

        {/* Batches */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {split.batches.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
          ) : split.batches.length > 6 ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-hover)',
                padding: '2px 6px',
                borderRadius: 4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {split.batches.length} × {eff.max}
            </span>
          ) : (
            split.batches.map((b, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: 3,
                  background:
                    b < eff.min || b > eff.max ? 'var(--color-error-light)' : 'var(--color-bg-hover)',
                  color:
                    b < eff.min || b > eff.max ? 'var(--color-error)' : 'var(--color-text-primary)',
                  border:
                    b < eff.min || b > eff.max
                      ? '1px solid var(--color-error-border)'
                      : '1px solid var(--color-border-subtle)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {b}
              </span>
            ))
          )}
          {underBatchMin && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--color-error)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
              title={`Minimum batch is ${eff.min}`}
            >
              <AlertTriangle size={9} /> under min
            </span>
          )}
        </div>

        {/* Lands on */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {primaryBench ? (
            <>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {primaryBench.name}
              </span>
              {benches.length > 1 && (
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
                  + {benches.length - 1} more stage{benches.length - 1 === 1 ? '' : 's'}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Unassigned</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            padding: '14px 16px 16px 42px',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
            display: 'grid',
            gridTemplateColumns: isAssembly || isComponent ? 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
            gap: 20,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Forecast reasoning */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Forecast signals
            </div>
            {forecast ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {forecast.signals.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    <span
                      style={{
                        minWidth: 44,
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--color-info)',
                        background: 'var(--color-info-light)',
                        padding: '1px 5px',
                        borderRadius: 3,
                        textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Math.round(s.weight * 100)}%
                    </span>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{SIGNAL_LABELS[s.signal]}</span>
                      {s.note && (
                        <span style={{ color: 'var(--color-text-muted)' }}> · {s.note}</span>
                      )}
                    </div>
                  </div>
                ))}
                {forecast.byPhase && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, fontSize: 11 }}>
                    <PhaseChip label="AM" value={forecast.byPhase.morning} />
                    <PhaseChip label="MID" value={forecast.byPhase.midday} />
                    <PhaseChip label="PM" value={forecast.byPhase.afternoon} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                <Info size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                No direct forecast. Demand comes from assemblies.
              </div>
            )}
          </div>

          {/* Assembly cascade (component) / Sub-recipes (assembly) */}
          {(isComponent || isAssembly) && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                {isComponent ? 'Drives from' : 'This recipe uses'}
              </div>
              {isComponent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {assemblyDemand.sources.map((s, i) => {
                    const parentRecipe = getRecipe(s.parentRecipeId);
                    return (
                      <div key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                        <Combine size={10} style={{ color: 'var(--color-info)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{parentRecipe?.name ?? s.parentRecipeId}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          × {s.parentPlannedQty} @ {s.quantityPerUnit}{s.unit === 'unit' ? '' : s.unit}/ea
                        </span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-info)', fontVariantNumeric: 'tabular-nums' }}>
                          +{s.contributedUnits}
                        </span>
                      </div>
                    );
                  })}
                  {assemblyDemand.totalGrams && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Total mass: {(assemblyDemand.totalGrams / 1000).toFixed(1)}kg → {assemblyDemand.totalUnits} tray
                      {assemblyDemand.totalUnits === 1 ? '' : 's'} @ {FILLING_TRAY_GRAMS / 1000}kg ea
                    </div>
                  )}
                </div>
              )}
              {isAssembly && recipe.subRecipes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recipe.subRecipes.map((sub, i) => {
                    const subRecipe = getRecipe(sub.recipeId);
                    const driven = sub.unit === 'unit'
                      ? planned * sub.quantityPerUnit
                      : Math.ceil((planned * sub.quantityPerUnit) / FILLING_TRAY_GRAMS);
                    return (
                      <div key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', gap: 6, alignItems: 'baseline' }}>
                        <Combine size={10} style={{ color: 'var(--color-info)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{subRecipe?.name ?? sub.recipeId}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {sub.quantityPerUnit}{sub.unit === 'unit' ? '' : sub.unit}/ea
                        </span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-info)', fontVariantNumeric: 'tabular-nums' }}>
                          needs {driven}{sub.unit === 'unit' ? '' : sub.unit === 'g' ? ' tray' : ''}
                          {sub.unit === 'unit' && driven !== 1 ? '' : sub.unit !== 'unit' && driven === 1 ? '' : sub.unit !== 'unit' ? 's' : driven === 1 ? '' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Batch rule breakdown */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Batch rules
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <div>
                <strong>Effective:</strong> {eff.min === Infinity ? 'none' : `${eff.min}–${eff.max === Infinity ? '∞' : eff.max} in ${eff.multipleOf}s`}
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--color-text-muted)' }}>
                {eff.explain}
              </div>
              {isComponent && effectivePlanned !== planned && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-info)', fontWeight: 600 }}>
                  Producing {effectivePlanned} (floor = assembly demand), not {planned}.
                </div>
              )}
              {split.overshoot > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>
                  <Split size={11} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                  Planned total {split.total} — +{split.overshoot} over (rounded up to multiples).
                </div>
              )}
              {split.undershoot > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-error)', fontWeight: 600 }}>
                  <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                  Short by {split.undershoot} — min batch {eff.min} can&rsquo;t cover remainder.
                </div>
              )}
            </div>
          </div>

          {/* Bench/workflow walk */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Workflow
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {benches.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  No benches match this workflow yet.
                </span>
              )}
              {benches.map((b, i) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', minWidth: 16 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{b.name}</span>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>· {b.capabilities.join(' / ')}</span>
                </div>
              ))}
              {line.item.mode === 'increment' && line.item.cadence && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>
                  Drops every {line.item.cadence.intervalMinutes} min, {line.item.cadence.startTime}–{line.item.cadence.endTime}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  emphasise = false,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  emphasise?: boolean;
  tone?: 'default' | 'neutral' | 'warning' | 'info';
}) {
  const color =
    tone === 'warning'
      ? 'var(--color-warning)'
      : tone === 'info'
      ? 'var(--color-info)'
      : 'var(--color-text-primary)';
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: emphasise ? 'var(--color-info-light)' : 'var(--color-bg-hover)',
        border: `1px solid ${emphasise ? 'var(--color-info)' : 'var(--color-border-subtle)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 9,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasise ? 22 : 18,
          fontWeight: 700,
          color,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PhaseChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--color-text-secondary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label} {value}
    </span>
  );
}

function stepBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
    border: '1px solid var(--color-border-subtle)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
    opacity: disabled ? 0.5 : 1,
  };
}

function formatSigned(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}
