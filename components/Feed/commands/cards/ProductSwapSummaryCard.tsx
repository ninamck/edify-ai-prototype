'use client';

import { useMemo, useState } from 'react';
import { Check, ArrowRight, Truck, Package, ChefHat, Camera, Link2, Plus, Activity } from 'lucide-react';
import CardShell, { PillRow, type CardState } from './CardShell';
import { useRecipes } from '@/components/Recipe/recipeStore';
import { findProduct } from '@/components/Suppliers/store';
import {
  computeProductSwapBlastRadius,
  averageGpDelta,
  worstGpLine,
} from '@/components/Feed/commands/diffs';
import BlastRadiusBlock from '@/components/Activity/BlastRadiusBlock';

const SITE_OPTIONS = ['Fitzroy', 'Brunswick', 'Carlton', 'Northcote'];

interface ProductSwapSummaryCardProps {
  state: CardState;
  /** Wizard mode — drives copy + which controls show. */
  mode?: 'add' | 'replace';
  /** Everything the wizard has accumulated. */
  newProductName: string;
  supplierMode: 'existing' | 'new';
  supplierName: string;
  /** Pack info — undefined when the operator skipped Step 3.5. */
  packType?: 'Pack' | 'Single';
  packQty?: number;
  packCost?: number;
  unitType?: string;
  photoAttached?: boolean;
  /** Replacement target (replace mode only). */
  oldProductId?: string;
  oldProductName?: string;
  selectedRecipeIds: string[];
  totalMatched: number;
  /** Add-mode quantity (set per recipe). */
  addQty?: number;
  addUom?: string;
  /** Names of the first few selected recipes — just for the diff
   *  context line. The runner builds this so the card stays
   *  decoupled from the recipe store. */
  sampleRecipeNames?: string[];
  onConfirm: (final: {
    scope: 'all' | 'site';
    siteLabel?: string;
    linkMaster: boolean;
  }) => void;
  onCancel: () => void;
}

/**
 * Final step of the product wizard. Two render variants share this
 * card:
 *
 *   • **Replace** — strike-through pill + arrow + new pill, plus the
 *     "treat as the same item" opt-in (link old + new under a
 *     master product). Most operators leave that off.
 *   • **Add** — green-add pill only, no master link (nothing to link
 *     against). Shows the per-recipe quantity so it's obvious
 *     before commit.
 *
 * Site scope toggle is shared (apply across all sites or just one).
 */
