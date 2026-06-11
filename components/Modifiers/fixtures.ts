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
        posSourceId: 'pos-mg-milks-whole',
        effects: [], // no-op — the recipe's default
      },
      {
        id: 'mg-alt-milks-oat',
        name: 'Oat milk',
        priceDelta: 0.40,
        posSourceId: 'pos-mg-milks-oat',
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
    name: 'Coffee size (legacy)',
    selection: 'one',
    required: true,
    posSourceId: 'pos-mg-cup',
    notes:
      'LEGACY — size-as-modifier pattern. Kept here for the audit story; the three '
      + 'coffees now model size as a first-class variant dimension. Do not attach '
      + 'to new recipes — promote size to a variant instead so cross-site reporting '
      + 'works and POS variations map cleanly.',
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
  // ── Breakfast side groups ──────────────────────────────────────────────
  // Modelled on the Olo ordering flow for Raspberry White Chocolate
  // Pancakes (rec-rwc-pancakes). Four groups mirror the four POS panels:
  //
  //   Choose Side          optional upsell — carries the +3.00 price
  //   Side 1 – Eggs        the eggs themselves (add effect)
  //   Egg Preparation      prep instruction only — no ingredient change
  //   Side 2 – Meat Option which meat lands on the plate (add effects)
  //
  // Known model gap: on the POS the eggs/meat groups only apply when
  // "Two Side Options" is chosen. We have no conditional groups yet, so
  // the price lives on the upsell option and the composition lives on
  // the side groups.
  {
    id: 'mg-pancake-sides',
    name: 'Choose Side',
    selection: 'one',
    required: false,
    posSourceId: 'pos-mg-pancake-sides',
    notes:
      'Optional side upsell. "Two Side Options" carries the +3.00 price; the '
      + 'actual composition comes from the Side 1 – Eggs and Side 2 – Meat '
      + 'Option groups attached alongside this one.',
    options: [
      {
        id: 'mg-pancake-sides-none',
        name: 'No sides',
        isDefault: true,
        effects: [],
      },
      {
        id: 'mg-pancake-sides-two',
        name: 'Two Side Options',
        priceDelta: 3.00,
        posSourceId: 'pos-mg-pancake-sides-two',
        effects: [], // price only — eggs/meat are added by the groups below
      },
    ],
  },
  {
    id: 'mg-side-eggs',
    name: 'Side 1 – Eggs',
    selection: 'one',
    required: true,
    posSourceId: 'pos-mg-side-eggs',
    notes: 'Eggs side that comes with the breakfast plates. Single option today.',
    options: [
      {
        id: 'mg-side-eggs-2',
        name: '2 Eggs',
        isDefault: true,
        posSourceId: 'pos-mg-side-eggs-2',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-eggs' }, qty: { value: 2, unit: 'each' } },
        ],
      },
    ],
  },
  {
    id: 'mg-egg-prep',
    name: 'Egg Preparation',
    selection: 'one',
    required: true,
    posSourceId: 'pos-mg-egg-prep',
    notes:
      'Kitchen instruction only — the same two eggs are consumed whichever '
      + 'style is picked, so no option carries ingredient effects.',
    options: [
      { id: 'mg-egg-prep-scrambled', name: 'Scrambled', posSourceId: 'pos-mg-egg-prep-scrambled', effects: [] },
      { id: 'mg-egg-prep-over-easy', name: 'Over Easy', posSourceId: 'pos-mg-egg-prep-over-easy', effects: [] },
      { id: 'mg-egg-prep-over-medium', name: 'Over Medium', posSourceId: 'pos-mg-egg-prep-over-medium', effects: [] },
      { id: 'mg-egg-prep-over-hard', name: 'Over Hard', posSourceId: 'pos-mg-egg-prep-over-hard', effects: [] },
      { id: 'mg-egg-prep-sunny-side-up', name: 'Sunny-Side Up', posSourceId: 'pos-mg-egg-prep-sunny', effects: [] },
    ],
  },
  {
    id: 'mg-side-meat',
    name: 'Side 2 – Meat Option',
    selection: 'one',
    required: true,
    posSourceId: 'pos-mg-side-meat',
    notes: 'Meat side for the breakfast plates — every order picks exactly one.',
    options: [
      {
        id: 'mg-side-meat-bacon',
        name: 'Bacon',
        posSourceId: 'pos-mg-side-meat-bacon',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-bacon' }, qty: { value: 70, unit: 'g' } },
        ],
      },
      {
        id: 'mg-side-meat-sausage',
        name: 'Sausage',
        posSourceId: 'pos-mg-side-meat-sausage',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-sausage-patty' }, qty: { value: 2, unit: 'each' } },
        ],
      },
      {
        id: 'mg-side-meat-andouille',
        name: 'Andouille',
        posSourceId: 'pos-mg-side-meat-andouille',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-andouille-sausage' }, qty: { value: 80, unit: 'g' } },
        ],
      },
      {
        id: 'mg-side-meat-ham',
        name: 'Ham',
        posSourceId: 'pos-mg-side-meat-ham',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-ham-sliced' }, qty: { value: 80, unit: 'g' } },
        ],
      },
      {
        id: 'mg-side-meat-chicken-sausage',
        name: 'Chicken Sausage',
        posSourceId: 'pos-mg-side-meat-chicken',
        effects: [
          { kind: 'add', ref: { kind: 'master', masterProductId: 'mp-chicken-sausage' }, qty: { value: 80, unit: 'g' } },
        ],
      },
    ],
  },
];
