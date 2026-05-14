/**
 * Modifier groups — the catalogue-level concept that maps onto how POS
 * systems already think about menus.
 *
 * A `ModifierGroup` is owned outside the recipe (and outside the menu
 * item). The same group can be attached to many menu items at once —
 * that's the whole point. Add a new alternative milk in *one* place
 * and every coffee that points at the "Alt milks" group picks it up.
 *
 * Each group has options. Each option carries one or more
 * `IngredientEffect`s that say what changes when the option is chosen
 * at order time. The `set-slot` effect targets a named *slot* on the
 * menu item rather than a specific master product — that's the unlock
 * for "Spirit measure" applying to every spirit menu item without
 * naming Smirnoff or Grey Goose.
 */

import type { IngredientRef } from '@/components/Ingredients/catalogue';

export type Quantity = { value: number; unit: string };

/**
 * One concrete change a modifier option makes to a recipe at order time.
 *
 *   - `add`       add a new ingredient to the resolved composition
 *   - `replace`   swap one ingredient for another (same qty, or new qty)
 *   - `scale`     multiply quantities by a factor (whole recipe or
 *                 specific master products)
 *   - `set-slot`  set the qty (and optionally the ingredient) of a
 *                 named slot on the parent menu item — the slot
 *                 indirection is what lets one shared modifier group
 *                 attach to many menu items
 */
export type IngredientEffect =
  | { kind: 'add'; ref: IngredientRef; qty: Quantity }
  | {
      kind: 'replace';
      from: IngredientRef;
      to: IngredientRef;
      qtyMode: 'same' | { qty: Quantity };
    }
  | {
      kind: 'scale';
      factor: number;
      /** When set, scale only the listed master products. Omit to scale
       *  the whole recipe. */
      targetMasterProductIds?: string[];
    }
  | {
      kind: 'set-slot';
      slotKey: string;
      qty?: Quantity;
      /** Optional override of the slot's default ingredient. */
      ref?: IngredientRef;
    };

export type ModifierOption = {
  id: string;
  name: string;
  /** Optional price delta applied to the parent menu item's selling price. */
  priceDelta?: number;
  /** Defaults to false. When true, this option is selected by default. */
  isDefault?: boolean;
  effects: IngredientEffect[];
  /** Upstream POS identifier for this option (e.g. Square modifier id).
   *  Stored on the option itself rather than in a separate mapping
   *  table — same pattern as variant options. */
  posSourceId?: string;
};

export type ModifierGroup = {
  id: string;
  name: string;
  /** Whether the customer must choose one option (or many). */
  selection: 'one' | 'many';
  /** When true, an option must be picked. */
  required: boolean;
  options: ModifierOption[];
  /** Optional POS source identifier so a single Edify group can be
   *  shown to have come from / mapped to a POS modifier group. */
  posSourceId?: string;
  /** Free-text description — surfaces in the editor and the menu-item
   *  preview. */
  notes?: string;
};
