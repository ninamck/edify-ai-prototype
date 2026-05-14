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
  UtensilsCrossed,
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
  effectiveSubmissionsForHub,
  type IngredientShortfallSeed,
  type SiteId,
  type ProductionItemId,
  type Site,
} from './fixtures';
import { productionSiteLabel } from './productionSiteOptions';
import { usePlan, usePlanStore } from './PlanStore';
import { useHubExtras } from './hubExtrasStore';
import { useHubOverrides } from './hubOverrideStore';
import StatusPill from './StatusPill';
import QtyStepper from './QtyStepper';
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
          {/* 0. Team food — top-of-drawer editing affordance. Always
              shown (even when zero) on make rows so the GM has a single,
              discoverable place to dial staff lunch units up or down.
              The section header says explicitly that these units are
              additive to the bake but never counted as sold, so a manager
              can't accidentally read them as a sales lift. */}
          {item && line && recipe && (
            <TeamFoodSection
              line={line}
              recipeName={recipe.name}
              date={date}
              siteId={siteId}
              skuId={recipe.skuId}
            />
          )}

          {/* 1. Ingredient shortfall (HUB only) — sits below team food so
              the constraint reads as the next thing after the editing
              affordance. Auto-hides when there's no seeded shortfall,
              so the drawer stays clean for unaffected recipes. */}
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
              isHub={site?.type === 'HUB'}
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

/**
 * Top-of-drawer team-food editor. Replaces the inline mini-stepper that
 * used to sit in the matrix's recipe-name cell — moving it into the
 * drawer keeps the table dense (so the row is just "what's the plan")
 * while giving the editing affordance more breathing room (a labelled
 * stepper + an explicit "what does this number mean for sales?"
 * subtitle, so the GM never has to guess whether bumping it inflates
 * the sales-vs-forecast read).
 *
 * Stepper sizing: `default` (28px buttons) — bigger than the old
 * compact mini-stepper, sized to match the drawer's other ledgers
 * without dominating the section.
 */
