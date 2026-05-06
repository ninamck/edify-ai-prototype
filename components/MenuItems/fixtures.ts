import type { MenuItem } from './types';

/**
 * Seed menu items showing the four canonical shapes:
 *
 *   - Recipe-backed with attached modifier groups
 *       e.g. Latte → "rec-latte" + Alt milks + Coffee size
 *
 *   - Recipe-backed with a slot the modifier targets
 *       e.g. Smirnoff Vodka → "rec-smirnoff" + a "spirit" slot, attached
 *       to the shared Spirit measure + Mixer groups. The same Spirit
 *       measure group is also attached to Grey Goose / Tanqueray — one
 *       button on the POS for 25ml, not 100s.
 *
 *   - Modifier-driven with no default recipe
 *       e.g. Sauvignon Blanc → no `defaultRecipeId`. Pour size group is
 *       required so a pour is always picked. No "placeholder ingredient"
 *       hack required to publish the item.
 *
 *   - Pastry / standalone (no modifiers, no slots)
 *       e.g. Croissant — recipe-backed, plain.
 */
export const SEED_MENU_ITEMS: MenuItem[] = [
  // ── Coffee — recipe-backed + Alt milks + Coffee size ─────────────────────
  {
    id: 'mi-latte',
    name: 'Latte',
    category: 'Coffee',
    defaultRecipeId: 'rec-latte',
    slots: [],
    modifierGroupIds: ['mg-alt-milks', 'mg-coffee-size'],
    basePrice: 4.20,
    posSourceId: 'pos-mi-latte',
    posLinked: true,
    status: 'Active',
  },
  {
    id: 'mi-flat-white',
    name: 'Flat white',
    category: 'Coffee',
    defaultRecipeId: 'rec-flat-white',
    slots: [],
    modifierGroupIds: ['mg-alt-milks', 'mg-coffee-size'],
    basePrice: 4.00,
    posSourceId: 'pos-mi-flat-white',
    posLinked: true,
    status: 'Active',
  },
  {
    id: 'mi-cappuccino',
    name: 'Cappuccino',
    category: 'Coffee',
    defaultRecipeId: 'rec-cappuccino',
    slots: [],
    modifierGroupIds: ['mg-alt-milks', 'mg-coffee-size'],
    basePrice: 4.00,
    posSourceId: 'pos-mi-cappuccino',
    posLinked: true,
    status: 'Active',
  },

  // ── Spirits — slot-driven, sharing one measure group ─────────────────────
  {
    id: 'mi-smirnoff-vodka',
    name: 'Smirnoff Vodka',
    category: 'Spirits',
    defaultRecipeId: 'rec-smirnoff',
    slots: [
      {
        key: 'spirit',
        label: 'Spirit',
        defaultRef: { kind: 'master', masterProductId: 'mp-smirnoff-vodka' },
      },
    ],
    modifierGroupIds: ['mg-spirit-measure', 'mg-mixer'],
    basePrice: 4.50,
    posSourceId: 'pos-mi-smirnoff',
    posLinked: true,
    status: 'Active',
    notes: 'Spirit measure + Mixer groups are shared across every spirit menu item — one button each on the POS.',
  },
  {
    id: 'mi-grey-goose-vodka',
    name: 'Grey Goose Vodka',
    category: 'Spirits',
    // Note: no recipe yet — slot fills in for the spirit, modifier picks
    // measure + mixer. This is the "no fake placeholder ingredient
    // needed" case.
    slots: [
      {
        key: 'spirit',
        label: 'Spirit',
        defaultRef: { kind: 'master', masterProductId: 'mp-grey-goose-vodka' },
      },
    ],
    modifierGroupIds: ['mg-spirit-measure', 'mg-mixer'],
    basePrice: 6.50,
    posSourceId: 'pos-mi-grey-goose',
    posLinked: true,
    status: 'Active',
  },
  {
    id: 'mi-tanqueray-gin',
    name: 'Tanqueray Gin',
    category: 'Spirits',
    defaultRecipeId: 'rec-tanqueray',
    slots: [
      {
        key: 'spirit',
        label: 'Spirit',
        defaultRef: { kind: 'master', masterProductId: 'mp-tanqueray-gin' },
      },
    ],
    modifierGroupIds: ['mg-spirit-measure', 'mg-mixer'],
    basePrice: 5.00,
    posSourceId: 'pos-mi-tanqueray',
    posLinked: true,
    status: 'Active',
  },

  // ── Wine — modifier-driven, no default recipe ────────────────────────────
  {
    id: 'mi-savvy-b',
    name: 'Marlborough Sauvignon Blanc',
    category: 'Wine',
    // No defaultRecipeId — the pour size modifier IS the composition.
    slots: [
      {
        key: 'wine',
        label: 'Wine',
        defaultRef: { kind: 'master', masterProductId: 'mp-savvy-b' },
      },
    ],
    modifierGroupIds: ['mg-wine-pour'],
    basePrice: 6.50,
    posSourceId: 'pos-mi-savvy-b',
    posLinked: true,
    status: 'Active',
    notes: 'No default recipe. Pour size is required — every order picks 175ml / 250ml / bottle.',
  },

  // ── Pastry — recipe-backed, no modifiers ─────────────────────────────────
  {
    id: 'mi-croissant',
    name: 'Croissant',
    category: 'Pastry',
    defaultRecipeId: 'rec-croissant',
    slots: [],
    modifierGroupIds: [],
    basePrice: 2.80,
    posSourceId: 'pos-mi-croissant',
    posLinked: true,
    status: 'Active',
  },
];
