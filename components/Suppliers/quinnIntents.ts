'use client';

/**
 * Quinn agent intents for the Suppliers area.
 *
 * Each intent is a pure function that takes a parameter object, looks at the
 * current store snapshot, and returns:
 *   - title:    short summary in plain English
 *   - preview:  bullet list of what will change ("Impact preview")
 *   - confirm:  the button label
 *   - commit:   side-effect that mutates the store and returns a snapshot
 *               for Undo. Returns null if there is nothing to do.
 *
 * Keeping the verbs in this file means the chat sheet can pick them by name
 * and either surface or shortcut the parameter step. The Bulk-edit bar uses
 * the same intents directly so the two surfaces stay in lock-step.
 */

import {
  snapshot, restore,
  setProducts, setSuppliers, upsertProduct, upsertSupplier, upsertMasterProduct,
  bulkUpdateProducts, deleteProduct,
  findSupplier,
} from './store';
import {
  type Product, type Supplier, type MasterProduct,
  type SupplierStatus, type ProductCategory, type ProductClass,
  formatPrice,
} from './fixtures';

export type IntentPreview = {
  title: string;
  preview: string[];
  confirmLabel: string;
  /**
   * Variant tells the chat panel how to colour the impact card.
   * 'warn' for destructive / large-blast operations, 'info' otherwise.
   */
  variant?: 'info' | 'warn';
};

export type IntentResult = {
  message: string;
  /** Snapshot taken BEFORE the commit so the toast Undo can restore it. */
  prevState: ReturnType<typeof snapshot>;
};

export type Intent = IntentPreview & {
  /** Returns null if the operation is a no-op (already in target state). */
  commit: () => IntentResult | null;
};

// ────────────────────────────────────────────────────────────────────────────
// Single-product intents

export function setProductAvailability(
  products: Product[],
  productId: string,
  next: SupplierStatus,
): Intent {
  const target = products.find((p) => p.id === productId);
  const name = target?.name ?? 'product';
  const isNoop = !target || target.status === next;
  return {
    title: `Mark "${name}" as ${next.toLowerCase()}`,
    preview: isNoop
      ? [`"${name}" is already ${next.toLowerCase()} — nothing to change.`]
      : [
          `"${name}" will move from ${target!.status} to ${next}.`,
          `Affects ${target!.sites.length} site${target!.sites.length === 1 ? '' : 's'}.`,
          'Open orders are not changed.',
        ],
    confirmLabel: `Mark ${next.toLowerCase()}`,
    variant: next === 'Unavailable' ? 'warn' : 'info',
    commit: () => {
      if (isNoop || !target) return null;
      const prev = snapshot();
      upsertProduct({ ...target, status: next });
      return { message: `Marked "${name}" ${next.toLowerCase()}`, prevState: prev };
    },
  };
}

export function setProductPrice(
  products: Product[],
  productId: string,
  newPackCost: number,
): Intent {
  const target = products.find((p) => p.id === productId);
  const name = target?.name ?? 'product';
  const delta = target ? newPackCost - target.packCost : 0;
  const pct = target && target.packCost > 0 ? (delta / target.packCost) * 100 : 0;
  return {
    title: `Update pack cost on "${name}" to ${formatPrice(newPackCost)}`,
    preview: target
      ? [
          `Was ${formatPrice(target.packCost)} → ${formatPrice(newPackCost)} (${delta >= 0 ? '+' : ''}${pct.toFixed(1)}%)`,
          `Future POs will use the new price; historic invoices unchanged.`,
          `Recipe COGS recalculated on next price refresh.`,
        ]
      : ['Product not found.'],
    confirmLabel: 'Apply price',
    variant: Math.abs(pct) > 10 ? 'warn' : 'info',
    commit: () => {
      if (!target || newPackCost === target.packCost) return null;
      const prev = snapshot();
      upsertProduct({ ...target, packCost: newPackCost });
      return { message: `Updated price on "${name}"`, prevState: prev };
    },
  };
}

export function linkProductToMaster(
  products: Product[],
  productId: string,
  masterId: string | null,
): Intent {
  const target = products.find((p) => p.id === productId);
  const name = target?.name ?? 'product';
  return {
    title: masterId
      ? `Link "${name}" to a Master Product`
      : `Unlink "${name}" from its Master Product`,
    preview: target
      ? [
          masterId
            ? `"${name}" will be matched to the master SKU so prices can be compared across suppliers.`
            : `"${name}" will no longer roll up to a Master Product. Comparison view will lose this row.`,
        ]
      : ['Product not found.'],
    confirmLabel: masterId ? 'Link master' : 'Unlink',
    commit: () => {
      if (!target) return null;
      if ((target.masterProductId ?? null) === masterId) return null;
      const prev = snapshot();
      upsertProduct({ ...target, masterProductId: masterId ?? undefined });
      return { message: masterId ? `Linked "${name}"` : `Unlinked "${name}"`, prevState: prev };
    },
  };
}

