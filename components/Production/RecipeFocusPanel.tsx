'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Calculator,
  ChefHat,
  Package,
  Truck,
  Users,
  X,
} from 'lucide-react';
import EdifyMark from '@/components/EdifyMark/EdifyMark';
import {
  getProductionItem,
  getRecipe,
  getSite,
  forecastFor,
  carryOverFor,
  recipeIngredientPrep,
  primaryBenchForItem,
  linkedReceiversFor,
  submissionsForHub,
  type IngredientShortfallSeed,
  type SiteId,
  type ProductionItemId,
  type Site,
} from './fixtures';
import { productionSiteLabel } from './productionSiteOptions';
import { usePlan } from './PlanStore';
import StatusPill from './StatusPill';
import {
  computeProRataCut,
  useIngredientShortfallStore,
  useShortfallInputs,
  useShortfallStatus,
  type AppliedIngredientShortfall,
} from './ingredientShortfallStore';

/**
 * Per-recipe focus panel — opens as a side drawer when a row is tapped on
 * the recipe-first grid.
 *
 * This panel replaces the dense Bench Summary / Ingredient Summary
 * dropdowns. Same content, but scoped to *one* recipe — no cross-recipe
 * noise. Sections (in order of importance for a manager glance):
 *
 *   1. Header           — recipe name, mode, plan totals
 *   2. VP math          — Forecast / Carry-over / Quinn / Final, per recipe
 *   3. Bench + prep     — primary bench, prep stages
 *   4. Ingredients      — full rollup for THIS recipe (Pret pain point fix)
 *   5. Per-spoke split  — for HUBs only — how the planned bake is allocated
 */
export type RecipeFocusPanelProps = {
  siteId: SiteId;
  date: string;
  itemId: ProductionItemId | null;
  onClose: () => void;
};