export default function ProductSwapSummaryCard({
  state,
  mode = 'replace',
  newProductName,
  supplierMode,
  supplierName,
  packType,
  packQty,
  packCost,
  unitType,
  photoAttached,
  oldProductId,
  oldProductName,
  selectedRecipeIds,
  totalMatched,
  addQty,
  addUom,
  sampleRecipeNames,
  onConfirm,
  onCancel,
}: ProductSwapSummaryCardProps) {
  const [scope, setScope] = useState<'all' | 'site'>('all');
  const [siteLabel, setSiteLabel] = useState<string>(SITE_OPTIONS[0]);
  const [linkMaster, setLinkMaster] = useState<boolean>(false);

  // ── Blast-radius preview ─────────────────────────────────────────
  //
  // Computed from current recipe state using the same helper that
  // powers the post-hoc Activity-log row. Renders inline when there's
  // anything meaningful to show — replace-mode with pack costs on
  // both sides is the only configuration that produces GP% lines
  // today (add-mode has nothing to compare against).
  const allRecipes = useRecipes();
  const oldProductSnapshot = oldProductId ? findProduct(oldProductId) : undefined;
  const blastRadius = useMemo(() => {
    const affected = allRecipes.filter((r) => selectedRecipeIds.includes(r.id));
    return computeProductSwapBlastRadius({
      mode,
      oldPackCost: oldProductSnapshot?.packCost,
      oldPackQty: oldProductSnapshot?.packQty,
      newPackCost: packCost,
      newPackQty: packQty,
      affectedRecipes: affected,
    });
  }, [allRecipes, selectedRecipeIds, mode, oldProductSnapshot, packCost, packQty]);
  const gpAverage = averageGpDelta(blastRadius);
  const gpWorst = worstGpLine(blastRadius);
  const hasGpImpact = gpAverage != null && gpWorst != null;

  const selectedCount = selectedRecipeIds.length;
  const packLine = (() => {
    if (packType == null) return null;
    const parts: string[] = [];
    if (packType === 'Pack' && packQty) parts.push(`${packQty} per pack`);
    if (packType === 'Single' && packQty) parts.push(`${packQty}${unitType ?? ''}`);
    if (packCost && packCost > 0) parts.push(`DH ${packCost.toFixed(2)}`);
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  const subtitle = mode === 'replace' && oldProductName
    ? `Adding ${newProductName} · replacing ${oldProductName}`
    : `Adding ${newProductName}${selectedCount > 0 ? ` to ${selectedCount} recipe${selectedCount === 1 ? '' : 's'}` : ''}`;

  return (
    <CardShell
      icon={Check}
      title="Ready to go?"
      subtitle={subtitle}
      state={state}
      confirmLabel="Save it"
      onCancel={onCancel}
      onConfirm={() =>
        onConfirm({
          scope,
          siteLabel: scope === 'site' ? siteLabel : undefined,
          linkMaster: mode === 'replace' ? linkMaster : false,
        })
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* ── Plan summary ────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
            background: 'rgba(40,175,201,0.04)',
          }}
        >
          {supplierMode === 'new' && (
            <SummaryRow
              icon={Truck}
              eyebrow="New supplier"
              text={supplierName}
            />
          )}
          <SummaryRow
            icon={Package}
            eyebrow={`New product${photoAttached ? ' · photo attached' : ''}`}
            text={
              <>
                {newProductName}{' '}
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  · from {supplierName}
                </span>
                {packLine && (
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    {' '}· {packLine}
                  </span>
                )}
                {photoAttached && (
                  <Camera
                    size={11}
                    color="var(--color-text-muted)"
                    strokeWidth={2.2}
                    style={{ marginLeft: '4px', verticalAlign: 'middle' }}
                  />
                )}
              </>
            }
          />
          <SummaryRow
            icon={ChefHat}
            eyebrow={
              mode === 'replace'
                ? 'Recipes to update'
                : `Recipes to add it to${addQty != null ? ` · ${addQty}${addUom ?? ''} each` : ''}`
            }
            text={
              selectedCount === 0 ? (
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  None — just adding the product
                </span>
              ) : mode === 'replace' && oldProductName ? (
                <>
                  <Pill label={oldProductName} tone="strike" />
                  <ArrowRight
                    size={12}
                    color="var(--color-text-muted)"
                    strokeWidth={2.2}
                    style={{ margin: '0 4px', verticalAlign: 'middle' }}
                  />
                  <Pill label={newProductName} tone="add" />
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    in {selectedCount} of {totalMatched} recipe{totalMatched === 1 ? '' : 's'}
                  </span>
                </>
              ) : (
                <>
                  <Plus
                    size={12}
                    color="#2D6A4F"
                    strokeWidth={2.4}
                    style={{ marginRight: '2px', verticalAlign: 'middle' }}
                  />
                  <Pill label={newProductName} tone="add" />
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    in {selectedCount} recipe{selectedCount === 1 ? '' : 's'}
                  </span>
                </>
              )
            }
          />
          {sampleRecipeNames && sampleRecipeNames.length > 0 && (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                paddingLeft: '28px',
                lineHeight: 1.45,
              }}
            >
              {sampleRecipeNames.slice(0, 4).join(', ')}
              {selectedCount > 4 ? `, +${selectedCount - 4} more` : ''}
            </div>
          )}
        </div>

        {/* ── Blast radius (preview) ──────────────────────────────
            Show the downstream GP% impact before the operator
            commits. The same component renders the same numbers on
            the Activity-log row after the fact, so what you see
            here is what shows up in the audit trail. */}
        {hasGpImpact && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--color-border-subtle)',
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Activity size={13} strokeWidth={2.2} color="var(--color-text-secondary)" />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Downstream impact
              </span>
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: 'var(--color-text-primary)',
                lineHeight: 1.5,
              }}
            >
              Average GP{' '}
              <b
                style={{
                  color: (gpAverage ?? 0) < 0 ? '#A8401C' : '#22573F',
                }}
              >
                {gpAverage! > 0 ? '+' : ''}
                {gpAverage}
                {'\u202F'}pp
              </b>{' '}
              across {blastRadius.filter((l) => l.metric === 'gp_pct').length} recipe
              {blastRadius.filter((l) => l.metric === 'gp_pct').length === 1 ? '' : 's'}.
              Biggest hit:{' '}
              <b>{gpWorst!.entityLabel}</b>{' '}
              <b
                style={{
                  color: (gpWorst!.delta ?? 0) < 0 ? '#A8401C' : '#22573F',
                }}
              >
                {(gpWorst!.delta ?? 0) > 0 ? '+' : ''}
                {gpWorst!.delta}
                {'\u202F'}pp
              </b>
              .
            </div>
            <BlastRadiusBlock lines={blastRadius} density="compact" />
            <div
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                fontStyle: 'italic',
                lineHeight: 1.45,
              }}
            >
              Directional estimate from per-unit pack cost — not a full re-resolve
              through ingredient quantities. The exact figure lands in Activity after
              you apply.
            </div>
          </div>
        )}

        {/* ── Master-product opt-in (replace mode only) ──────────── */}
        {mode === 'replace' && selectedCount > 0 && oldProductName && (
          <label
            style={{
              display: 'flex',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '12px',
              border: '1px dashed var(--color-border, rgba(0,28,53,0.18))',
              background: 'transparent',
              cursor: state === 'pending' ? 'pointer' : 'not-allowed',
            }}
          >
            <input
              type="checkbox"
              disabled={state !== 'pending'}
              checked={linkMaster}
              onChange={(e) => setLinkMaster(e.target.checked)}
              style={{ marginTop: '2px', accentColor: 'var(--color-accent-active, #001C35)' }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                }}
              >
                <Link2 size={12} strokeWidth={2.2} />
                Treat these as the same item
              </div>
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  marginTop: '4px',
                  lineHeight: 1.4,
                }}
              >
                Link {oldProductName} and {newProductName} under one
                master product. Useful when you&rsquo;re switching
                suppliers for the same thing (e.g. swapping coffee
                roasters) — recipes can then use either SKU
                interchangeably.
              </div>
            </div>
          </label>
        )}

        {/* ── Scope ───────────────────────────────────────────────── */}
        <div>
          <Label>Apply to</Label>
          <div style={{ marginTop: '6px' }}>
            <PillRow
              options={[
                { value: 'all', label: 'All sites' },
                { value: 'site', label: 'One site only' },
              ]}
              selected={scope}
              onSelect={(v) => setScope(v)}
              disabled={state !== 'pending'}
            />
          </div>
          {scope === 'site' && (
            <div style={{ marginTop: '8px' }}>
              <PillRow
                options={SITE_OPTIONS.map((s) => ({ value: s, label: s }))}
                selected={siteLabel}
                onSelect={setSiteLabel}
                disabled={state !== 'pending'}
                small
              />
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

function SummaryRow({
  icon: Icon,
  eyebrow,
  text,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  eyebrow: string;
  text: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: '6px',
          background: '#fff',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        <Icon size={12} color="var(--color-accent-mid, #28AFC9)" strokeWidth={2.2} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginTop: '2px',
            lineHeight: 1.4,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

function Pill({ label, tone }: { label: string; tone: 'strike' | 'add' }) {
  const isStrike = tone === 'strike';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '100px',
        background: isStrike ? 'rgba(176,0,32,0.08)' : 'rgba(45,106,79,0.10)',
        color: isStrike ? '#9B1C24' : '#2D6A4F',
        fontSize: '11.5px',
        fontWeight: 700,
        fontFamily: 'var(--font-primary)',
        textDecoration: isStrike ? 'line-through' : 'none',
        verticalAlign: 'middle',
      }}
    >
      {label}
    </span>
  );
}
