/**
 * Shared ingredient costing.
 *
 * Master-product WACs (`siteCosts`) are stored per master `unit`, which
 * is a pack-style string like "1kg bag", "1L carton", "pack of 24",
 * "each" or "egg". Recipe rows quote quantities in base units (g / ml /
 * each). This module bridges the two: it parses the master unit string
 * to work out how many base units one WAC covers, and derives a per-g /
 * per-ml / per-each cost from there.
 *
 *   unitCostGBP(ref)   → $ per base unit (g / ml / each), or null when
 *                        no cost is known yet ("estimated" masters).
 *   lineCostGBP(row)   → $ for a RecipeIngredient line (qty × unit cost,
 *                        with kg→g / L→ml conversion on the qty side).
 */

import {
  masterCompanyAvg,
  type MasterProduct,
  type Product,
} from '@/components/Suppliers/fixtures';
import {
  resolveIngredientRef,
  type IngredientRef,
} from '@/components/Ingredients/catalogue';
import type { RecipeIngredient } from './libraryFixtures';

/** How many base units (g / ml / each) one master `unit` represents.
 *  "1kg bag" → 1000 (g) · "1L carton" → 1000 (ml) · "pack of 24" → 24
 *  (each) · "each" / "egg" / unparseable → 1. */
function baseUnitsPerMasterUnit(unit: string): number {
  const pack = unit.match(/pack of (\d+)/i);
  if (pack) return Number(pack[1]);
  const measure = unit.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/i);
  if (measure) {
    const value = Number(measure[1]);
    const uom = measure[2].toLowerCase();
    if (uom === 'kg' || uom === 'l') return value * 1000;
    return value;
  }
  return 1;
}

function masterUnitCost(m: MasterProduct): number | null {
  const wac = masterCompanyAvg(m);
  if (wac == null || wac <= 0) return null;
  return wac / baseUnitsPerMasterUnit(m.unit);
}

function productUnitCost(p: Product): number | null {
  if (!p.packCost) return null;
  const totalUnits = p.packQty * (p.singleUnitVolumeOrWeight || 1);
  return totalUnits > 0 ? p.packCost / totalUnits : null;
}

/** $ per base unit (g / ml / each) for an ingredient ref, or null when
 *  no cost is known. Sub-recipes use their seeded per-serve cost. */
export function unitCostGBP(ref: IngredientRef): number | null {
  const resolved = resolveIngredientRef(ref);
  if (!resolved) return null;
  if (resolved.subRecipe) {
    return resolved.subRecipe.ingredientCost > 0 ? resolved.subRecipe.ingredientCost : null;
  }
  if (resolved.master) {
    const fromMaster = masterUnitCost(resolved.master);
    if (fromMaster != null) return fromMaster;
  }
  if (resolved.product) return productUnitCost(resolved.product);
  return null;
}

/** Recipe qty units → base units (g / ml / each). */
const QTY_UNIT_FACTOR: Record<string, number> = { kg: 1000, L: 1000, l: 1000 };

/** $ for one RecipeIngredient line at its base quantity. */
export function lineCostGBP(row: RecipeIngredient): number | null {
  const unit = unitCostGBP(row.ref);
  if (unit == null) return null;
  const factor = QTY_UNIT_FACTOR[row.baseQty.unit] ?? 1;
  return row.baseQty.value * factor * unit;
}

/** "$1.23", or an em-dash when the cost is unknown. */
export function formatLineCost(n: number | null): string {
  return n == null ? '—' : `$${n.toFixed(2)}`;
}
