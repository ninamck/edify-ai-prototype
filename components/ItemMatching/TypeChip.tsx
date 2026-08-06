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

export function TypeChip({ type }: { type: EntityType }) {
  const c = ENTITY_TYPE_CHIP[type];
  return (
    <span style={{
      padding: '1px 7px', borderRadius: '999px', background: c.bg,
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em',
      color: c.color, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}
