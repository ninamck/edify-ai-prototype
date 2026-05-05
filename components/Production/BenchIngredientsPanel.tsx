'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Box, ChevronDown, ChevronRight, Download, Waves } from 'lucide-react';
import { usePlan, FILLING_TRAY_GRAMS, type PlanLine } from './PlanStore';
import { getBench, getRecipe, type SiteId } from './fixtures';
import { hhmmToMinutes, minutesToHHMM } from './time';
import { downloadBenchSummaryPdf } from '@/lib/pdf/productionPdfs';

type Props = {
  siteId: SiteId;
  date: string;
  benchId: string | null;
  onClose: () => void;
};

type ComponentDemand = {
  recipeId: string;
  name: string;
  /** Aggregated quantity in the natural unit (units OR grams). */
  totalQty: number;
  unit: 'unit' | 'g';
  /** Tray equivalent if the unit is grams (uses 4kg tray rule). */
  trayCount?: number;
  /** Which recipes on this bench drive this demand. */
  drivers: Array<{ parentName: string; parentQty: number; perUnit: number; perUnitLabel: string }>;
};

/**
 * Pre-computed cadence breakdown for one increment recipe — every drop time,
 * batch size, totals — so the timeline strip can render a row without
 * re-walking the cadence on each paint.
 */
type DropsRow = {
  line: PlanLine;
  intervalMinutes: number;
  startMins: number;
  endMins: number;
  dropsCount: number;
  dropTimes: number[];
  batchSize: number;
  totalUnits: number;
};

type DropsTimelineData = {
  rows: DropsRow[];
  /** Shared X-axis bounds, in minutes-since-midnight. Snapped to the hour. */
  axisStart: number;
  axisEnd: number;
  totalDrops: number;
  totalUnits: number;
};

/**
 * Right-side drawer that opens when a bench card is clicked. Aggregates the
 * component demand across every recipe planned on that bench so the bench
 * owner can see the totals they'll need to stage (e.g. "12 trays of chicken
 * filling"). Falls back to a recipe list when none of the recipes are
 * assemblies.
 */
