'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Box, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { usePlan, FILLING_TRAY_GRAMS } from './PlanStore';
import { getBench, getRecipe, type SiteId } from './fixtures';
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

    return { bench, recipeRows, componentRollup };
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
