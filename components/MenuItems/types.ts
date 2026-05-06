/**
 * Menu Item — the POS-visible thing the customer orders.
 *
 * A MenuItem carries:
 *   - an optional `defaultRecipeId` for items that have a base recipe
 *     (e.g. Latte → "Latte recipe"). When absent, the item is
 *     **modifier-driven** — every order picks an option from one or
 *     more required modifier groups (e.g. Sauvignon Blanc, where
 *     pour size is always specified).
 *   - one or more `slots` — named ingredient placeholders that
 *     `set-slot` modifier effects can target. This is the trick
 *     that lets a single shared modifier group ("Spirit measure
 *     25/50ml") apply to every spirit menu item without naming
 *     Smirnoff vs Grey Goose explicitly.
 *   - a list of `modifierGroupIds` attached, referencing entries in
 *     the catalogue-level Modifier Groups store.
 *   - `posSourceId` / `posLinked` to track the underlying POS item.
 */

import type { IngredientRef } from '@/components/Ingredients/catalogue';

export type MenuItemSlot = {
  /** Stable key used by `set-slot` modifier effects. */
  key: string;
  /** Human-readable label rendered in the editor + preview. */
  label: string;
  /** The default ingredient that fills this slot (e.g. "Smirnoff
   *  Vodka" for the spirit slot of the Smirnoff menu item). */
  defaultRef?: IngredientRef;
  /** Default qty if no modifier sets one. Often left blank for
   *  modifier-driven items where size is required. */
  defaultQty?: { value: number; unit: string };
};

export type MenuItemCategory =
  | 'Coffee' | 'Tea' | 'Pastry' | 'Food' | 'Wine' | 'Spirits' | 'Kids'
  | 'Bakery' | 'Sandwich' | 'Salad' | 'Snack' | 'Beverage';

export type MenuItem = {
  id: string;
  name: string;
  category: MenuItemCategory;
  /** When set, this recipe provides the base composition. When unset,
   *  the item is purely modifier-driven (composition comes from
   *  set-slot effects on selected options). */
  defaultRecipeId?: string;
  slots: MenuItemSlot[];
  modifierGroupIds: string[];
  /** Selling price (ex VAT) at which this item lists. Modifier
   *  options can carry `priceDelta` against this. */
  basePrice?: number;
  posSourceId?: string;
  posLinked: boolean;
  status: 'Active' | 'Draft' | 'Archived';
  /** Optional free-text description shown in editor + drawers. */
  notes?: string;
};
