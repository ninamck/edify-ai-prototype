'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  Search,
  X,
  Lock,
  Truck,
  Package,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import Link from 'next/link';
import StatusPill from './StatusPill';
import { getStepperButtonStyle } from './QtyStepper';
import { SelectionTagChip } from './RangeTierChips';
import { StaffLockBanner } from './RoleContext';
import { usePlan, usePlanStore, FILLING_TRAY_GRAMS, type PlanLine, type FocusReason } from './PlanStore';
import PlanFocusPanel from './PlanFocusPanel';
import {
  effectiveBatchRules,
  proposeBatchSplit,
  DEMO_TODAY,
  getRecipe,
  type SiteId,
  type ProductionRecipe,
  type ProductionMode,
  type DemandSignal,
  type StockCap,
} from './fixtures';
import { hhmmToMinutes, minutesToHHMM } from './time';

const CATEGORY_ORDER: ProductionRecipe['category'][] = [
  'Bakery',
  'Sandwich',
  'Salad',
  'Snack',
  'Beverage',
];

const MODE_STYLE = {
  run: { bg: 'var(--color-accent-active)', color: 'var(--color-text-on-active)', label: 'Run' },
  variable: { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', label: 'Variable' },
  increment: { bg: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', label: 'Segment' },
} as const;

type ModeTabId = 'all' | ProductionMode;

const MODE_TABS: Array<{ id: ModeTabId; label: string; hint: string }> = [
  { id: 'all', label: 'All', hint: 'Every recipe across run, variable, and segment production' },
  { id: 'run', label: 'Run amounts', hint: 'Planned in advance, made to a target quantity' },
  { id: 'variable', label: 'Variable', hint: 'Made on the floor on demand — assemble as needed' },
  { id: 'increment', label: 'Segment', hint: 'Cadence drops throughout the day (coffees, smoothies)' },
];

const SIGNAL_LABELS: Record<DemandSignal, string> = {
  'sales-history': 'Sales history',
  weather: 'Weather',
  'stock-on-hand': 'Stock on hand',
  'online-orders': 'Online orders',
  'waste-history': 'Waste history',
  event: 'Event',
  promo: 'Promo',
};

export type AmountsViewProps = {
  siteId: SiteId;
  date: string;
  /**
   * Optional production-item id to focus on mount (Quinn deep-link). When
   * present, the view clears any active filter that would hide the row,
   * expands it, scrolls it into view and pulses it for ~2s. The host owns
   * the state so it can also clear it from the URL.
   */
  focusedItemId?: string | null;
  /** Reason for the focus — drives the contextual banner at the top of the table. */
  focusReason?: FocusReason | null;
  /** Called when the manager dismisses the focus banner. */
  onClearFocus?: () => void;
  canEdit: boolean;
  /**
   * Optional banner rendered above the mode-tab strip (e.g. "Showing past
   * plan — locked for review" when viewing yesterday from the Plan page).
   */
  topBanner?: React.ReactNode;
};

export default function AmountsView({
  siteId,
  date,
  canEdit,
  topBanner,
  focusedItemId = null,
  focusReason = null,
  onClearFocus,
}: AmountsViewProps) {
  const { setPlanned, setPerDropPlan, setVariablePlan, resetToQuinn, resetAll, overrideCount } = usePlanStore();
  const [modeTab, setModeTab] = useState<ModeTabId>('all');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProductionRecipe['category']>('All');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Transient flag that drives the row's pulse animation. Cleared by a
  // timer ~2s after focus lands so the highlight is calm/not permanent.
  const [pulsingItemId, setPulsingItemId] = useState<string | null>(null);

  const lines = usePlan(siteId, date);
  // Past days are showing history — disable all editing affordances even
  // for managers. Future days stay editable so plans can be drafted ahead.
  const editable = canEdit && date >= DEMO_TODAY;

  // Counts per tab so the strip can show "(N)" affordances even when the tab
  // isn't active. Computed off the unfiltered set. A Run-mode item that's
  // gone variable (locked baseline + add-ons) counts under both Run and
  // Variable so the manager can find it from either entry point.
  const tabCounts = useMemo(() => {
    const counts: Record<ModeTabId, number> = { all: lines.length, run: 0, variable: 0, increment: 0 };
    for (const l of lines) {
      counts[l.item.mode] += 1;
      if (l.item.mode === 'run' && (l.runLocked || l.variablePlanned > 0)) {
        counts.variable += 1;
      }
    }
    return counts;
  }, [lines]);

  const inMode = useMemo(() => {
    if (modeTab === 'all') return lines;
    if (modeTab === 'variable') {
      return lines.filter(l => {
        if (l.item.mode === 'variable') return true;
        // Run items that are now in their variable phase.
        return l.item.mode === 'run' && (l.runLocked || l.variablePlanned > 0);
      });
    }
    return lines.filter(l => l.item.mode === modeTab);
  }, [lines, modeTab]);

  // Categories that actually exist within the current mode tab — so we don't
  // surface chips for empty buckets.
  const categoriesInMode = useMemo(() => {
    const set = new Set<ProductionRecipe['category']>();
    for (const l of inMode) set.add(l.recipe.category);
    return CATEGORY_ORDER.filter(c => set.has(c));
  }, [inMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = categoryFilter === 'All' ? inMode : inMode.filter(l => l.recipe.category === categoryFilter);
    if (q) {
      base = base.filter(l => {
        if (l.recipe.name.toLowerCase().includes(q)) return true;
        if (l.recipe.selectionTags.some(t => t.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return base;
  }, [inMode, categoryFilter, query]);

  // Reset category if switching to a tab where the chosen category doesn't exist.
  useEffect(() => {
    if (categoryFilter !== 'All' && !categoriesInMode.includes(categoryFilter)) {
      setCategoryFilter('All');
    }
  }, [categoryFilter, categoriesInMode]);

  // Quinn deep-link landing: when `focusedItemId` arrives we open the
  // PlanFocusPanel (the action-oriented workflow). Clearing the filters
  // up front ensures the corresponding row is visible underneath the
  // panel, so when the manager hits "Open row" the scroll-to-row flow
  // works without first having to undo a filter. The actual scroll +
  // pulse happens in `openRowInTable` below — triggered by the panel's
  // "Open row" button — not on initial focus, because the panel is the
  // primary surface and stealing scroll under it would feel disorienting.
  useEffect(() => {
    if (!focusedItemId) return;
    const target = lines.find(l => l.item.id === focusedItemId);
    if (!target) return;
    setModeTab('all');
    setCategoryFilter('All');
    setQuery('');
    setExpanded(prev => {
      if (prev.has(focusedItemId)) return prev;
      const next = new Set(prev);
      next.add(focusedItemId);
      return next;
    });
  }, [focusedItemId, siteId, date, lines]);

  // Triggered by the focus panel's "Open row" CTA. Closes the panel (via
  // onClearFocus on the host) and scrolls / pulses the row so the manager
  // can drill into the inline detail (ingredient breakdown, batch rules,
  // workflow walk) for a manual edit.
  function openRowInTable(itemId: string) {
    setPulsingItemId(itemId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-amount-row-id="${itemId}"]`);
      if (el && el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    window.setTimeout(() => setPulsingItemId(null), 2400);
    onClearFocus?.();
  }

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
    const shortfallLines: PlanLine[] = [];
    for (const l of lines) {
      if (l.assemblyDemand.totalUnits > l.planned) shortfallLines.push(l);
    }
    return { shortfalls: shortfallLines.length, shortfallLines };
  }, [lines]);

  // Shortfalls modal — opened from the header chip. Each row drills into
  // a component recipe whose downstream assembly demand outstrips the
  // current plan, with a per-source breakdown so the manager can see
  // exactly which assemblies are creating the deficit.
  const [shortfallsOpen, setShortfallsOpen] = useState(false);

  function bump(line: PlanLine, delta: number) {
    const step = line.recipe.batchRules?.multipleOf ?? 1;
    // For Run-mode items the stepper edits the *run baseline* (variable
    // top-ups live separately and only adjust from the expanded panel), so
    // we bump runPlanned. For everything else they're equal.
    const current = line.runPlanned;
    const next = Math.max(0, current + delta * step);
    setPlanned(line.item.id, next, date);
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
    setPlanned(line.item.id, line.assemblyDemand.totalUnits, date);
  }

  const dateOverrideCount = overrideCount(date);
  const isPastDay = date < DEMO_TODAY;
  // Default past-day banner. Hosts can override by passing their own
  // `topBanner` (e.g. the Plan page surfaces a styled "Showing past plan"
  // banner with extra context).
  const banner =
    topBanner ??
    (isPastDay ? (
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}
      >
        Showing past plan — locked for review
      </div>
    ) : null);

  // Lookup the focused line — we still need this to decide whether to
  // mount the side panel. Defensive: the line may not exist when the user
  // is on a different site/day than the nudge originated from.
  const focusedLine = focusedItemId ? lines.find(l => l.item.id === focusedItemId) ?? null : null;
  const showFocusPanel = !!focusedLine && !!focusReason;

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {banner}
      {showFocusPanel && (
        <PlanFocusPanel
          lines={lines}
          focusedItemId={focusedLine!.item.id}
          reason={focusReason!}
          onSetPlanned={(itemId, units) => setPlanned(itemId, units, date)}
          onOpenRow={openRowInTable}
          onClose={() => {
            setPulsingItemId(null);
            onClearFocus?.();
          }}
        />
      )}
      {/* Mode tabs + global actions — sits at the top of the editor so the tab
          strip frames the table area. Site/date selection live in the host page. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: '#ffffff',
        }}
      >
        <div
          role="tablist"
          aria-label="Production mode"
          style={{
            display: 'flex',
            background: 'var(--color-bg-hover)',
            borderRadius: '100px',
            padding: '3px',
            width: 'fit-content',
          }}
        >
          {MODE_TABS.map(t => {
            const active = t.id === modeTab;
            const count = tabCounts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setModeTab(t.id)}
                title={t.hint}
                style={{
                  padding: '8px 18px',
                  borderRadius: '100px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  background: active ? 'var(--color-accent-active)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {t.label}
                <ModeTabBadge count={count} active={active} />
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        {totals.shortfalls > 0 && (
          <button
            type="button"
            onClick={() => setShortfallsOpen(true)}
            title="See which components are short and which assemblies need them"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              background: 'var(--color-error-light)',
              color: 'var(--color-error)',
              border: '1px solid var(--color-error-border)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
            }}
          >
            <AlertTriangle size={12} /> {totals.shortfalls} component shortfall
            {totals.shortfalls === 1 ? '' : 's'}
            <ChevronRight size={11} style={{ marginLeft: 2, opacity: 0.7 }} />
          </button>
        )}
        {dateOverrideCount > 0 && editable && (
          <button
            type="button"
            onClick={() => resetAll(date)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              background: '#ffffff',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} /> Reset {dateOverrideCount} to Quinn
          </button>
        )}
        <Link
          href="/production/board"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            background: '#ffffff',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          See benches <ArrowRight size={12} />
        </Link>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px 32px', background: 'var(--color-bg-surface)' }}>
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
              gridTemplateColumns: 'minmax(260px, 1.6fr) 100px 100px 110px 200px 180px 150px',
              padding: '14px 16px',
              gap: 12,
              background: 'var(--color-bg-hover)',
              borderBottom: '1px solid var(--color-border-subtle)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              position: 'sticky',
              top: 46,
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

          {/* Category filter sub-row — sits under the column header so it
              filters within the active mode tab without competing with it. */}
          {categoriesInMode.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                padding: '12px 16px',
                background: '#ffffff',
                borderBottom: '1px solid var(--color-border-subtle)',
                position: 'sticky',
                top: 90,
                zIndex: 9,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginRight: 2,
                }}
              >
                Category
              </span>
              {(['All', ...categoriesInMode] as const).map(c => {
                const active = c === categoryFilter;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoryFilter(c)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 999,
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
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  minWidth: 220,
                }}
              >
                <Search size={14} color="var(--color-text-muted)" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search products"
                  aria-label="Search products"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 12,
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-text-primary)',
                    padding: 0,
                  }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    style={{
                      width: 20,
                      height: 20,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      borderRadius: 4,
                      padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {grouped.length === 0 && (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                fontSize: 12,
              }}
            >
              {inMode.length === 0
                ? `No ${MODE_TABS.find(t => t.id === modeTab)?.label.toLowerCase() ?? ''} recipes at this site.`
                : query.trim()
                ? `No recipes match “${query.trim()}”.`
                : 'No recipes match the current category filter.'}
            </div>
          )}

          {grouped.map((group, gi) => (
            <div key={group.category}>
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--color-bg-surface)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  borderTop: gi === 0 ? 'none' : '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
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
                  canEdit={editable}
                  onBump={d => bump(line, d)}
                  onSet={v => setPlanned(line.item.id, v, date)}
                  onSetPerDrop={arr => setPerDropPlan(line.item.id, arr, date)}
                  onSetVariable={v => setVariablePlan(line.item.id, v, date)}
                  onResetToQuinn={() => resetToQuinn(line.item.id, date)}
                  onAbsorb={() => absorbAssemblyDemand(line)}
                  pulsing={pulsingItemId === line.item.id}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
    <AnimatePresence>
      {shortfallsOpen && (
        <ShortfallsModal
          key="shortfalls-modal"
          lines={totals.shortfallLines}
          onClose={() => setShortfallsOpen(false)}
          onOpenRow={id => {
            setShortfallsOpen(false);
            openRowInTable(id);
          }}
        />
      )}
    </AnimatePresence>
    </>
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
  onSetPerDrop,
  onSetVariable,
  onResetToQuinn,
  onAbsorb,
  pulsing = false,
}: {
  line: PlanLine;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onBump: (delta: number) => void;
  onSet: (v: number) => void;
  onSetPerDrop: (perDrop: number[]) => void;
  onSetVariable: (v: number) => void;
  onResetToQuinn: () => void;
  onAbsorb: () => void;
  /** When true, show a transient highlight glow (Quinn deep-link landing). */
  pulsing?: boolean;
}) {
  const { recipe, forecast, carryOver, quinnProposed, dispatchDemand, dispatchBySpoke, stockCap, primaryBench, benches, planned, runPlanned, variablePlanned, runLocked, lockedRunLabels, effectivePlanned, assemblyDemand } = line;
  const counterUnits = forecast?.projectedUnits ?? 0;
  const hasDispatch = dispatchDemand > 0;
  const eff = effectiveBatchRules(recipe.batchRules, primaryBench?.batchRules);
  const split = proposeBatchSplit(effectivePlanned, eff);
  const deltaFromQuinn = planned - quinnProposed;
  const modeStyle = MODE_STYLE[line.item.mode];
  const isComponent = assemblyDemand.totalUnits > 0;
  const assemblyShort = assemblyDemand.totalUnits > planned;
  const underBatchMin = effectivePlanned > 0 && effectivePlanned < eff.min;
  const isAssembly = !!recipe.subRecipes && recipe.subRecipes.length > 0;

  // Dual-mode display: a Run-mode item enters its "Variable" phase once any
  // of its scheduled runs lock in. While unlocked, we show a single stepper
  // (run baseline). Once locked, the run number becomes read-only and a
  // separate variable add-on stepper appears below it.
  const isDualMode = line.item.mode === 'run' && (runLocked || variablePlanned > 0);

  // Segment (cadence) planning. The PlanStore still keeps a whole-day total,
  // but for increment items we surface a per-drop stepper so Managers plan in
  // segments. Day total = perDrop * dropsCount, which is what we hand back to
  // setPlanned() via onSet.
  const cadence = line.item.mode === 'increment' ? line.item.cadence : undefined;
  const dropsCount = cadence
    ? Math.max(0, Math.floor((hhmmToMinutes(cadence.endTime) - hhmmToMinutes(cadence.startTime)) / cadence.intervalMinutes) + 1)
    : 0;
  const isSegment = !!cadence;
  const segmentEditable = isSegment && dropsCount > 0;
  const perDropArray = segmentEditable
    ? line.perDropPlan && line.perDropPlan.length === dropsCount
      ? line.perDropPlan
      : Array(dropsCount).fill(Math.round(planned / dropsCount))
    : [];
  const dropsVary =
    segmentEditable && perDropArray.length > 1
      ? !perDropArray.every(v => v === perDropArray[0])
      : false;
  const perDropPlanned = segmentEditable
    ? dropsVary
      ? Math.round(planned / dropsCount)
      : perDropArray[0] ?? 0
    : 0;
  const perDropQuinn = segmentEditable
    ? quinnProposed > 0
      ? Math.round(quinnProposed / dropsCount)
      : line.item.batchSize
    : 0;
  const setUniformPerDrop = (n: number) => {
    const v = Math.max(0, n);
    onSetPerDrop(Array(dropsCount).fill(v));
  };
  const bumpPerDrop = (delta: number) => setUniformPerDrop(perDropPlanned + delta);
  const setSingleDrop = (idx: number, n: number) => {
    const next = perDropArray.slice();
    next[idx] = Math.max(0, n);
    onSetPerDrop(next);
  };
  const bumpSingleDrop = (idx: number, delta: number) => setSingleDrop(idx, (perDropArray[idx] ?? 0) + delta);

  // Shortfalls get a thin left-edge accent rather than a full red wash;
  // the "Cover" CTA below the stepper still carries the urgent colour.
  const rowBg = pulsing ? 'var(--color-warning-bg)' : '#ffffff';
  const rowBorderLeft = assemblyShort ? '3px solid var(--color-error)' : '3px solid transparent';

  return (
    <>
      <div
        data-amount-row-id={line.item.id}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1.6fr) 100px 100px 110px 200px 180px 150px',
          padding: '8px 16px 8px 13px',
          gap: 12,
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-subtle)',
          borderLeft: rowBorderLeft,
          background: rowBg,
          cursor: 'pointer',
          fontSize: 11,
          // ~120px gives the row breathing room under the sticky page
          // header / site selector when scrollIntoView lands.
          scrollMarginTop: 120,
          // Box-shadow ring + smooth transition stand in for a CSS
          // keyframes pulse without needing a global stylesheet edit.
          boxShadow: pulsing ? '0 0 0 2px var(--color-warning) inset, 0 4px 14px rgba(245,166,35,0.18)' : 'none',
          transition: 'background 0.4s ease, box-shadow 0.4s ease',
        }}
        onClick={onToggle}
      >
        {/* Recipe column */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}
            style={{
              width: 32,
              height: 32,
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
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
                  padding: '3px 8px',
                  borderRadius: 5,
                  background: modeStyle.bg,
                  color: modeStyle.color,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={
                  isDualMode
                    ? `${modeStyle.label} run${lockedRunLabels.length ? ` (${lockedRunLabels.join(', ')} locked)` : ''} · variable top-ups for the rest of the day`
                    : `${modeStyle.label} mode`
                }
              >
                {modeStyle.label}
                {isDualMode && (
                  <>
                    <span style={{ opacity: 0.55 }}>+</span>
                    <span>VAR</span>
                  </>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {recipe.selectionTags.slice(0, 2).map(t => (
                <SelectionTagChip key={t} tag={t} size="xs" />
              ))}
              {isAssembly && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: 'var(--color-bg-hover)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
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
                    color: 'var(--color-text-secondary)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    background: 'var(--color-bg-hover)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`${assemblyDemand.sources.length} assemblies pull from this recipe`}
                >
                  <ArrowDown size={9} /> Component
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Forecast — own counter sales, with a small dispatch chip when this
            hub also owes units to spokes for the planned date. */}
        <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {forecast ? counterUnits : <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>—</span>}
          {forecast?.status === 'draft' && (
            <div style={{ fontSize: 9, color: 'var(--color-warning)', fontWeight: 600 }}>draft</div>
          )}
          {hasDispatch && (
            <div
              style={{
                marginTop: 2,
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'var(--color-bg-hover)',
                border: '1px solid var(--color-border-subtle)',
              }}
              title={`+${dispatchDemand} units to dispatch to ${dispatchBySpoke?.length ?? 0} spoke${(dispatchBySpoke?.length ?? 0) === 1 ? '' : 's'}`}
            >
              <Truck size={9} />+{dispatchDemand}
            </div>
          )}
        </div>

        {/* Carry-over */}
        <div style={{ textAlign: 'right', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {carryOver && carryOver.carriedUnits > 0 ? (
            <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              −{carryOver.carriedUnits}
            </span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>0</span>
          )}
        </div>

        {/* Quinn */}
        <div
          style={{
            textAlign: 'right',
            fontSize: 13,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          <div
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            title={segmentEditable ? `${perDropQuinn} per drop · ${quinnProposed}/day` : undefined}
          >
            <EdifyMark size={11} color="var(--color-text-muted)" />
            {segmentEditable ? perDropQuinn : quinnProposed}
          </div>
          {stockCap && stockCap.cap < quinnProposed && (
            <StockCapChip stockCap={stockCap} />
          )}
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
              gap: 6,
              background: runLocked ? 'var(--color-bg-hover)' : '#ffffff',
              border: `1px solid ${assemblyShort ? 'var(--color-error-border)' : 'var(--color-border)'}`,
              borderRadius: 8,
              padding: '4px 6px',
            }}
            title={runLocked ? `${lockedRunLabels.join(', ') || 'Run'} locked — open the row to add variable top-ups` : undefined}
          >
            {runLocked && (
              <Lock size={12} color="var(--color-text-muted)" style={{ marginLeft: 2, marginRight: -2 }} />
            )}
            <button
              type="button"
              onClick={() => (segmentEditable ? bumpPerDrop(-1) : onBump(-1))}
              disabled={
                !canEdit ||
                runLocked ||
                (isSegment && !segmentEditable) ||
                dropsVary ||
                (segmentEditable ? perDropPlanned === 0 : runPlanned === 0)
              }
              style={stepBtn(
                !canEdit ||
                  runLocked ||
                  (isSegment && !segmentEditable) ||
                  dropsVary ||
                  (segmentEditable ? perDropPlanned === 0 : runPlanned === 0),
              )}
              title={runLocked ? 'Run is locked — adjust variable top-ups inside the expanded row' : dropsVary ? 'Drops vary — adjust them in the expanded panel' : undefined}
            >
              <Minus size={14} />
            </button>
            {dropsVary ? (
              <span
                onClick={onToggle}
                style={{
                  width: 44,
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  fontStyle: 'italic',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                }}
                title="Per-drop quantities vary — open to adjust"
              >
                varies
              </span>
            ) : (
              <input
                type="number"
                value={segmentEditable ? perDropPlanned : runPlanned}
                disabled={!canEdit || runLocked || (isSegment && !segmentEditable)}
                onChange={e => {
                  const v = Number(e.target.value) || 0;
                  if (segmentEditable) setUniformPerDrop(v);
                  else onSet(v);
                }}
                style={{
                  width: 44,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-primary)',
                  padding: 0,
                  margin: 0,
                  boxSizing: 'border-box',
                  appearance: 'textfield',
                  MozAppearance: 'textfield',
                }}
              />
            )}
            <button
              type="button"
              onClick={() => (segmentEditable ? bumpPerDrop(1) : onBump(1))}
              disabled={!canEdit || runLocked || (isSegment && !segmentEditable) || dropsVary}
              style={stepBtn(!canEdit || runLocked || (isSegment && !segmentEditable) || dropsVary)}
              title={runLocked ? 'Run is locked — adjust variable top-ups inside the expanded row' : dropsVary ? 'Drops vary — adjust them in the expanded panel' : undefined}
            >
              <Plus size={14} />
            </button>
            {deltaFromQuinn !== 0 && canEdit && !runLocked && (
              <button
                type="button"
                aria-label="Reset to Quinn"
                onClick={onResetToQuinn}
                style={{
                  width: 32,
                  height: 32,
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Reset to Quinn's proposal"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
          {isDualMode ? (
            <button
              type="button"
              onClick={onToggle}
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'var(--font-primary)',
              }}
              title={`Run ${runPlanned} + Variable ${variablePlanned} = ${planned} today · open to adjust variable`}
            >
              {variablePlanned > 0
                ? `+${variablePlanned} var · = ${planned} today`
                : 'add variable in expanded'}
            </button>
          ) : segmentEditable ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 4,
              }}
              title={
                dropsVary
                  ? `Drops vary — sum across ${dropsCount} drops`
                  : `${perDropPlanned} per drop × ${dropsCount} drops`
              }
            >
              {dropsVary
                ? `${dropsCount} drops · ${planned}/day`
                : `× ${dropsCount} drops = ${perDropPlanned * dropsCount}/day`}
            </span>
          ) : isSegment ? (
            <span style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>—</span>
          ) : isComponent ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: assemblyShort ? 'var(--color-error)' : 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Demand from assemblies"
            >
              + {assemblyDemand.totalUnits} from assemblies
              {assemblyShort && canEdit && (
                <button
                  type="button"
                  onClick={onAbsorb}
                  style={{
                    padding: '4px 10px',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-error)',
                    background: '#ffffff',
                    border: '1px solid var(--color-error-border)',
                    borderRadius: 5,
                    cursor: 'pointer',
                  }}
                  title="Bump your plan to match assembly demand"
                >
                  Cover
                </button>
              )}
            </span>
          ) : null}
        </div>

        {/* Batches */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {isSegment && cadence ? (
            segmentEditable ? (
              <CadenceTickStrip cadence={cadence} dropsCount={dropsCount} />
            ) : (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
            )
          ) : split.batches.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
          ) : split.batches.length > 6 ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-hover)',
                padding: '4px 8px',
                borderRadius: 5,
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
                  padding: '3px 7px',
                  borderRadius: 4,
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
          {underBatchMin && !isSegment && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--color-error)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={`Minimum batch is ${eff.min}`}
            >
              <AlertTriangle size={9} /> under min
            </span>
          )}
        </div>

        {/* Lands on */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
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

      {/* Expanded detail — per-drop plan section appears first for segments */}
      {expanded && segmentEditable && cadence && (
        <div
          style={{
            padding: '18px 20px 8px 46px',
            background: 'var(--color-bg-surface)',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-muted)',
              }}
            >
              Plan per drop
            </div>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {dropsCount} drops · every {cadence.intervalMinutes}min · {cadence.startTime}–{cadence.endTime} ·{' '}
              <strong style={{ color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                {planned}/day
              </strong>
            </span>
            <div style={{ flex: 1 }} />
            {dropsVary && canEdit && (
              <button
                type="button"
                onClick={() => setUniformPerDrop(perDropPlanned)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-secondary)',
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Set every drop to the same quantity"
              >
                <RotateCcw size={13} /> Make uniform
              </button>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            {perDropArray.map((qty, idx) => {
              const dropMins = hhmmToMinutes(cadence.startTime) + idx * cadence.intervalMinutes;
              const time = minutesToHHMM(dropMins);
              const isOff = qty === 0;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 10px 8px',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1px solid var(--color-border-subtle)',
                    minWidth: 88,
                    opacity: isOff ? 0.55 : 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      letterSpacing: '0.04em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {time}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => bumpSingleDrop(idx, -1)}
                      disabled={!canEdit || qty === 0}
                      style={stepBtn(!canEdit || qty === 0)}
                      aria-label={`Decrease drop at ${time}`}
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      value={qty}
                      disabled={!canEdit}
                      onChange={e => setSingleDrop(idx, Number(e.target.value) || 0)}
                      style={{
                        width: 32,
                        textAlign: 'center',
                        fontSize: 16,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-primary)',
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box',
                        appearance: 'textfield',
                        MozAppearance: 'textfield',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => bumpSingleDrop(idx, 1)}
                      disabled={!canEdit}
                      style={stepBtn(!canEdit)}
                      aria-label={`Increase drop at ${time}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {isDualMode && (
            <div
              style={{
                padding: '16px 20px 14px 46px',
                borderBottom: '1px dashed var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {runLocked && <Lock size={12} color="var(--color-text-muted)" />}
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                    Today's plan · {runLocked ? `${lockedRunLabels.join(', ') || 'Run'} locked` : 'Run scheduled'}
                  </span>
                </div>
                <DualModeStepper
                  runPlanned={runPlanned}
                  variablePlanned={variablePlanned}
                  quinnProposed={quinnProposed}
                  runLocked={runLocked}
                  lockedRunLabels={lockedRunLabels}
                  canEdit={canEdit}
                  assemblyShort={assemblyShort}
                  assemblyDemandUnits={assemblyDemand.totalUnits}
                  isComponent={isComponent}
                  onSetRun={v => onSet(v)}
                  onSetVariable={onSetVariable}
                  onAbsorb={onAbsorb}
                  onResetToQuinn={onResetToQuinn}
                  isOverridden={line.isOverridden}
                />
              </div>
              <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 18 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {runLocked
                    ? `${lockedRunLabels.join(' & ') || 'This run'} is in progress or done — the run baseline is read-only. Add variable top-ups above for the rest of the day as new demand comes in.`
                    : 'Run baseline is still editable. Once the run starts it locks; variable top-ups stay open all day.'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  Quinn forecast: {quinnProposed} · current plan: {planned}
                </span>
              </div>
            </div>
          )}
          <div
            style={{
              padding: '18px 20px 20px 46px',
              display: 'grid',
              gridTemplateColumns: isAssembly || isComponent ? 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
              gap: 24,
            }}
          >
          {/* Forecast reasoning */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              {hasDispatch ? 'Selling vs dispatching' : 'Forecast signals'}
            </div>

            {/* Selling-vs-dispatching ledger — only on hub rows that owe a
                spoke. Sits above the forecast signals so the manager sees
                why Quinn is asking for more than counter sales. */}
            {hasDispatch && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  marginBottom: 12,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: '#ffffff',
                  border: '1px solid var(--color-border-subtle)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <DispatchLedgerRow label="Counter (own sales)" value={counterUnits} />
                {dispatchBySpoke?.map(d => (
                  <DispatchLedgerRow
                    key={d.spokeId}
                    label={`→ ${d.spokeName}`}
                    value={d.units}
                    sub={d.isQuinn ? 'quinn-proposed · spoke not yet confirmed' : `confirmed · ${d.status}`}
                    quinn={d.isQuinn}
                  />
                ))}
                {carryOver && carryOver.carriedUnits > 0 && (
                  <DispatchLedgerRow label="Carry-over" value={-carryOver.carriedUnits} muted />
                )}
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 6,
                    borderTop: '1px dashed var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <EdifyMark size={11} color="var(--color-text-muted)" />
                  <span>Quinn proposes</span>
                  <span style={{ marginLeft: 'auto' }}>{quinnProposed}</span>
                </div>
              </div>
            )}

            {forecast ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {forecast.signals.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    <span
                      style={{
                        minWidth: 48,
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-bg-hover)',
                        padding: '2px 7px',
                        borderRadius: 4,
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
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 11 }}>
                    <PhaseChip label="AM" value={forecast.byPhase.morning} />
                    <PhaseChip label="MID" value={forecast.byPhase.midday} />
                    <PhaseChip label="PM" value={forecast.byPhase.afternoon} />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                <Info size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />
                No direct forecast. Demand comes from assemblies.
              </div>
            )}
          </div>

          {/* Assembly cascade (component) / Sub-recipes (assembly) */}
          {(isComponent || isAssembly) && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                {isComponent ? 'Drives from' : 'This recipe uses'}
              </div>
              {isComponent && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {assemblyDemand.sources.map((s, i) => {
                    const parentRecipe = getRecipe(s.parentRecipeId);
                    return (
                      <div key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <Combine size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{parentRecipe?.name ?? s.parentRecipeId}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          × {s.parentPlannedQty} @ {s.quantityPerUnit}{s.unit === 'unit' ? '' : s.unit}/ea
                        </span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                          +{s.contributedUnits}
                        </span>
                      </div>
                    );
                  })}
                  {assemblyDemand.totalGrams && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6 }}>
                      Total mass: {(assemblyDemand.totalGrams / 1000).toFixed(1)}kg → {assemblyDemand.totalUnits} tray
                      {assemblyDemand.totalUnits === 1 ? '' : 's'} @ {FILLING_TRAY_GRAMS / 1000}kg ea
                    </div>
                  )}
                </div>
              )}
              {isAssembly && recipe.subRecipes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recipe.subRecipes.map((sub, i) => {
                    const subRecipe = getRecipe(sub.recipeId);
                    const driven = sub.unit === 'unit'
                      ? planned * sub.quantityPerUnit
                      : Math.ceil((planned * sub.quantityPerUnit) / FILLING_TRAY_GRAMS);
                    return (
                      <div key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <Combine size={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{subRecipe?.name ?? sub.recipeId}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {sub.quantityPerUnit}{sub.unit === 'unit' ? '' : sub.unit}/ea
                        </span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
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

          {/* Ingredient stock cap (F3 + PAC045) — base recipes only. */}
          {stockCap && <StockCapPanel stockCap={stockCap} planned={effectivePlanned} />}

          {/* Batch rule breakdown */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Batch rules
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              <div>
                <strong>Effective:</strong> {eff.min === Infinity ? 'none' : `${eff.min}–${eff.max === Infinity ? '∞' : eff.max} in ${eff.multipleOf}s`}
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--color-text-muted)' }}>
                {eff.explain}
              </div>
              {isComponent && effectivePlanned !== planned && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Producing {effectivePlanned} (floor = assembly demand), not {planned}.
                </div>
              )}
              {split.overshoot > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>
                  <Split size={11} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />
                  Planned total {split.total} — +{split.overshoot} over (rounded up to multiples).
                </div>
              )}
              {split.undershoot > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-error)', fontWeight: 600 }}>
                  <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />
                  Short by {split.undershoot} — min batch {eff.min} can&rsquo;t cover remainder.
                </div>
              )}
            </div>
          </div>

          {/* Bench/workflow walk */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Workflow
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {benches.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  No benches match this workflow yet.
                </span>
              )}
              {benches.map((b, i) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', minWidth: 18 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{b.name}</span>
                  <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>· {b.capabilities.join(' / ')}</span>
                </div>
              ))}
              {line.item.mode === 'increment' && line.item.cadence && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>
                  Drops every {line.item.cadence.intervalMinutes} min, {line.item.cadence.startTime}–{line.item.cadence.endTime}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ModeTabBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '18px',
        height: '18px',
        padding: '0 5px',
        borderRadius: '100px',
        fontSize: '12px',
        fontWeight: 700,
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-border-subtle)',
        color: active ? '#fff' : 'var(--color-text-secondary)',
      }}
    >
      {count}
    </span>
  );
}

function CadenceTickStrip({
  cadence,
  dropsCount,
}: {
  cadence: NonNullable<PlanLine['item']['cadence']>;
  dropsCount: number;
}) {
  const startMin = hhmmToMinutes(cadence.startTime);
  const endMin = hhmmToMinutes(cadence.endTime);
  const span = Math.max(1, endMin - startMin);
  const ticks: number[] = [];
  for (let m = startMin; m <= endMin; m += cadence.intervalMinutes) ticks.push(m);
  const title = `${dropsCount} drops · every ${cadence.intervalMinutes}min · ${cadence.startTime}–${cadence.endTime}\n${ticks.map(minutesToHHMM).join('  ')}`;
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', minWidth: 0 }}
      title={title}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 160,
          height: 18,
          borderRadius: 9,
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: '50%',
            height: 1,
            background: 'var(--color-border)',
          }}
        />
        {ticks.map(m => {
          const pct = ((m - startMin) / span) * 100;
          return (
            <span
              key={m}
              style={{
                position: 'absolute',
                left: `calc(${pct}% - 2px)`,
                top: 5,
                width: 4,
                height: 8,
                borderRadius: 2,
                background: 'var(--color-text-muted)',
              }}
            />
          );
        })}
      </div>
      <span
        style={{
          fontSize: 9,
          color: 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {dropsCount} drops · every {cadence.intervalMinutes}min
      </span>
    </div>
  );
}

function PhaseChip({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: 5,
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

// One row in the "Selling vs dispatching" ledger surfaced inside the
// expanded panel for hub rows that have spoke dispatch demand.
function DispatchLedgerRow({
  label,
  value,
  sub,
  muted = false,
  quinn = false,
}: {
  label: string;
  value: number;
  sub?: string;
  muted?: boolean;
  quinn?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        fontSize: 11,
        color: muted ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
      }}
    >
      <span style={{ fontWeight: 600, color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
        {label}
      </span>
      {sub && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {quinn && <EdifyMark size={9} color="var(--color-text-muted)" />}
          {sub}
        </span>
      )}
      <span
        style={{
          marginLeft: 'auto',
          fontWeight: 700,
          color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

// ─── Stock-cap chip + panel (F3 + PAC045) ───────────────────────────────────
//
// `StockCapChip` is the in-row warning shown next to Quinn's proposal when
// the proposal exceeds what current ingredient stock can produce. It names
// the binding ingredient and the unit cap. The expanded `StockCapPanel`
// lists every ingredient drawn on by the recipe with its individual cap so
// the GM can see how close the next-tightest constraint is.

function StockCapChip({ stockCap }: { stockCap: StockCap }) {
  const binding = stockCap.bindingIngredients[0];
  if (!binding) return null;
  return (
    <div
      style={{
        marginTop: 1,
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--color-warning)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 5px',
        borderRadius: 3,
        background: 'var(--color-warning-bg)',
        border: '1px solid var(--color-warning-border)',
      }}
      title={
        `Cap ${stockCap.cap} · binding on ${binding.ingredientName} ` +
        `(${formatStockUnits(binding.onHand, binding.unit)} on hand, ` +
        `${formatStockUnits(binding.perUnit, binding.unit)}/unit)`
      }
    >
      <Package size={9} />Cap {stockCap.cap}
    </div>
  );
}

function StockCapPanel({ stockCap, planned }: { stockCap: StockCap; planned: number }) {
  const overCap = planned > stockCap.cap;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
        Ingredient stock
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stockCap.ingredients.map((b, i) => {
          const isBinding = stockCap.bindingIngredients.some(x => x.ingredientId === b.ingredientId);
          const needed = planned * b.perUnit;
          const short = needed > b.onHand;
          return (
            <div
              key={b.ingredientId}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                padding: '4px 6px',
                borderRadius: 4,
                background: isBinding ? 'var(--color-warning-bg)' : 'transparent',
                border: isBinding ? '1px solid var(--color-warning-border)' : '1px solid transparent',
              }}
            >
              <Package size={10} style={{ color: isBinding ? 'var(--color-warning)' : 'var(--color-text-muted)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', minWidth: 130 }}>
                {b.ingredientName}
                {i === 0 && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--color-warning)', fontWeight: 700 }}>BINDING</span>}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {formatStockUnits(b.onHand, b.unit)} ÷ {formatStockUnits(b.perUnit, b.unit)}/ea
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontWeight: 700,
                  color: short ? 'var(--color-error)' : 'var(--color-text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
                title={short ? `Plan needs ${formatStockUnits(needed, b.unit)}; only ${formatStockUnits(b.onHand, b.unit)} on hand` : undefined}
              >
                {b.unitsAvailable === Infinity ? '∞' : `${b.unitsAvailable} units`}
              </span>
            </div>
          );
        })}
      </div>
      {overCap && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--color-error)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Plan {planned} exceeds stock cap {stockCap.cap}. Either drop the plan to {stockCap.cap}
            {stockCap.bindingIngredients.length > 0 && ` or top up ${stockCap.bindingIngredients[0].ingredientName}`}.
          </span>
        </div>
      )}
    </div>
  );
}

function formatStockUnits(qty: number, unit: string): string {
  if (unit === 'g') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)}kg` : `${qty}g`;
  }
  if (unit === 'ml') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)}L` : `${qty}ml`;
  }
  return `${qty}`;
}

