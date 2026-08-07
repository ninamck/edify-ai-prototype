'use client';

/**
 * TypeChip — the shared entity-type chip used everywhere a POS button's
 * target is shown (chat match-triage card, Sync & match sheet, Item
 * matching page). One palette so "Product" is always the same green.
 */

export type EntityType = 'Master product' | 'Product' | 'Modifier' | 'Recipe' | 'Sub-recipe';

export const ENTITY_TYPE_CHIP: Record<EntityType, { color: string; bg: string }> = {
  'Master product': { color: '#0E7490', bg: 'rgba(14,116,144,0.08)' },
  'Product': { color: '#15803D', bg: 'rgba(21,128,61,0.08)' },
  'Modifier': { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  'Recipe': { color: '#1D4ED8', bg: 'rgba(29,78,216,0.08)' },
  'Sub-recipe': { color: '#B45309', bg: 'rgba(217,119,6,0.10)' },
};

/** What kind of button this is on the POS side. */
export type PosKind = 'Menu item' | 'Modifier';

const POS_KIND_CHIP: Record<PosKind, { color: string; bg: string }> = {
  'Menu item': { color: 'var(--color-text-secondary)', bg: 'rgba(0,28,53,0.05)' },
  'Modifier': { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
};

/** POS-side sibling of TypeChip — same shape, its own palette, so a row
 *  reads "button kind → target kind" at a glance. */
export function PosKindChip({ kind }: { kind: PosKind }) {
  // Fallback keeps hot-reloaded state (rows created before this field
  // existed) from crashing the sheet mid-demo.
  const c = POS_KIND_CHIP[kind] ?? POS_KIND_CHIP['Menu item'];
  return (
    <span style={{
      padding: '1px 7px', borderRadius: '999px', background: c.bg,
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em',
      color: c.color, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {kind}
    </span>
  );
}

export function TypeChip({ type }: { type: EntityType }) {
  const c = ENTITY_TYPE_CHIP[type];
  return (
    <span style={{
      padding: '1px 7px', borderRadius: '999px', background: c.bg,
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em',
      color: c.color, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {/* Shortened so the chip doesn't eat the row's horizontal budget. */}
      {type === 'Master product' ? 'Master' : type}
    </span>
  );
}