export default function RecipeFocusPanel({
  siteId,
  date,
  itemId,
  onClose,
}: RecipeFocusPanelProps) {
  // Close on escape so the drawer feels like a proper modal layer.
  useEffect(() => {
    if (!itemId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [itemId, onClose]);

  // Pull the live plan so the focus panel always reflects current overrides.
  // We resolve the panel's row by item id from the same dataset the grid uses.
  const lines = usePlan(siteId, date);
  const line = useMemo(
    () => (itemId ? lines.find(l => l.item.id === itemId) ?? null : null),
    [lines, itemId],
  );

  if (!itemId) return null;

  // Defensive null path: if the item id has gone stale, render an empty
  // sheet rather than nothing — gives the user a clear "close me" affordance.
  const item = getProductionItem(itemId);
  const recipe = item ? getRecipe(item.recipeId) : null;
  const site = getSite(siteId);

  // Portal to <body> so the drawer escapes the production layout's
  // page-body wrapper, which sets `position: relative; z-index: 1` and
  // would otherwise trap this fixed panel beneath the sticky sub-tab nav
  // (z-index 150 in the parent stacking context). Mirrors PlanFocusPanel.
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(15, 23, 32, 0.18)',
      }}
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-label={recipe ? `${recipe.name} details` : 'Recipe details'}
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(520px, 100vw)',
          height: '100%',
          background: '#ffffff',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-12px 0 36px rgba(10, 20, 25, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
          overflow: 'hidden',
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            background: 'var(--color-bg-surface)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              Focus · {recipe?.category ?? ''}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
              }}
            >
              {recipe?.name ?? 'Unknown recipe'}
            </h2>
            {item && recipe && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusPill
                  tone={item.mode === 'run' ? 'info' : item.mode === 'variable' ? 'warning' : 'success'}
                  label={modeLabel(item.mode)}
                  size="xs"
                />
                {recipe.shelfLifeMinutes != null && (
                  <StatusPill
                    tone="neutral"
                    label={`${Math.round(recipe.shelfLifeMinutes / 60)}h shelf`}
                    size="xs"
                  />
                )}
                {recipe.batchRules?.multipleOf && recipe.batchRules.multipleOf > 1 && (
                  <StatusPill
                    tone="neutral"
                    label={`steps of ${recipe.batchRules.multipleOf}`}
                    size="xs"
                  />
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid var(--color-border-subtle)',
              background: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '16px 18px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* 0. Ingredient shortfall (HUB only) — sits at the top so the
              manager sees the constraint before reading VP math. The
              section auto-hides when there's no seeded shortfall, so the
              drawer stays clean for unaffected recipes. */}
          {site?.type === 'HUB' && recipe && (
            <IngredientShortfallSection
              hubId={siteId}
              recipeId={recipe.id}
              skuId={recipe.skuId}
              forDate={date}
            />
          )}

          {/* 1. VP math — per recipe. Replaces live Edify's nine-column-wide
              math row with one focused breakdown for the recipe in hand. */}
          {item && recipe && (
            <VPMathSection
              siteId={siteId}
              date={date}
              skuId={recipe.skuId}
              line={line}
            />
          )}

          {/* 2. Bench + prep stages — where this recipe gets made and the
              workflow steps that lead up to it. */}
          {item && (
            <BenchSection itemId={item.id} />
          )}

          {/* 3. Ingredients — Pret pain point. Used to require flipping to
              the Ingredient Summary surface; now sits inside the focus
              panel for *this* recipe only. */}
          {recipe && <IngredientsSection recipeId={recipe.id} />}

          {/* 4. Per-spoke breakdown (HUB only) — how this recipe's bake is
              allocated across the spokes that ordered it today. */}
          {site?.type === 'HUB' && recipe && (
            <PerSpokeSection siteId={siteId} skuId={recipe.skuId} date={date} site={site} />
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────────

function VPMathSection({
  siteId,
  date,
  skuId,
  line,
}: {
  siteId: SiteId;
  date: string;
  skuId: string;
  line: ReturnType<typeof usePlan>[number] | null;
}) {
  const forecast = forecastFor(siteId, skuId, date);
  const carryOver = carryOverFor(siteId, skuId);
  const projected = forecast?.projectedUnits ?? 0;
  const carried = carryOver?.carriedUnits ?? 0;
  const quinnProposed = Math.max(0, projected - carried);
  const planned = line?.planned ?? quinnProposed;
  const variablePlanned = line?.variablePlanned ?? 0;
  const runPlanned = line?.runPlanned ?? 0;

  return (
    <Section icon={<Calculator size={14} />} title="Production math">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        <Ledger label="Forecast (today)" value={projected} />
        <Ledger
          label="Carry-over (yesterday)"
          value={-carried}
          hint={carryOver?.reason}
        />
        <Divider />
        <Ledger label="Edify proposes" value={quinnProposed} bold quinn />
        {line && line.item.mode === 'run' && (
          <>
            <Ledger label="Run baseline" value={runPlanned} muted />
            <Ledger
              label="Variable additions (VP)"
              value={variablePlanned}
              muted
            />
          </>
        )}
        {line && (
          <>
            <Divider />
            <Ledger label="Final plan" value={planned} bold />
          </>
        )}
        {forecast?.signals && forecast.signals.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {forecast.signals.slice(0, 3).map((s, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  gap: 6,
                }}
              >
                <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>·</span>
                <span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{s.signal}</strong>
                  {s.note ? ` — ${s.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function BenchSection({ itemId }: { itemId: ProductionItemId }) {
  const item = getProductionItem(itemId);
  if (!item) return null;
  const bench = primaryBenchForItem(item);
  return (
    <Section icon={<ChefHat size={14} />} title="Bench & schedule">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        <Pair
          label="Primary bench"
          value={bench?.name ?? 'Unassigned'}
        />
        <Pair label="Mode" value={modeLabel(item.mode)} />
        <Pair label="Default batch size" value={`${item.batchSize} units`} />
        {item.targetMinutes && (
          <Pair
            label="Target time"
            value={`${item.targetMinutes} min / batch`}
          />
        )}
        {item.cadence && (
          <Pair
            label="Drop cadence"
            value={`Every ${item.cadence.intervalMinutes} min, ${item.cadence.startTime}–${item.cadence.endTime}`}
          />
        )}
      </div>
    </Section>
  );
}

function IngredientsSection({ recipeId }: { recipeId: string }) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;
  const prep = recipeIngredientPrep(recipe);

  // Group ingredients by source recipe (own vs sub-recipe) so the manager
  // sees "your filling needs X, your dough needs Y" not a flat list.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof prep>();
    for (const p of prep) {
      const key = p.sourceRecipeId;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [prep]);

  return (
    <Section
      icon={<Package size={14} />}
      title="Ingredients"
      subtitle="What this recipe needs from stock — replaces the cross-recipe Ingredient Summary."
    >
      {grouped.length === 0 ? (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          No ingredient mapping recorded for this recipe yet.
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grouped.map(([sourceId, items]) => {
            const sourceRecipe = getRecipe(sourceId);
            const isSubRecipe = sourceId !== recipeId;
            return (
              <div
                key={sourceId}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  background: '#ffffff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {isSubRecipe
                      ? `From sub-recipe: ${sourceRecipe?.name ?? sourceId}`
                      : 'Own ingredients'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {items.map((p, i) => (
                    <div
                      key={`${p.ingredientId}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {p.ingredient?.name ?? p.ingredientId}
                      </span>
                      <span
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        {p.quantityPerUnit} {p.unit} / unit
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function PerSpokeSection({
  siteId,
  skuId,
  date,
  site,
}: {
  siteId: SiteId;
  skuId: string;
  date: string;
  site: Site;
}) {
  const spokes = useMemo(() => linkedReceiversFor(siteId), [siteId]);
  const submissions = useMemo(() => submissionsForHub(siteId, date), [siteId, date]);

  const rows = spokes.map(sp => {
    const sub = submissions.find(s => s.fromSiteId === sp.id);
    const ln = sub?.lines.find(l => l.skuId === skuId);
    const qty = ln ? ln.confirmedUnits ?? ln.quinnProposedUnits : 0;
    return { spoke: sp, qty, status: sub?.status };
  });

  const total = rows.reduce((a, r) => a + r.qty, 0);

  if (spokes.length === 0) return null;

  return (
    <Section
      icon={<Users size={14} />}
      title="Per-spoke allocation"
      subtitle={`How ${site.name}'s bake is split across ordering sites.`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div
            key={r.spoke.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 10px',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Truck size={12} color="var(--color-text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {productionSiteLabel(r.spoke.id) || r.spoke.name}
              </span>
              {r.status && (
                <StatusPill
                  tone={
                    r.status === 'acknowledged'
                      ? 'success'
                      : r.status === 'submitted'
                        ? 'info'
                        : r.status === 'auto-finalised'
                          ? 'neutral'
                          : 'warning'
                  }
                  label={r.status}
                  size="xs"
                />
              )}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: r.qty > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {r.qty}
            </span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 6,
            borderTop: '1px solid var(--color-border-subtle)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span>Total ordered by spokes</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{total}</span>
        </div>
      </div>
    </Section>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em' }}>
          {title}
        </h3>
      </div>
      {subtitle && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
      <div>{children}</div>
    </section>
  );
}

function Ledger({
  label,
  value,
  hint,
  bold = false,
  muted = false,
  quinn = false,
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
  muted?: boolean;
  quinn?: boolean;
}) {
  return (
    <div
      title={hint}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        fontSize: 12,
        color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
      }}
    >
      {quinn && <EdifyMark size={11} color="var(--color-info)" />}
      <span style={{ fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span
        style={{
          marginLeft: 'auto',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: bold ? 700 : 500,
        }}
      >
        {value > 0 ? `+${value}` : value === 0 ? '0' : value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        borderTop: '1px dashed var(--color-border-subtle)',
        margin: '4px 0',
      }}
    />
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        style={{
          color: 'var(--color-text-primary)',
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function modeLabel(mode: 'run' | 'variable' | 'increment'): string {
  if (mode === 'run') return 'Run (P-slots)';
  if (mode === 'variable') return 'Variable (VP)';
  return 'Hot Production';
}

// ─── Ingredient shortfall section ─────────────────────────────────────────────

/**
 * Shows the ingredient-shortage constraint for a recipe (when one
 * exists at the seeded fixture) and offers the manager a single,
 * unambiguous CTA to pro-rata-cut spoke allocations down to fit
 * under the available cap.
 *
 * Single-CTA on purpose:
 *   - The user explicitly asked for "click the add and it pro-ratas
 *     the amount down" — no modal, no strategy picker. Keeps the
 *     decision surface a one-tap action.
 *   - The pro-rata math is deterministic (`computeProRataCut`) so a
 *     preview of the per-spoke split sits inside the section before
 *     the manager commits, mitigating the lack of a confirm dialog.
 *
 * Once applied, the same section renders the per-spoke breakdown of
 * the recorded cut + an Undo affordance, matching the lifecycle
 * shape used by `hubUnlockStore`.
 */
function IngredientShortfallSection({
  hubId,
  recipeId,
  skuId,
  forDate,
}: {
  hubId: SiteId;
  recipeId: string;
  skuId: string;
  forDate: string;
}) {
  const status = useShortfallStatus(hubId, recipeId, forDate);
  const inputs = useShortfallInputs(hubId, skuId, forDate);
  const { apply, undo } = useIngredientShortfallStore();

  if (status.kind === 'none') return null;

  const { seed } = status;
  // Preview the per-spoke split so the manager can see who absorbs
  // what before they commit. When the cut is applied the saved record
  // wins — that way a manager who tweaks order quantities on another
  // surface mid-flow still sees the historic split they signed off on,
  // not a recomputed one.
  const previewLines =
    status.kind === 'applied'
      ? status.record.lines
      : computeProRataCut(inputs, seed.availableUnits);

  const totalRequested = previewLines.reduce((acc, l) => acc + l.requestedUnits, 0);
  const totalAllocated = previewLines.reduce((acc, l) => acc + l.allocatedUnits, 0);
  const totalCut = totalRequested - totalAllocated;

  const isApplied = status.kind === 'applied';
  const tone = seed.tone === 'error' ? 'var(--color-error)' : 'var(--color-warning)';
  const accent = isApplied ? 'var(--color-info)' : tone;

  return (
    <Section
      icon={<AlertTriangle size={14} color={accent} />}
      title="Ingredient shortfall"
      subtitle={seed.detail}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 12,
          borderRadius: 'var(--radius-card)',
          border: `1px solid ${accent}`,
          background: 'transparent',
        }}
      >
        {/* Headline numbers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Pair label="Bottleneck" value={seed.bottleneckIngredient} />
          <Pair label="Total requested" value={String(totalRequested)} />
          <Pair label="Capacity (cap)" value={String(seed.availableUnits)} />
          <Pair
            label={isApplied ? 'Cut applied' : 'Cut needed'}
            value={`-${totalCut}`}
          />
        </div>

        {/* Per-spoke preview / committed split */}
        {previewLines.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              paddingTop: 8,
              borderTop: '1px dashed var(--color-border-subtle)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
              }}
            >
              {isApplied ? 'Committed split' : 'Suggested pro-rata split'}
            </div>
            {previewLines.map(line => {
              const spoke = getSite(line.spokeId);
              const cut = line.cutUnits;
              return (
                <div
                  key={line.spokeId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 8,
                    fontSize: 12,
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {spoke?.name ?? line.spokeId}
                  </span>
                  <span
                    style={{
                      color: 'var(--color-text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: 48,
                      textAlign: 'right',
                    }}
                  >
                    {line.requestedUnits} → {line.allocatedUnits}
                  </span>
                  <span
                    style={{
                      color: cut > 0 ? tone : 'var(--color-text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: cut > 0 ? 700 : 500,
                      minWidth: 28,
                      textAlign: 'right',
                    }}
                  >
                    {cut > 0 ? `-${cut}` : '0'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Action — single CTA. Open → Apply, Applied → Undo. The
            spoke-side nudge / banner fires off `apply()`, so the
            committed state is the source of truth across surfaces. */}
        {!isApplied ? (
          <button
            type="button"
            onClick={() =>
              apply({
                seedId: seed.id,
                hubId,
                recipeId,
                skuId,
                forDate,
                availableUnits: seed.availableUnits,
                inputs,
              })
            }
            disabled={inputs.length === 0}
            title={
              inputs.length === 0
                ? 'No spoke orders to pro-rate against.'
                : `Trim each spoke's allocation in proportion to their ask, capping the bake at ${seed.availableUnits} units.`
            }
            style={{
              alignSelf: 'flex-end',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--radius-item)',
              border: `1px solid ${tone}`,
              background: tone,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              cursor: inputs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: inputs.length === 0 ? 0.6 : 1,
            }}
          >
            <AlertTriangle size={12} strokeWidth={2.4} />
            Adjust to capacity (pro-rata)
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
              }}
            >
              Spokes have been notified.
            </span>
            <button
              type="button"
              onClick={() => undo(hubId, recipeId, forDate)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-item)',
                border: '1px solid var(--color-border)',
                background: '#fff',
                color: 'var(--color-text-secondary)',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
              }}
            >
              Undo cut
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}