export default function BenchIngredientsPanel({ siteId, date, benchId, onClose }: Props) {
  const lines = usePlan(siteId, date);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!benchId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [benchId, onClose]);

  // Reset expansion state whenever the user opens a different bench so it
  // doesn't carry stale state across drawers.
  useEffect(() => {
    setExpanded(new Set());
  }, [benchId]);

  function toggleExpand(itemId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const data = useMemo(() => {
    if (!benchId) return null;
    const bench = getBench(benchId);
    if (!bench) return null;

    const benchLines = lines.filter(l => l.primaryBench?.id === benchId && l.effectivePlanned > 0);

    // Roll up component demand from every assembly recipe on this bench.
    const demands = new Map<string, ComponentDemand>();
    for (const line of benchLines) {
      const subs = line.recipe.subRecipes;
      if (!subs || subs.length === 0) continue;
      for (const sub of subs) {
        const subRecipe = getRecipe(sub.recipeId);
        if (!subRecipe) continue;
        const unit: 'unit' | 'g' = sub.unit === 'unit' ? 'unit' : 'g';
        const qty = sub.quantityPerUnit * line.effectivePlanned;
        const existing = demands.get(sub.recipeId);
        const driver = {
          parentName: line.recipe.name,
          parentQty: line.effectivePlanned,
          perUnit: sub.quantityPerUnit,
          perUnitLabel: sub.unit === 'unit' ? '' : sub.unit,
        };
        if (existing) {
          existing.totalQty += qty;
          existing.drivers.push(driver);
        } else {
          demands.set(sub.recipeId, {
            recipeId: sub.recipeId,
            name: subRecipe.name,
            totalQty: qty,
            unit,
            drivers: [driver],
          });
        }
      }
    }
    // Compute tray equivalents for gram-based components.
    for (const d of demands.values()) {
      if (d.unit === 'g') {
        d.trayCount = Math.ceil(d.totalQty / FILLING_TRAY_GRAMS);
      }
    }

    const componentRollup = Array.from(demands.values()).sort((a, b) => b.totalQty - a.totalQty);
    const recipeRows = benchLines
      .slice()
      .sort((a, b) => b.effectivePlanned - a.effectivePlanned);

    // Drops timeline — only meaningful for benches running increment recipes.
    // We treat any line whose item has a cadence as a drops row regardless of
    // bench primaryMode so a "mixed" bench still surfaces its drops view.
    const incrementLines = benchLines.filter(l => l.item.mode === 'increment' && l.item.cadence);
    const drops: DropsTimelineData | null = (() => {
      if (incrementLines.length === 0) return null;
      const rows: DropsRow[] = incrementLines.map(line => {
        const c = line.item.cadence!;
        const startMins = hhmmToMinutes(c.startTime);
        const endMins = hhmmToMinutes(c.endTime);
        const dropsCount = Math.max(1, Math.floor((endMins - startMins) / c.intervalMinutes) + 1);
        const dropTimes: number[] = [];
        for (let i = 0; i < dropsCount; i++) dropTimes.push(startMins + i * c.intervalMinutes);
        const batchSize = line.item.batchSize ?? 1;
        return {
          line,
          intervalMinutes: c.intervalMinutes,
          startMins,
          endMins,
          dropsCount,
          dropTimes,
          batchSize,
          totalUnits: dropsCount * batchSize,
        };
      });
      rows.sort((a, b) => a.startMins - b.startMins || a.intervalMinutes - b.intervalMinutes);

      // Shared axis: clamp to the union of cadence windows, padded to the
      // nearest hour and bounded to a sensible 05:00–19:00 demo envelope so
      // the strip never gets ridiculously wide.
      const minStart = Math.min(...rows.map(r => r.startMins));
      const maxEnd   = Math.max(...rows.map(r => r.endMins));
      const axisStart = Math.max(5 * 60,  Math.floor(minStart / 60) * 60);
      const axisEnd   = Math.min(19 * 60, Math.ceil(maxEnd   / 60) * 60);
      const totalDrops = rows.reduce((sum, r) => sum + r.dropsCount, 0);
      const totalUnits = rows.reduce((sum, r) => sum + r.totalUnits, 0);
      return { rows, axisStart, axisEnd, totalDrops, totalUnits };
    })();

    return { bench, recipeRows, componentRollup, drops };
  }, [lines, benchId]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {benchId && data && (
        <>
          <motion.div
            key="bench-ing-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(12, 20, 44, 0.35)',
              zIndex: 1200,
            }}
          />
          <motion.aside
            key="bench-ing-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(520px, 100vw)',
              zIndex: 1201,
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              boxShadow: '-8px 0 32px rgba(12,20,44,0.18)',
              fontFamily: 'var(--font-primary)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <header
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 2,
                  }}
                >
                  Bench
                </div>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {data.bench.name}
                </h2>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    marginTop: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {data.bench.capabilities.join(' · ')}
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() =>
                    benchId &&
                    downloadBenchSummaryPdf({ siteId, date, benchId, lines })
                  }
                  aria-label="Download bench summary PDF"
                  title="Download bench summary PDF"
                  style={{
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid var(--color-border-subtle)',
                    background: '#ffffff',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-primary)',
                  }}
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close bench detail"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid var(--color-border-subtle)',
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
            </header>

            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 22,
              }}
            >
              {/* Drops timeline — only renders when this bench has at least
                  one increment recipe. Lays every cadence on a shared axis so
                  the manager can see how the bench breaks the day into drops. */}
              {data.drops && (
                <DropsTimelineSection drops={data.drops} />
              )}

              {/* Component rollup */}
              <section>
                <SectionHeader
                  icon={<Layers size={12} />}
                  title="Components needed"
                  caption={
                    data.componentRollup.length === 0
                      ? 'None of these recipes pull from sub-recipes.'
                      : `Aggregated across ${data.recipeRows.length} recipe${data.recipeRows.length === 1 ? '' : 's'} on this bench.`
                  }
                />
                {data.componentRollup.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    {data.componentRollup.map(d => (
                      <ComponentRow key={d.recipeId} demand={d} />
                    ))}
                  </div>
                )}
              </section>

              {/* Recipes on bench */}
              <section>
                <SectionHeader
                  icon={<Box size={12} />}
                  title="Recipes on this bench"
                  caption={`${data.recipeRows.length} recipe${data.recipeRows.length === 1 ? '' : 's'} planned for the day. Tap a recipe to see its component breakdown.`}
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 10,
                  }}
                >
                  {data.recipeRows.map(line => {
                    const isOpen = expanded.has(line.item.id);
                    const subs = line.recipe.subRecipes ?? [];
                    const hasBreakdown = subs.length > 0;
                    return (
                      <div
                        key={line.item.id}
                        style={{
                          borderRadius: 8,
                          background: '#ffffff',
                          border: '1px solid var(--color-border-subtle)',
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleExpand(line.item.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px 8px 8px',
                            background: 'var(--color-bg-hover)',
                            border: 'none',
                            cursor: 'pointer',
                            gap: 10,
                            fontFamily: 'var(--font-primary)',
                            textAlign: 'left',
                          }}
                          aria-expanded={isOpen}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              minWidth: 0,
                              overflow: 'hidden',
                            }}
                          >
                            {isOpen ? (
                              <ChevronDown size={14} color="var(--color-text-muted)" />
                            ) : (
                              <ChevronRight size={14} color="var(--color-text-muted)" />
                            )}
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--color-text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {line.recipe.name}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--color-text-primary)',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {line.effectivePlanned}
                          </span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '8px 12px 10px 28px' }}>
                            {hasBreakdown ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto auto',
                                    gap: 10,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    paddingBottom: 4,
                                    borderBottom: '1px solid var(--color-border-subtle)',
                                  }}
                                >
                                  <span>Component</span>
                                  <span style={{ textAlign: 'right' }}>Per unit</span>
                                  <span style={{ textAlign: 'right' }}>Total</span>
                                </div>
                                {subs.map((sub, i) => {
                                  const subRecipe = getRecipe(sub.recipeId);
                                  const total = sub.quantityPerUnit * line.effectivePlanned;
                                  const unitLabel = sub.unit === 'unit' ? '' : sub.unit;
                                  const totalLabel =
                                    sub.unit === 'unit'
                                      ? `${total} units`
                                      : `${(total / 1000).toFixed(1)} kg · ${Math.ceil(total / FILLING_TRAY_GRAMS)} tray${
                                          Math.ceil(total / FILLING_TRAY_GRAMS) === 1 ? '' : 's'
                                        }`;
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto auto',
                                        gap: 10,
                                        fontSize: 11,
                                        color: 'var(--color-text-secondary)',
                                        padding: '4px 0',
                                        alignItems: 'baseline',
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color: 'var(--color-text-primary)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {subRecipe?.name ?? sub.recipeId}
                                      </span>
                                      <span
                                        style={{
                                          fontVariantNumeric: 'tabular-nums',
                                          color: 'var(--color-text-muted)',
                                        }}
                                      >
                                        {sub.quantityPerUnit}
                                        {unitLabel}/ea
                                      </span>
                                      <span
                                        style={{
                                          fontVariantNumeric: 'tabular-nums',
                                          fontWeight: 700,
                                          color: 'var(--color-text-primary)',
                                        }}
                                      >
                                        {totalLabel}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: 'var(--color-text-muted)',
                                  fontStyle: 'italic',
                                }}
                              >
                                No component breakdown — produced from raw ingredients (not modelled in this prototype).
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Drops timeline — bench-level cadence visualisation.
 *
 * One row per increment recipe, all sharing a single time axis snapped to the
 * hour. Drops are rendered as small ticks on the strip; the start and end of
 * each row's cadence window is shaded so the eye reads the live shoulder
 * (e.g. soups only kick in at 11:00) without having to read times.
 *
 * Sized in pixels rather than %-based so dense rows (toasties every 30min)
 * stay readable when the drawer is narrow.
 */
function DropsTimelineSection({ drops }: { drops: DropsTimelineData }) {
  const { rows, axisStart, axisEnd, totalDrops, totalUnits } = drops;
  const PX_PER_MIN = 1.4;
  const stripWidth = (axisEnd - axisStart) * PX_PER_MIN;
  const hours: number[] = [];
  for (let h = axisStart; h <= axisEnd; h += 60) hours.push(h);

  return (
    <section>
      <SectionHeader
        icon={<Waves size={12} />}
        title="Drops timeline"
        caption={
          `${rows.length} recipe${rows.length === 1 ? '' : 's'} · ` +
          `${totalDrops} drops · ${totalUnits} units across ` +
          `${minutesToHHMM(axisStart)}–${minutesToHHMM(axisEnd)}`
        }
      />
      <div
        style={{
          marginTop: 10,
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 8,
          background: '#ffffff',
          overflowX: 'auto',
        }}
      >
        <div style={{ minWidth: 200 + stripWidth + 16, paddingBottom: 4 }}>
          {/* Hour ruler */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              padding: '8px 8px 4px 200px',
              borderBottom: '1px solid var(--color-border-subtle)',
              position: 'relative',
              height: 26,
            }}
          >
            <div style={{ position: 'relative', width: stripWidth, height: '100%' }}>
              {hours.map(h => (
                <span
                  key={h}
                  style={{
                    position: 'absolute',
                    left: (h - axisStart) * PX_PER_MIN,
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {minutesToHHMM(h)}
                </span>
              ))}
            </div>
          </div>

          {/* Per-recipe rows */}
          {rows.map((row, idx) => (
            <DropsTimelineRow
              key={row.line.item.id}
              row={row}
              axisStart={axisStart}
              axisEnd={axisEnd}
              pxPerMin={PX_PER_MIN}
              stripWidth={stripWidth}
              hours={hours}
              isLast={idx === rows.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DropsTimelineRow({
  row,
  axisStart,
  axisEnd,
  pxPerMin,
  stripWidth,
  hours,
  isLast,
}: {
  row: DropsRow;
  axisStart: number;
  axisEnd: number;
  pxPerMin: number;
  stripWidth: number;
  hours: number[];
  isLast: boolean;
}) {
  // Within the shared axis, this row is "active" between its cadence start
  // and end. We shade that range so the off-window time reads as background
  // rather than as a candidate slot.
  const activeLeft  = (Math.max(axisStart, row.startMins) - axisStart) * pxPerMin;
  const activeRight = (Math.min(axisEnd,   row.endMins)   - axisStart) * pxPerMin;
  const activeWidth = Math.max(2, activeRight - activeLeft);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 8px 10px 10px',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
        gap: 8,
      }}
    >
      {/* Recipe name + cadence summary (fixed left column) */}
      <div
        style={{
          width: 184,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={row.line.recipe.name}
        >
          {row.line.recipe.name}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          every {row.intervalMinutes}min · {row.dropsCount}×{row.batchSize} = {row.totalUnits}
        </span>
      </div>

      {/* Strip with hour gridlines, active band, and drop ticks */}
      <div
        style={{
          position: 'relative',
          width: stripWidth,
          height: 26,
          flexShrink: 0,
        }}
      >
        {/* Hour gridlines */}
        {hours.map(h => (
          <span
            key={h}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: (h - axisStart) * pxPerMin,
              width: 1,
              background: 'var(--color-border-subtle)',
            }}
          />
        ))}
        {/* Active cadence band — subtle fill so the row reads as "live here" */}
        <span
          style={{
            position: 'absolute',
            top: 9,
            height: 8,
            left: activeLeft,
            width: activeWidth,
            background: 'var(--color-bg-hover)',
            borderRadius: 4,
          }}
        />
        {/* Drop ticks */}
        {row.dropTimes.map((t, i) => {
          const x = (t - axisStart) * pxPerMin;
          return (
            <span
              key={i}
              title={`${minutesToHHMM(t)} · ${row.batchSize} units`}
              style={{
                position: 'absolute',
                top: 7,
                left: x - 5,
                width: 10,
                height: 12,
                borderRadius: 3,
                background: 'var(--color-accent-active)',
                boxShadow: '0 1px 2px rgba(12,20,44,0.18)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  caption,
  icon,
}: {
  title: string;
  caption: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {icon}
        {title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{caption}</div>
    </div>
  );
}

function ComponentRow({ demand }: { demand: ComponentDemand }) {
  const totalLabel =
    demand.unit === 'unit'
      ? `${demand.totalQty} units`
      : `${(demand.totalQty / 1000).toFixed(1)} kg${
          demand.trayCount != null ? ` · ${demand.trayCount} tray${demand.trayCount === 1 ? '' : 's'}` : ''
        }`;
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--color-border-subtle)',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {demand.name}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {totalLabel}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {demand.drivers.map((d, i) => (
          <span key={i} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {d.parentName} · {d.parentQty} × {d.perUnit}
            {d.perUnitLabel ? d.perUnitLabel : ''}/ea
          </span>
        ))}
      </div>
    </div>
  );
}