function TeamFoodSection({
  line,
  recipeName,
  date,
  siteId,
  skuId,
}: {
  line: ReturnType<typeof usePlan>[number];
  recipeName: string;
  date: string;
  siteId: SiteId;
  skuId: string;
}) {
  const { setTeamFoodPlan } = usePlanStore();
  const { getExtras } = useHubExtras();
  const value = line.teamFoodPlanned;
  // Pull hub-side extras so the bake-target math here mirrors the
  // matrix's row Total exactly: planned + extras + team food. On
  // non-hub sites `getExtras` returns 0, so the term drops out
  // gracefully.
  const extras = getExtras(siteId, skuId, date);
  const set = (next: number) => setTeamFoodPlan(line.item.id, next, date);
  const inflated = value > 0;
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 10,
        // Soft info-tint when team food is set, neutral surface when
        // empty — same colour grammar as the row chip so the manager
        // recognises the affordance as the same concept across surfaces.
        background: inflated
          ? 'var(--color-info-light)'
          : 'var(--color-bg-surface)',
        border: `1px solid ${inflated ? 'var(--color-info)' : 'var(--color-border-subtle)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 8,
            background: inflated ? 'var(--color-info)' : 'var(--color-bg-hover)',
            color: inflated ? '#ffffff' : 'var(--color-text-secondary)',
            flexShrink: 0,
          }}
        >
          <UtensilsCrossed size={14} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              letterSpacing: '0.01em',
            }}
          >
            Team food
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: 'var(--color-text-muted)',
              lineHeight: 1.45,
            }}
          >
            Added to the bake target — never counted as sold.
          </p>
        </div>
        <QtyStepper
          size="default"
          canDecrement={value > 0}
          onDecrement={() => set(Math.max(0, value - 1))}
          onIncrement={() => set(value + 1)}
          decrementLabel="Decrease team food units"
          incrementLabel="Increase team food units"
        >
          <input
            type="number"
            value={value}
            onChange={e => {
              const next = Number(e.target.value);
              if (Number.isFinite(next)) set(Math.max(0, Math.round(next)));
            }}
            min={0}
            step={1}
            aria-label={`Team food units for ${recipeName}`}
            style={{
              width: 44,
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 700,
              textAlign: 'center',
              color: 'var(--color-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'var(--font-primary)',
              outline: 'none',
              padding: 0,
              MozAppearance: 'textfield',
            }}
          />
        </QtyStepper>
      </div>
      {/* Math line — only renders once the GM has actually set team
          food, so the empty state stays quiet. The breakdown mirrors
          the matrix's row Total cell exactly (planned + extras + team
          food) so the manager can cross-reference "the table says 24,
          why?" against this section without doing arithmetic in their
          head. The "+ N extra" fragment auto-hides when no hub extras
          are stamped on this row. */}
      {inflated && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            paddingTop: 6,
            borderTop: '1px dashed var(--color-info)',
          }}
        >
          <span style={{ fontWeight: 600 }}>Bake target</span>
          <span
            style={{
              marginLeft: 'auto',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
            }}
          >
            {line.planned} sellable
            {extras > 0 ? ` + ${extras} extra` : ''}
            {' '}+ {value} team food = {line.planned + extras + value}
          </span>
        </div>
      )}
    </section>
  );
}

function VPMathSection({
  siteId,
  date,
  skuId,
  line,
  isHub,
}: {
  siteId: SiteId;
  date: string;
  skuId: string;
  line: ReturnType<typeof usePlan>[number] | null;
  isHub: boolean;
}) {
  const forecast = forecastFor(siteId, skuId, date);
  const carryOver = carryOverFor(siteId, skuId);
  const projected = forecast?.projectedUnits ?? 0;
  const carried = carryOver?.carriedUnits ?? 0;
  const quinnProposed = Math.max(0, projected - carried);
  const planned = line?.planned ?? quinnProposed;
  const variablePlanned = line?.variablePlanned ?? 0;
  const runPlanned = line?.runPlanned ?? 0;
  // Hub-side overlays that lift the bake target above the sellable
  // plan. Reading them straight from the same stores the matrix uses
  // means the drawer's "Bake target" line is byte-for-byte the same
  // number that the row's Total cell shows — no risk of the two
  // surfaces drifting because of an off-by-one in either path.
  const { getExtras } = useHubExtras();
  const extras = isHub ? getExtras(siteId, skuId, date) : 0;
  const teamFood = line?.teamFoodPlanned ?? 0;
  const bakeTarget = planned + extras + teamFood;
  const showBakeTarget = line != null && (extras > 0 || teamFood > 0);

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
        <Ledger label="Edify proposes" value={quinnProposed} bold quinn total />
        {line && line.item.mode === 'run' && (
          <>
            <Ledger label="Run baseline" value={runPlanned} muted total />
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
            <Ledger
              label={showBakeTarget ? 'Sellable plan' : 'Final plan'}
              value={planned}
              bold
              total
            />
          </>
        )}
        {/* Bake-target reconciliation — only renders once an overlay
            (extras or team food) has lifted the bake above the
            sellable plan. The numbers and the order match the matrix's
            row Total cell exactly: sellable + extras + team food. */}
        {showBakeTarget && (
          <>
            {extras > 0 && (
              <Ledger
                label="Hub extras (off-list)"
                value={extras}
                hint="Off-list units added on top of every spoke's allocation. Folded into the bake but tracked separately."
              />
            )}
            {teamFood > 0 && (
              <Ledger
                label="Team food (not sold)"
                value={teamFood}
                hint="Staff lunch units added to the bake target. Excluded from forecast accuracy and Total sales."
              />
            )}
            <Divider />
            <Ledger label="Bake target" value={bakeTarget} bold total />
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
  // Mirror the matrix's per-spoke read exactly:
  //  1. Auto-finalise any spoke whose cutoff has passed without a real
  //     submission — without this, spokes like Fitzroy Notting Hill or
  //     Fitzroy Heathrow read as "0" in the drawer even though the
  //     matrix shows their committed Quinn baseline.
  //  2. Skip lingering drafts so the drawer doesn't drive bake numbers
  //     off a half-edited order (drafts will display as "Pending" via
  //     the falls-through-to-zero branch with the draft status pill).
  //  3. Layer the hub manager's per-spoke overrides on top so anything
  //     they've dialled in via Edit-mode reads here too.
  // The combined effect: the per-spoke numbers in this drawer match
  // the per-spoke columns in the matrix byte-for-byte.
  const effective = useMemo(
    () => effectiveSubmissionsForHub(siteId, date),
    [siteId, date],
  );
  const { getOverride } = useHubOverrides();

  const rows = spokes.map(sp => {
    const sub = effective.find(s => s.fromSiteId === sp.id);
    const useSub = sub && sub.status !== 'draft' ? sub : undefined;
    const ln = useSub?.lines.find(l => l.skuId === skuId);
    const lineQty = ln ? ln.confirmedUnits ?? ln.quinnProposedUnits : 0;
    const override = getOverride(siteId, sp.id, skuId, date);
    const qty = override ?? lineQty;
    return { spoke: sp, qty, status: sub?.status, overridden: override !== undefined };
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
  total = false,
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
  muted?: boolean;
  quinn?: boolean;
  /**
   * Render the value as a plain total (no leading `+`). Used for
   * subtotal / final-target lines where the number stands on its own
   * and should match the matrix's row Total cell formatting exactly,
   * rather than reading as an additive ledger entry.
   */
  total?: boolean;
}) {
  // Default formatting reads as an additive ledger entry: "+5", "0",
  // "-3". `total` switches to plain ("5") so subtotal lines like
  // "Bake target" or "Final plan" align with the matrix's row total
  // style (where 24 is just 24, never +24).
  const display = total
    ? String(value)
    : value > 0
      ? `+${value}`
      : value === 0
        ? '0'
        : String(value);
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
        {display}
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
