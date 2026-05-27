'use client';

/**
 * Right-anchored detail drawer for a single stock item. Mirrors the
 * SupplierDrawer pattern (portal + framer slide-in) so the in-app
 * mental model is consistent: clicking a row in any inventory-style
 * table opens a drawer on the right.
 *
 * Three sections, ordered by what an operator deciding what to do next
 * actually reaches for:
 *   1. Headline numbers + provenance — does the data look right?
 *   2. Actions — what can I do about this?
 *   3. Movements — what happened to bring it here?
 *
 * Edits to current stock / unit hand back to the parent via the same
 * `onItemEdit` channel the table uses, so the page-level override map
 * stays the single source of truth.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingBag,
  Truck,
  Trash2,
  ClipboardCheck,
  ChefHat,
  ArrowRightLeft,
  Pencil,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ConfidenceBadge from '@/app/assisted-ordering/components/ConfidenceBadge';
import UnitInput from './UnitInput';
import type { StockItem, StockMovementKind } from './status';
import {
  STATUS_CONFIG,
  STOCK_TYPE_CONFIG,
  MOVEMENT_KIND_CONFIG,
  formatDaysCover,
  formatMovementQuantity,
  formatRelativeDate,
  formatStock,
  formatStocktakeAge,
  getDaysCover,
  getLinkedRecipes,
  getStockStatus,
  getVarianceFraction,
  rollupCounts,
} from './status';
import { ctaConfigFor } from './actions';

interface Props {
  item: StockItem | null;
  onClose: () => void;
  onItemEdit: (id: string, patch: { currentStock?: number; stockUnit?: string }) => void;
}

const MOVEMENT_ICON: Record<StockMovementKind, LucideIcon> = {
  sale: ShoppingBag,
  delivery: Truck,
  'transfer-in': ArrowDownToLine,
  'transfer-out': ArrowUpFromLine,
  waste: Trash2,
  stocktake: ClipboardCheck,
  'production-in': ChefHat,
  'production-out': ArrowRightLeft,
};

export default function ItemDetailDrawer({ item, onClose, onItemEdit }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (item) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {item && (
        <DrawerBody
          key={item.id}
          item={item}
          onClose={onClose}
          onItemEdit={onItemEdit}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DrawerBody({
  item,
  onClose,
  onItemEdit,
}: {
  item: StockItem;
  onClose: () => void;
  onItemEdit: Props['onItemEdit'];
}) {
  const router = useRouter();
  const status = getStockStatus(item);
  const statusConfig = STATUS_CONFIG[status];
  const typeConfig = STOCK_TYPE_CONFIG[item.type];
  const daysCover = getDaysCover(item);
  const variance = getVarianceFraction(item);
  const ctas = ctaConfigFor(status, item);

  const provenance = item.posDataAvailable
    ? `From stocktake ${formatStocktakeAge(item.stockDataAgeDays)} + POS depletion`
    : `From stocktake ${formatStocktakeAge(item.stockDataAgeDays)} — no POS data`;

  // Generated deterministically from the item id + category — see
  // status.ts. Same item ⇒ same recipe list across renders.
  const linkedRecipes = getLinkedRecipes(item);

  // Quick-count panel state. Off by default; clicking "Run mid-week
  // count" flips it on (instead of routing away to /stock?tab=...).
  // The counts map is keyed by unit so the operator can record the
  // count using whichever unit they're physically holding — loose kg,
  // a bag, a case, a tray — and every cell rolls up into a single
  // quantity in the item's primary stockUnit on save. The rollup uses
  // `rollupCounts` (same helper the full Stocktake flow uses), which
  // applies mass/volume defaults automatically and item-specific
  // pack-size factors for the count-shaped alternates.
  const [counting, setCounting] = useState(false);
  const [unitCounts, setUnitCounts] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState(false);

  const allUnits = [
    item.stockUnit,
    ...item.alternateUnits.filter(u => u !== item.stockUnit),
  ];

  const draftRollup = rollupCounts(item, unitCounts);
  const canSaveCount = draftRollup.hasInput && draftRollup.total >= 0;

  function startCounting() {
    setUnitCounts({});
    setJustSaved(false);
    setCounting(true);
  }

  function handleSaveCount() {
    if (!canSaveCount) return;
    onItemEdit(item.id, {
      currentStock: Number(draftRollup.total.toFixed(3)),
    });
    setCounting(false);
    setJustSaved(true);
    // Auto-clear the "Saved" flag after a beat so it doesn't linger
    // forever; the new stock figure stays put because onItemEdit
    // updates the page-level override map.
    setTimeout(() => setJustSaved(false), 2500);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(58,48,40,0.18)',
          zIndex: 700,
        }}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
        role="dialog"
        aria-label={`${item.name} detail`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(560px, 100vw)',
          background: '#fff',
          boxShadow: '-20px 0 60px rgba(58,48,40,0.16)',
          zIndex: 701,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={iconBtnStyle}
            >
              <X size={16} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.variant} · {item.category}
              </div>
            </div>
            <ConfidenceBadge
              score={item.confidenceScore}
              factors={item.confidenceFactors}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Chip
              bg={statusConfig.chipBg}
              fg={statusConfig.chipText}
              border={statusConfig.chipBorder}
            >
              {statusConfig.label}
            </Chip>
            <Chip
              bg={typeConfig.chipBg}
              fg={typeConfig.chipText}
              border={typeConfig.chipBorder}
            >
              {typeConfig.label}
            </Chip>
            <Chip
              bg="var(--color-bg-hover)"
              fg="var(--color-text-secondary)"
              border="var(--color-border-subtle)"
            >
              {item.linkedRecipeCount} {item.linkedRecipeCount === 1 ? 'recipe' : 'recipes'}
            </Chip>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {/* Headline metrics */}
          <Section label="Snapshot">
            <MetricRow>
              <EditableMetric
                label="On hand"
                value={item.currentStock}
                unit={item.stockUnit}
                unitOptions={[
                  item.stockUnit,
                  ...item.alternateUnits.filter(u => u !== item.stockUnit),
                ]}
                onSaveValue={v => onItemEdit(item.id, { currentStock: v })}
                onSaveUnit={u => onItemEdit(item.id, { stockUnit: u })}
              />
              <Metric
                label="Par"
                value={
                  item.parLevel !== null
                    ? formatStock(item.parLevel, item.stockUnit)
                    : 'Not set'
                }
                meta={item.parConfirmed ? 'Confirmed' : 'Suggested'}
              />
              <Metric
                label="Days cover"
                value={formatDaysCover(daysCover)}
                meta={
                  item.salesVelocity7d !== null
                    ? `at ${item.salesVelocity7d.toFixed(1)} ${item.stockUnit}/day`
                    : 'no POS data'
                }
              />
              <Metric
                label="Theoretical"
                value={
                  item.theoreticalStock !== null
                    ? formatStock(item.theoreticalStock, item.stockUnit)
                    : '—'
                }
                meta={
                  variance !== null
                    ? `${Math.round(variance * 100)}% gap`
                    : 'no variance data'
                }
              />
            </MetricRow>
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                marginTop: 8,
              }}
            >
              {provenance} · supplier {item.supplierName}
            </div>
          </Section>

          {/* Actions */}
          <Section
            label="What to do next"
            sublabel={justSaved ? 'Count saved' : undefined}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ctas.primary.label && (
                <button
                  type="button"
                  onClick={() =>
                    ctas.primary.label === 'Run mid-week count'
                      ? startCounting()
                      : router.push(ctas.primary.href)
                  }
                  style={primaryCtaStyle}
                >
                  {ctas.primary.label}
                </button>
              )}
              {ctas.secondaries.map(cta => (
                <button
                  key={cta.label}
                  type="button"
                  onClick={() =>
                    cta.label === 'Run mid-week count'
                      ? startCounting()
                      : router.push(cta.href)
                  }
                  style={secondaryCtaStyle}
                >
                  {cta.label}
                </button>
              ))}
            </div>

            {/* Inline quick-count panel — opens when the operator hits
                "Run mid-week count" from one of the CTAs above
                instead of routing them off to /stock?tab=stocktake.
                Same UnitInput control as the full Stocktake flow so
                the mental model is consistent. Every cell rolls up
                into a single quantity in the item's primary
                stockUnit on save, so a mid-week count can mix loose
                weight + bags / cases / trays and still commit a
                clean number. */}
            {counting && (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Quick count
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Currently on hand: {formatStock(item.currentStock, item.stockUnit)}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  {allUnits.map(unit => (
                    <UnitInput
                      key={unit}
                      unit={unit}
                      value={unitCounts[unit] ?? ''}
                      onChange={next =>
                        setUnitCounts(prev => ({ ...prev, [unit]: next }))
                      }
                      inputWidth={84}
                      tagMinWidth={52}
                      inputFontSize={16}
                    />
                  ))}
                </div>

                {/* Live total. Sits between the input strip and the
                    action row so the operator can see what they're
                    about to commit before hitting Save. Reads "—"
                    until at least one cell has a parseable value. */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-item)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: draftRollup.hasInput
                        ? 'var(--color-success)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    {draftRollup.unitsEntered > 1 ? 'Total counted' : 'Counted'}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: draftRollup.hasInput
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                    }}
                  >
                    {draftRollup.hasInput
                      ? formatStock(draftRollup.total, item.stockUnit)
                      : '—'}
                  </span>
                </div>

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
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {allUnits.length > 1
                      ? `Every unit you fill in rolls up into ${item.stockUnit}`
                      : `Saves as ${item.stockUnit}`}
                    {draftRollup.hasUnconvertible
                      ? ' · one entry not convertible — skipped'
                      : ''}
                  </span>
                  <div style={{ display: 'inline-flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setCounting(false)}
                      style={secondaryCtaStyle}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCount}
                      disabled={!canSaveCount}
                      style={{
                        ...primaryCtaStyle,
                        opacity: canSaveCount ? 1 : 0.6,
                        cursor: canSaveCount ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Save count
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* Linked recipes — every dish or drink that consumes this
              item, with a "uses X per serving" subtitle so the
              operator can see how much demand a recipe puts on the
              line. Empty state covers items that have no recipes
              (packaging, cleaning, etc) or a count of zero. */}
          <Section
            label="Linked recipes"
            sublabel={
              linkedRecipes.length === 0
                ? 'None'
                : `${linkedRecipes.length} recipe${
                    linkedRecipes.length === 1 ? '' : 's'
                  }`
            }
          >
            {linkedRecipes.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  background: 'var(--color-bg-hover)',
                  borderRadius: 'var(--radius-card)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                Not used in any recipes.
              </div>
            ) : (
              <div
                role="list"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#fff',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                }}
              >
                {linkedRecipes.map((rec, idx) => (
                  <div
                    key={rec.id}
                    role="listitem"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 14px',
                      borderTop:
                        idx === 0
                          ? 'none'
                          : '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <ChefHat
                        size={14}
                        color="var(--color-text-secondary)"
                        style={{ flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={rec.name}
                      >
                        {rec.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Uses {formatStock(rec.usagePerServing, rec.usageUnit)}
                      <span style={{ opacity: 0.7 }}> / serving</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Movements timeline */}
          <Section
            label="Recent movements"
            sublabel={`${item.movements.length} event${item.movements.length === 1 ? '' : 's'}`}
          >
            {item.movements.length === 0 ? (
              <div
                style={{
                  padding: '14px',
                  background: 'var(--color-bg-hover)',
                  borderRadius: 'var(--radius-card)',
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                }}
              >
                No movements recorded for this item yet.
              </div>
            ) : (
              <ol
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {item.movements.map(mv => {
                  const kindConfig = MOVEMENT_KIND_CONFIG[mv.kind];
                  const Icon = MOVEMENT_ICON[mv.kind];
                  return (
                    <li
                      key={mv.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '10px 12px',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-card)',
                        background: '#fff',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                          borderRadius: '50%',
                          background: 'var(--color-bg-hover)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: kindConfig.iconColour,
                        }}
                      >
                        <Icon size={14} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            {kindConfig.label}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: kindConfig.iconColour,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {mv.quantity === 0
                              ? '—'
                              : formatMovementQuantity(mv.quantity, item.stockUnit)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            marginTop: 2,
                            fontSize: 11,
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {mv.note}
                          </span>
                          <span style={{ flexShrink: 0 }}>
                            {formatRelativeDate(mv.date)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>
      </motion.aside>
    </>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Section({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-secondary)',
          }}
        >
          {label}
        </h3>
        {sublabel && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-secondary)',
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function MetricRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        background: '#fff',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginTop: 2,
        }}
      >
        {value}
      </div>
      {meta && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginTop: 2,
          }}
        >
          {meta}
        </div>
      )}
    </div>
  );
}

function EditableMetric({
  label,
  value,
  unit,
  unitOptions,
  onSaveValue,
  onSaveUnit,
}: {
  label: string;
  value: number;
  unit: string;
  unitOptions: string[];
  onSaveValue: (next: number) => void;
  onSaveUnit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value.toString());
  const [draftUnit, setDraftUnit] = useState(unit);

  useEffect(() => {
    if (editing) {
      setDraftValue(value.toString());
      setDraftUnit(unit);
    }
  }, [editing, value, unit]);

  function commit() {
    const next = parseFloat(draftValue);
    if (!Number.isNaN(next) && next !== value) onSaveValue(next);
    if (draftUnit !== unit) onSaveUnit(draftUnit);
    setEditing(false);
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        background: '#fff',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      {editing ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
          }}
        >
          <input
            type="number"
            step="0.1"
            value={draftValue}
            onChange={e => setDraftValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            style={{
              width: 80,
              padding: '4px 8px',
              border: '1px solid var(--color-accent-active)',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
            }}
          />
          <select
            value={draftUnit}
            onChange={e => setDraftUnit(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--color-accent-active)',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'var(--font-primary)',
            }}
          >
            {unitOptions.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={commit}
            aria-label="Save"
            style={iconBtnStyle}
          >
            <Check size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 0,
            marginTop: 2,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            color: 'var(--color-text-primary)',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700 }}>
            {formatStock(value, unit)}
          </span>
          <Pencil
            size={12}
            strokeWidth={2}
            color="var(--color-text-secondary)"
            style={{ opacity: 0.45 }}
          />
        </button>
      )}
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          marginTop: 2,
        }}
      >
        Click to edit
      </div>
    </div>
  );
}

// Outlined chip — matches the All items table treatment. Background
// stays transparent so the chips don't compete with the drawer's
// content; `bg` / `border` are accepted but ignored so call sites can
// keep passing the full STATUS_CONFIG / STOCK_TYPE_CONFIG entries.
function Chip({
  children,
  fg,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  border: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 'var(--radius-badge)',
        background: 'transparent',
        color: fg,
        border: `1px solid ${fg}`,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};

const primaryCtaStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 'var(--radius-item)',
  background: 'var(--color-accent-active)',
  color: 'var(--color-text-on-active)',
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};

const secondaryCtaStyle: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: 'var(--radius-item)',
  background: '#fff',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'var(--font-primary)',
};