export function archiveProducts(products: Product[], ids: string[]): Intent {
  const targets = products.filter((p) => ids.includes(p.id));
  return {
    title: `Archive ${targets.length} product${targets.length === 1 ? '' : 's'}`,
    preview: [
      `${targets.length} product${targets.length === 1 ? '' : 's'} will be removed from the catalogue.`,
      'Open orders and historic invoices are not changed.',
      'Reversible from the Undo toast.',
    ],
    confirmLabel: `Archive ${targets.length}`,
    variant: 'warn',
    commit: () => {
      if (targets.length === 0) return null;
      const prev = snapshot();
      ids.forEach(deleteProduct);
      return {
        message: `Archived ${targets.length} product${targets.length === 1 ? '' : 's'}`,
        prevState: prev,
      };
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bulk product intents

type ProductPredicate = (p: Product) => boolean;

export function bulkSetAvailability(
  products: Product[],
  match: ProductPredicate,
  matchLabel: string,
  next: SupplierStatus,
): Intent {
  const matching = products.filter(match);
  const willChange = matching.filter((p) => p.status !== next);
  return {
    title: `Mark ${matchLabel} as ${next.toLowerCase()}`,
    preview: [
      `${matching.length} product${matching.length === 1 ? '' : 's'} match.`,
      `${willChange.length} will change status to ${next}.`,
      matching.length - willChange.length > 0
        ? `${matching.length - willChange.length} already ${next.toLowerCase()} (skipped).`
        : 'No skipped rows.',
    ],
    confirmLabel: `Mark ${willChange.length} ${next.toLowerCase()}`,
    variant: next === 'Unavailable' ? 'warn' : 'info',
    commit: () => {
      if (willChange.length === 0) return null;
      const prev = snapshot();
      const ids = new Set(willChange.map((p) => p.id));
      bulkUpdateProducts((p) => ids.has(p.id), (p) => ({ ...p, status: next }));
      return {
        message: `Marked ${willChange.length} product${willChange.length === 1 ? '' : 's'} ${next.toLowerCase()}`,
        prevState: prev,
      };
    },
  };
}

export function bulkAdjustPrice(
  products: Product[],
  match: ProductPredicate,
  matchLabel: string,
  pct: number,
): Intent {
  const matching = products.filter(match);
  const totalDelta = matching.reduce((sum, p) => sum + (p.packCost * pct) / 100, 0);
  return {
    title: `Adjust pack cost by ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% on ${matchLabel}`,
    preview: [
      `${matching.length} product${matching.length === 1 ? '' : 's'} affected.`,
      `Estimated total weekly impact: ${pct >= 0 ? '+' : ''}${formatPrice(totalDelta)} per pack-equivalent.`,
      `Historic invoices unchanged.`,
    ],
    confirmLabel: `Apply to ${matching.length}`,
    variant: Math.abs(pct) > 10 ? 'warn' : 'info',
    commit: () => {
      if (matching.length === 0 || pct === 0) return null;
      const prev = snapshot();
      const ids = new Set(matching.map((p) => p.id));
      bulkUpdateProducts(
        (p) => ids.has(p.id),
        (p) => ({ ...p, packCost: Math.round(p.packCost * (1 + pct / 100) * 100) / 100 }),
      );
      return {
        message: `Adjusted price on ${matching.length} product${matching.length === 1 ? '' : 's'}`,
        prevState: prev,
      };
    },
  };
}

export function bulkSetSites(
  products: Product[],
  match: ProductPredicate,
  matchLabel: string,
  sites: string[],
): Intent {
  const matching = products.filter(match);
  return {
    title: `Set site availability on ${matchLabel}`,
    preview: [
      `${matching.length} product${matching.length === 1 ? '' : 's'} affected.`,
      `Will be available at ${sites.length} site${sites.length === 1 ? '' : 's'}.`,
    ],
    confirmLabel: `Apply to ${matching.length}`,
    variant: 'info',
    commit: () => {
      if (matching.length === 0) return null;
      const prev = snapshot();
      const ids = new Set(matching.map((p) => p.id));
      bulkUpdateProducts((p) => ids.has(p.id), (p) => ({ ...p, sites: [...sites] }));
      return {
        message: `Updated sites on ${matching.length} product${matching.length === 1 ? '' : 's'}`,
        prevState: prev,
      };
    },
  };
}

export function bulkReassignSupplier(
  products: Product[],
  match: ProductPredicate,
  matchLabel: string,
  toSupplierId: string,
): Intent {
  const matching = products.filter(match);
  const dest = findSupplier(toSupplierId);
  return {
    title: `Reassign ${matchLabel} to ${dest?.name ?? 'another supplier'}`,
    preview: [
      `${matching.length} product${matching.length === 1 ? '' : 's'} will move to ${dest?.name ?? 'the new supplier'}.`,
      `Open orders stay with the original supplier; new orders use ${dest?.name ?? 'the new supplier'}.`,
    ],
    confirmLabel: `Move ${matching.length}`,
    variant: 'warn',
    commit: () => {
      if (matching.length === 0 || !dest) return null;
      const prev = snapshot();
      const ids = new Set(matching.map((p) => p.id));
      bulkUpdateProducts((p) => ids.has(p.id), (p) => ({ ...p, supplierId: toSupplierId }));
      return {
        message: `Reassigned ${matching.length} product${matching.length === 1 ? '' : 's'} to ${dest.name}`,
        prevState: prev,
      };
    },
  };
}

export function bulkSetCategory(
  products: Product[],
  match: ProductPredicate,
  matchLabel: string,
  category: ProductCategory,
): Intent {
  const matching = products.filter(match);
  const willChange = matching.filter((p) => p.category !== category);
  return {
    title: `Set category on ${matchLabel} to ${category}`,
    preview: [
      `${matching.length} product${matching.length === 1 ? '' : 's'} match.`,
      `${willChange.length} will change category.`,
    ],
    confirmLabel: `Apply to ${willChange.length}`,
    commit: () => {
      if (willChange.length === 0) return null;
      const prev = snapshot();
      const ids = new Set(willChange.map((p) => p.id));
      bulkUpdateProducts((p) => ids.has(p.id), (p) => ({ ...p, category }));
      return {
        message: `Re-categorised ${willChange.length} product${willChange.length === 1 ? '' : 's'} as ${category}`,
        prevState: prev,
      };
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Supplier intents

export function setSupplierStatus(
  suppliers: Supplier[],
  supplierId: string,
  next: SupplierStatus,
): Intent {
  const target = suppliers.find((s) => s.id === supplierId);
  const name = target?.name ?? 'supplier';
  const isNoop = !target || target.status === next;
  return {
    title: `Mark supplier "${name}" as ${next.toLowerCase()}`,
    preview: isNoop
      ? [`Supplier is already ${next.toLowerCase()}.`]
      : [
          `Status moves from ${target!.status} to ${next}.`,
          next === 'Unavailable'
            ? 'All this supplier\u2019s products will be hidden from new orders until re-enabled.'
            : 'Products under this supplier become orderable again.',
        ],
    confirmLabel: `Mark ${next.toLowerCase()}`,
    variant: next === 'Unavailable' ? 'warn' : 'info',
    commit: () => {
      if (isNoop || !target) return null;
      const prev = snapshot();
      upsertSupplier({ ...target, status: next });
      return { message: `Marked supplier "${name}" ${next.toLowerCase()}`, prevState: prev };
    },
  };
}

export function updateSupplierCutoff(
  suppliers: Supplier[],
  supplierId: string,
  cutOffTime: string,
): Intent {
  const target = suppliers.find((s) => s.id === supplierId);
  const name = target?.name ?? 'supplier';
  return {
    title: `Update "${name}" cut-off to ${cutOffTime}`,
    preview: target
      ? [
          `Was ${target.cutOffTime ?? 'not set'} → ${cutOffTime}.`,
          'Order suggestions will use the new cut-off from tomorrow onwards.',
        ]
      : ['Supplier not found.'],
    confirmLabel: 'Update cut-off',
    commit: () => {
      if (!target || target.cutOffTime === cutOffTime) return null;
      const prev = snapshot();
      upsertSupplier({ ...target, cutOffTime });
      return { message: `Cut-off updated for "${name}"`, prevState: prev };
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Master Product intents

export function createMasterProduct(mp: MasterProduct, linkProductIds: string[], products: Product[]): Intent {
  const linkedProducts = products.filter((p) => linkProductIds.includes(p.id));
  return {
    title: `Create Master Product "${mp.name}"`,
    preview: [
      `New cross-supplier reference SKU: ${mp.name} (${mp.unit}).`,
      linkedProducts.length > 0
        ? `${linkedProducts.length} existing supplier product${linkedProducts.length === 1 ? '' : 's'} will link to it.`
        : 'No supplier products will be linked yet.',
    ],
    confirmLabel: 'Create master',
    commit: () => {
      const prev = snapshot();
      upsertMasterProduct(mp);
      if (linkedProducts.length > 0) {
        const ids = new Set(linkProductIds);
        bulkUpdateProducts((p) => ids.has(p.id), (p) => ({ ...p, masterProductId: mp.id }));
      }
      return { message: `Created Master Product "${mp.name}"`, prevState: prev };
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Undo helper

export function undo(prev: ReturnType<typeof snapshot>): void {
  restore(prev);
}

// ────────────────────────────────────────────────────────────────────────────
// Re-export so callers can build their own ad-hoc intents without poking at
// the store directly.
export { snapshot, setProducts, setSuppliers, upsertProduct, upsertSupplier };
export type { Product, Supplier, MasterProduct, SupplierStatus, ProductCategory, ProductClass };