// ─── Dual-mode stepper (Run baseline + Variable add-ons) ────────────────────
//
// Shown for Run-mode items that have entered their variable phase: the
// scheduled run is locked (or the manager has already added top-ups) and
// the rest of the day is open for ad-hoc additions. Two stacked rows:
//
//   [🔒 R1  96 ]   ← Run baseline. Read-only when locked, editable otherwise.
//   [+ Var − 5 +]  ← Variable add-on. Always editable while the day is live.
//   = 101 today
//
function DualModeStepper({
  runPlanned,
  variablePlanned,
  quinnProposed,
  runLocked,
  lockedRunLabels,
  canEdit,
  assemblyShort,
  assemblyDemandUnits,
  isComponent,
  onSetRun,
  onSetVariable,
  onAbsorb,
  onResetToQuinn,
  isOverridden,
}: {
  runPlanned: number;
  variablePlanned: number;
  quinnProposed: number;
  runLocked: boolean;
  lockedRunLabels: string[];
  canEdit: boolean;
  assemblyShort: boolean;
  assemblyDemandUnits: number;
  isComponent: boolean;
  onSetRun: (v: number) => void;
  onSetVariable: (v: number) => void;
  onAbsorb: () => void;
  onResetToQuinn: () => void;
  isOverridden: boolean;
}) {
  const total = runPlanned + variablePlanned;
  const runLabel = lockedRunLabels.length > 0 ? lockedRunLabels.join('+') : 'Run';
  const bumpVar = (delta: number) => onSetVariable(Math.max(0, variablePlanned + delta));
  const bumpRun = (delta: number) => onSetRun(Math.max(0, runPlanned + delta));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, width: '100%', maxWidth: 200 }}>
      {/* Run baseline row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: runLocked ? 'var(--color-bg-hover)' : '#ffffff',
          border: `1px solid ${assemblyShort ? 'var(--color-error-border)' : 'var(--color-border-subtle)'}`,
          borderRadius: 7,
          padding: '3px 6px',
          height: 30,
        }}
        title={runLocked ? `${runLabel} locked — already in progress or done` : `${runLabel} baseline — editable until the run starts`}
      >
        {runLocked ? (
          <Lock size={11} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
        ) : (
          <span style={{ width: 11, flexShrink: 0 }} />
        )}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            minWidth: 18,
            textAlign: 'left',
          }}
        >
          {runLabel}
        </span>
        {runLocked ? (
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-primary)',
            }}
          >
            {runPlanned}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => bumpRun(-1)}
              disabled={!canEdit || runPlanned === 0}
              style={miniStepBtn(!canEdit || runPlanned === 0)}
            >
              <Minus size={11} />
            </button>
            <input
              type="number"
              value={runPlanned}
              disabled={!canEdit}
              onChange={e => onSetRun(Number(e.target.value) || 0)}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-primary)',
                padding: 0,
                margin: 0,
                width: 28,
                appearance: 'textfield',
                MozAppearance: 'textfield',
              }}
            />
            <button
              type="button"
              onClick={() => bumpRun(1)}
              disabled={!canEdit}
              style={miniStepBtn(!canEdit)}
            >
              <Plus size={11} />
            </button>
          </>
        )}
      </div>

      {/* Variable add-on row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: '#ffffff',
          border: '1px solid var(--color-border)',
          borderRadius: 7,
          padding: '3px 6px',
          height: 30,
        }}
        title="Variable top-ups for the rest of the day. Add as new demand comes in."
      >
        <span style={{ width: 11, flexShrink: 0 }} />
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            minWidth: 18,
          }}
        >
          Var
        </span>
        <button
          type="button"
          onClick={() => bumpVar(-1)}
          disabled={!canEdit || variablePlanned === 0}
          style={miniStepBtn(!canEdit || variablePlanned === 0)}
        >
          <Minus size={11} />
        </button>
        <input
          type="number"
          value={variablePlanned}
          disabled={!canEdit}
          onChange={e => onSetVariable(Number(e.target.value) || 0)}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            color: variablePlanned > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
            padding: 0,
            margin: 0,
            width: 28,
            appearance: 'textfield',
            MozAppearance: 'textfield',
          }}
        />
        <button
          type="button"
          onClick={() => bumpVar(1)}
          disabled={!canEdit}
          style={miniStepBtn(!canEdit)}
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Helper / total row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          paddingLeft: 4,
          paddingRight: 4,
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
          title={`Run ${runPlanned} + Var ${variablePlanned} · Quinn forecast ${quinnProposed}`}
        >
          = {total} today
        </span>
        {isComponent && assemblyShort ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--color-error)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title={`Assemblies need ${assemblyDemandUnits} — currently short`}
          >
            need {assemblyDemandUnits}
            {canEdit && (
              <button
                type="button"
                onClick={onAbsorb}
                style={{
                  padding: '2px 6px',
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--color-error)',
                  background: '#ffffff',
                  border: '1px solid var(--color-error-border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Cover
              </button>
            )}
          </span>
        ) : isOverridden && canEdit ? (
          <button
            type="button"
            aria-label="Reset to Quinn"
            onClick={onResetToQuinn}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9,
              fontWeight: 600,
            }}
            title="Reset to Quinn's proposal"
          >
            <RotateCcw size={9} /> reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Both step button helpers delegate to the shared QtyStepper sizing so
// every stepper across the production app — rejects, adhoc, spoke order,
// PCR, and these embedded planner controls — match pixel-for-pixel.
//
//   - stepBtn      → emphasized (32×32, icon 14)  — main planner / per-drop
//   - miniStepBtn  → compact    (22×22, icon 11)  — embedded run/var rows
function miniStepBtn(disabled: boolean): React.CSSProperties {
  return getStepperButtonStyle('compact', disabled);
}

function stepBtn(disabled: boolean): React.CSSProperties {
  return getStepperButtonStyle('emphasized', disabled);
}

// ─── Shortfalls modal ────────────────────────────────────────────────────────
// Opened from the header chip when one or more component recipes have
// downstream assembly demand exceeding the current plan. For each shortfall
// row we surface: the gap, every parent assembly creating the demand, and
// a CTA to drop into the row's editor with a pulse highlight.
function ShortfallsModal({
  lines,
  onClose,
  onOpenRow,
}: {
  lines: PlanLine[];
  onClose: () => void;
  onOpenRow: (itemId: string) => void;
}) {
  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      <motion.div
        key="shortfalls-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12, 20, 44, 0.55)',
          zIndex: 1300,
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1301,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          pointerEvents: 'none',
        }}
      >
        <motion.div
          key="shortfalls-card"
          role="dialog"
          aria-label="Component shortfalls"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          style={{
            width: 'min(720px, 100%)',
            maxHeight: 'calc(100vh - 32px)',
            overflow: 'hidden',
            borderRadius: 'var(--radius-card)',
            background: '#ffffff',
            boxShadow: '0 24px 64px rgba(12,20,44,0.32)',
            fontFamily: 'var(--font-primary)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--color-error-light)',
                color: 'var(--color-error)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={15} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {lines.length} component shortfall{lines.length === 1 ? '' : 's'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Assemblies need more of these components than the current plan covers.
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: '#ffffff',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div
            style={{
              padding: 14,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {lines.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: 'var(--color-success-light)',
                  border: '1px solid var(--color-success-border)',
                  color: 'var(--color-success)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                All components covered.
              </div>
            ) : (
              lines.map(line => (
                <ShortfallRow
                  key={line.item.id}
                  line={line}
                  onOpenRow={() => onOpenRow(line.item.id)}
                />
              ))
            )}
          </div>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

function ShortfallRow({
  line,
  onOpenRow,
}: {
  line: PlanLine;
  onOpenRow: () => void;
}) {
  const need = line.assemblyDemand.totalUnits;
  const planned = line.planned;
  const shortBy = Math.max(0, need - planned);
  const sources = line.assemblyDemand.sources;

  return (
    <div
      style={{
        border: '1px solid var(--color-error-border)',
        borderRadius: 10,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--color-error-light)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {line.recipe.name}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {line.recipe.category}
            {line.primaryBench ? ` · ${line.primaryBench.name}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Metric label="Plan" value={planned} />
          <Metric label="Need" value={need} tone="error" />
          <Metric label="Short" value={shortBy} tone="error" emphasis />
        </div>
        <button
          type="button"
          onClick={onOpenRow}
          style={{
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--color-accent-active)',
            background: 'var(--color-accent-active)',
            color: 'var(--color-text-on-active)',
            fontFamily: 'var(--font-primary)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Open row <ArrowRight size={12} />
        </button>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Demand from
        </span>
        {sources.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            No active assembly sources.
          </span>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sources.map((s, i) => {
              const parentRecipe = getRecipe(s.parentRecipeId);
              const parentName = parentRecipe?.name ?? s.parentRecipeId;
              return (
                <li
                  key={`${s.parentItem.id}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--color-bg-subtle, #f7f8fb)',
                    fontSize: 11,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <Layers size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                    {parentName}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
                    plan {s.parentPlannedQty} × {s.quantityPerUnit}
                    {s.unit ? ` ${s.unit}` : ''}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: 'var(--color-error)',
                      minWidth: 56,
                      textAlign: 'right',
                    }}
                  >
                    +{s.contributedUnits}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
  emphasis = false,
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'error';
  emphasis?: boolean;
}) {
  const color =
    tone === 'error'
      ? 'var(--color-error)'
      : 'var(--color-text-primary)';
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        padding: '4px 8px',
        borderRadius: 6,
        background: emphasis ? 'rgba(220,38,38,0.12)' : 'transparent',
        minWidth: 46,
      }}
    >
      <span
        style={{
          fontSize: 8.5,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</span>
    </div>
  );
}
