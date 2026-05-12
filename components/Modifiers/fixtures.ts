import type { ModifierGroup } from './types';

/**
 * Seed modifier groups demonstrating the four shapes we care about:
 *
 *   - Alt milks            "replace" effects (whole milk → oat / almond / soy)
 *   - Coffee size          "scale" + "add" effects across multiple ingredients
 *   - Spirit measure       "set-slot" effects (works for any spirit menu item)
 *   - Mixer                "add" effects (works for any spirit menu item)
 *   - Wine pour size       "set-slot" effects on a slot with no default qty
 *
 * The references inside each effect use the master products / supplier
 * products seeded in components/Suppliers/fixtures.ts.
 */
export const SEED_MODIFIER_GROUPS: ModifierGroup[] = [
  {
    id: 'mg-alt-milks',
    name: 'Alt milks',
    selection: 'one',
    required: false,
    posSourceId: 'pos-mg-milks',
    notes: 'Swap the recipe\'s default milk for an alternative. Same volume.',
    options: [
      {
        id: 'mg-alt-milks-whole',
        name: 'Whole milk',
        isDefault: true,
        effects: [], // no-op — the recipe's default
      },
      {
        id: 'mg-alt-milks-oat',
        name: 'Oat milk',
        priceDelta: 0.40,
        effects: [
          {
            kind: 'replace',
            from: { kind: 'master', masterProductId: 'mp-whole-milk-1l' },
            to: { kind: 'master', masterProductId: 'mp-oat-milk-1l' },
            qtyMode: 'same',
          },
        ],
      },
      {
        id: 'mg-alt-milks-skim',
        name: 'Skimmed milk',
        effects: [
          {
            kind: 'replace',
            from: { kind: 'master', masterProductId: 'mp-whole-milk-1l' },
            to: { kind: 'master', masterProductId: 'mp-skim-milk-1l' },
            qtyMode: 'same',
          },
        ],
      },
    ],
  },
  {
    id: 'mg-coffee-size',
    name: 'Coffee size',
    selection: 'one',
    required: true,
    posSourceId: 'pos-mg-cup',
    notes: 'One modifier affects coffee dose, milk volume, and the takeaway cup in one go — including swapping the cup as packaging.',
    options: [
      {
        id: 'mg-coffee-size-small',
        name: 'Small (8oz)',
        isDefault: true,
        effects: [],
      },
      {
        id: 'mg-coffee-size-large',
        name: 'Large (12oz)',
        priceDelta: 0.60,
        effects: [
          {
            kind: 'scale',
            factor: 1.25,
            targetMasterProductIds: ['mp-whole-milk-1l', 'mp-oat-milk-1l', 'mp-skim-milk-1l', 'mp-espresso-blend'],
          },
          // Packaging swap — the cup physically changes for a large
          // coffee. Replace effects target ingredients OR packaging
          // identically: both sit in the resolved line list.
          {
            kind: 'replace',
            from: { kind: 'master', masterProductId: 'mp-cup-takeaway-8oz' },
            to: { kind: 'master', masterProductId: 'mp-cup-takeaway-12oz' },
            qtyMode: 'same',
          },
        ],
      },
    ],
  },
  {
    id: 'mg-spirit-measure',
    name: 'Spirit measure',
    selection: 'one',
    required: true,
    posSourceId: 'pos-mg-measure',
    notes: 'Applies to any spirit menu item via the "spirit" slot — one shared button instead of 25ml/50ml per spirit.',
    options: [
      {
        id: 'mg-spirit-measure-25',
        name: '25ml',
        isDefault: true,
        effects: [{ kind: 'set-slot', slotKey: 'spirit', qty: { value: 25, unit: 'ml' } }],
      },
      {
        id: 'mg-spirit-measure-50',
        name: '50ml',
        priceDelta: 1.50,
        effects: [{ kind: 'set-slot', slotKey: 'spirit', qty: { value: 50, unit: 'ml' } }],
      },
    ],
  },
  {
    id: 'mg-mixer',
    name: 'Mixer',
    selection: 'one',
    required: false,
    posSourceId: 'pos-mg-mixer',
    notes: 'Adds a mixer to any spirit menu item. One group, every spirit.',
    options: [
      {
        id: 'mg-mixer-none',
        name: 'No mixer',
        isDefault: true,
        effects: [],
      },
      {
        id: 'mg-mixer-coke',
        name: 'Coke',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-coke' }, qty: { value: 200, unit: 'ml' } },
        ],
      },
      {
        id: 'mg-mixer-lemonade',
        name: 'Lemonade',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-lemonade' }, qty: { value: 200, unit: 'ml' } },
        ],
      },
      {
        id: 'mg-mixer-tonic',
        name: 'Tonic',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-tonic' }, qty: { value: 200, unit: 'ml' } },
        ],
      },
    ],
  },
  {
    id: 'mg-wine-pour',
    name: 'Wine pour size',
    selection: 'one',
    required: true,
    posSourceId: 'pos-mg-pour',
    notes: 'Wine menu items have no default size — every order picks one of these.',
    options: [
      {
        id: 'mg-wine-pour-175',
        name: '175ml',
        effects: [{ kind: 'set-slot', slotKey: 'wine', qty: { value: 175, unit: 'ml' } }],
      },
      {
        id: 'mg-wine-pour-250',
        name: '250ml',
        priceDelta: 2.50,
        effects: [{ kind: 'set-slot', slotKey: 'wine', qty: { value: 250, unit: 'ml' } }],
      },
      {
        id: 'mg-wine-pour-bottle',
        name: 'Bottle (750ml)',
        priceDelta: 14.00,
        effects: [{ kind: 'set-slot', slotKey: 'wine', qty: { value: 750, unit: 'ml' } }],
      },
    ],
  },
];
