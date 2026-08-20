'use client';

/**
 * Scripted Quinn flows for the Suppliers area.
 *
 * Each flow is built from `Step` nodes. A `quinn` step shows a Quinn message
 * plus tappable option pills; an `apply` step shows an intent preview with
 * Confirm/Not now; a `success` step renders the final green banner.
 *
 * Flows are pure functions over the current store snapshot — they don't
 * perform mutations themselves. The QuinnSheet runs the intent commits when
 * the user confirms.
 */

import {
  setProductAvailability,
  setProductPrice,
  linkProductToMaster,
  archiveProducts,
  bulkSetAvailability,
  bulkAdjustPrice,
  bulkReassignSupplier,
  bulkSetCategory,
  setSupplierStatus,
  updateSupplierCutoff,
  type Intent,
} from './quinnIntents';
import {
  type Product, type Supplier, type MasterProduct,
  type ProductCategory,
  ALL_CATEGORIES,
} from './fixtures';

export type Option = { label: string; emphasis?: 'primary' | 'danger'; next: () => Step };

export type Step =
  | { kind: 'quinn'; text: string; options: Option[]; helper?: string }
  | { kind: 'apply'; intent: Intent; backLabel?: string; back?: () => Step }
  | { kind: 'success'; message: string };

export type FlowContext = {
  products: Product[];
  suppliers: Supplier[];
  masterProducts: MasterProduct[];
};

// ────────────────────────────────────────────────────────────────────────────
// Single product — opens when Quinn is invoked from a product row

export function startProductScopedFlow(
  ctx: FlowContext,
  productId: string,
): Step {
  const product = ctx.products.find((p) => p.id === productId);
  if (!product) {
    return {
      kind: 'quinn',
      text: 'I couldn\u2019t find that product. Pick another action below.',
      options: globalEntryOptions(ctx),
    };
  }
  const supplier = ctx.suppliers.find((s) => s.id === product.supplierId);
  return {
    kind: 'quinn',
    text: `What should I do with **${product.name}**?`,
    helper: `From ${supplier?.name ?? 'unknown supplier'} \u00b7 ${product.sites.length} site${product.sites.length === 1 ? '' : 's'} \u00b7 ${product.status}`,
    options: [
      product.status === 'Available'
        ? { label: 'Mark unavailable', emphasis: 'danger', next: () => previewStep(setProductAvailability(ctx.products, productId, 'Unavailable'), () => startProductScopedFlow(ctx, productId)) }
        : { label: 'Mark available', emphasis: 'primary', next: () => previewStep(setProductAvailability(ctx.products, productId, 'Available'), () => startProductScopedFlow(ctx, productId)) },
      { label: 'Update price', next: () => askPriceStep(ctx, productId) },
      { label: 'Link to a Master Product', next: () => pickMasterStep(ctx, productId) },
      { label: 'Archive this product', emphasis: 'danger', next: () => previewStep(archiveProducts(ctx.products, [productId]), () => startProductScopedFlow(ctx, productId)) },
    ],
  };
}

function askPriceStep(ctx: FlowContext, productId: string): Step {
  const product = ctx.products.find((p) => p.id === productId)!;
  const cur = product.packCost;
  return {
    kind: 'quinn',
    text: `Current pack cost is **$${cur.toFixed(2)}**. Pick a new price or pick a percentage adjustment.`,
    options: [
      { label: `$${(cur * 0.95).toFixed(2)} (-5%)`, next: () => previewStep(setProductPrice(ctx.products, productId, +(cur * 0.95).toFixed(2)), () => startProductScopedFlow(ctx, productId)) },
      { label: `$${(cur * 1.05).toFixed(2)} (+5%)`, next: () => previewStep(setProductPrice(ctx.products, productId, +(cur * 1.05).toFixed(2)), () => startProductScopedFlow(ctx, productId)) },
      { label: `$${(cur * 1.1).toFixed(2)} (+10%)`, next: () => previewStep(setProductPrice(ctx.products, productId, +(cur * 1.1).toFixed(2)), () => startProductScopedFlow(ctx, productId)) },
      { label: 'Match latest invoice (auto)', next: () => previewStep(setProductPrice(ctx.products, productId, +(cur * 1.03).toFixed(2)), () => startProductScopedFlow(ctx, productId)) },
      { label: 'Back', next: () => startProductScopedFlow(ctx, productId) },
    ],
  };
}

function pickMasterStep(ctx: FlowContext, productId: string): Step {
  const product = ctx.products.find((p) => p.id === productId)!;
  // Suggest master products in the same category first.
  const sameCat = ctx.masterProducts.filter((m) => m.category === product.category);
  const others = ctx.masterProducts.filter((m) => m.category !== product.category);
  const ranked = [...sameCat, ...others].slice(0, 5);
  return {
    kind: 'quinn',
    text: 'Which Master Product matches this SKU? I\u2019ve put likely matches first.',
    helper: 'Master Products let you compare prices across suppliers for the same item.',
    options: [
      ...ranked.map((m) => ({
        label: `${m.name} \u00b7 ${m.unit}`,
        next: () => previewStep(linkProductToMaster(ctx.products, productId, m.id), () => startProductScopedFlow(ctx, productId)),
      })),
      ...(product.masterProductId ? [{ label: 'Unlink current master', emphasis: 'danger' as const, next: () => previewStep(linkProductToMaster(ctx.products, productId, null), () => startProductScopedFlow(ctx, productId)) }] : []),
      { label: 'Back', next: () => startProductScopedFlow(ctx, productId) },
    ],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Single supplier — opens when Quinn is invoked from a supplier row

export function startSupplierScopedFlow(ctx: FlowContext, supplierId: string): Step {
  const supplier = ctx.suppliers.find((s) => s.id === supplierId);
  if (!supplier) {
    return {
      kind: 'quinn',
      text: 'I couldn\u2019t find that supplier.',
      options: globalEntryOptions(ctx),
    };
  }
  const productCount = ctx.products.filter((p) => p.supplierId === supplierId).length;
  return {
    kind: 'quinn',
    text: `What should I do with **${supplier.name}**?`,
    helper: `${productCount} product${productCount === 1 ? '' : 's'} \u00b7 ${supplier.sites.length} site${supplier.sites.length === 1 ? '' : 's'} \u00b7 ${supplier.status}`,
    options: [
      supplier.status === 'Available'
        ? { label: 'Mark supplier unavailable', emphasis: 'danger', next: () => previewStep(setSupplierStatus(ctx.suppliers, supplierId, 'Unavailable'), () => startSupplierScopedFlow(ctx, supplierId)) }
        : { label: 'Mark supplier available', emphasis: 'primary', next: () => previewStep(setSupplierStatus(ctx.suppliers, supplierId, 'Available'), () => startSupplierScopedFlow(ctx, supplierId)) },
      { label: 'Update cut-off time', next: () => askCutoffStep(ctx, supplierId) },
      { label: 'Mark all this supplier\u2019s products unavailable', emphasis: 'danger', next: () => previewStep(bulkSetAvailability(ctx.products, (p) => p.supplierId === supplierId, `every product from ${supplier.name}`, 'Unavailable'), () => startSupplierScopedFlow(ctx, supplierId)) },
      { label: 'Adjust all prices +5%', next: () => previewStep(bulkAdjustPrice(ctx.products, (p) => p.supplierId === supplierId, `every product from ${supplier.name}`, 5), () => startSupplierScopedFlow(ctx, supplierId)) },
    ],
  };
}

function askCutoffStep(ctx: FlowContext, supplierId: string): Step {
  return {
    kind: 'quinn',
    text: 'Pick a new cut-off time:',
    options: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((t) => ({
      label: t,
      next: () => previewStep(updateSupplierCutoff(ctx.suppliers, supplierId, t), () => startSupplierScopedFlow(ctx, supplierId)),
    })).concat([{ label: 'Back', next: () => startSupplierScopedFlow(ctx, supplierId) }]),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Bulk-selection — opens when the bulk bar invokes Quinn with N selected

export function startBulkProductFlow(
  ctx: FlowContext,
  selectedIds: string[],
): Step {
  const matching = ctx.products.filter((p) => selectedIds.includes(p.id));
  const label = `the ${matching.length} selected product${matching.length === 1 ? '' : 's'}`;
  const idSet = new Set(selectedIds);
  const match = (p: Product) => idSet.has(p.id);
  return {
    kind: 'quinn',
    text: `What should I do across ${label}?`,
    helper: `Tap an option to preview the change before it commits.`,
    options: [
      { label: 'Mark all unavailable', emphasis: 'danger', next: () => previewStep(bulkSetAvailability(ctx.products, match, label, 'Unavailable'), () => startBulkProductFlow(ctx, selectedIds)) },
      { label: 'Mark all available', emphasis: 'primary', next: () => previewStep(bulkSetAvailability(ctx.products, match, label, 'Available'), () => startBulkProductFlow(ctx, selectedIds)) },
      { label: 'Adjust prices by \u2026', next: () => bulkAskPctStep(ctx, selectedIds) },
      { label: 'Change category to \u2026', next: () => bulkAskCategoryStep(ctx, selectedIds) },
      { label: 'Reassign to another supplier \u2026', next: () => bulkAskSupplierStep(ctx, selectedIds) },
      { label: 'Archive selection', emphasis: 'danger', next: () => previewStep(archiveProducts(ctx.products, selectedIds), () => startBulkProductFlow(ctx, selectedIds)) },
    ],
  };
}

function bulkAskPctStep(ctx: FlowContext, selectedIds: string[]): Step {
  const idSet = new Set(selectedIds);
  const match = (p: Product) => idSet.has(p.id);
  const label = `the ${selectedIds.length} selected`;
  return {
    kind: 'quinn',
    text: 'By how much?',
    options: [
      ...[-10, -5, +5, +10].map((pct) => ({
        label: `${pct >= 0 ? '+' : ''}${pct}%`,
        next: () => previewStep(bulkAdjustPrice(ctx.products, match, label, pct), () => startBulkProductFlow(ctx, selectedIds)),
      })),
      { label: 'Back', next: () => startBulkProductFlow(ctx, selectedIds) },
    ],
  };
}

function bulkAskCategoryStep(ctx: FlowContext, selectedIds: string[]): Step {
  const idSet = new Set(selectedIds);
  const match = (p: Product) => idSet.has(p.id);
  const label = `the ${selectedIds.length} selected`;
  return {
    kind: 'quinn',
    text: 'Pick the new category:',
    options: [
      ...ALL_CATEGORIES.map((c: ProductCategory) => ({
        label: c,
        next: () => previewStep(bulkSetCategory(ctx.products, match, label, c), () => startBulkProductFlow(ctx, selectedIds)),
      })),
      { label: 'Back', next: () => startBulkProductFlow(ctx, selectedIds) },
    ],
  };
}

function bulkAskSupplierStep(ctx: FlowContext, selectedIds: string[]): Step {
  const idSet = new Set(selectedIds);
  const match = (p: Product) => idSet.has(p.id);
  const label = `the ${selectedIds.length} selected`;
  // Hide the supplier(s) the products currently belong to so the choice is meaningful.
  const currentSupplierIds = new Set(ctx.products.filter((p) => idSet.has(p.id)).map((p) => p.supplierId));
  const candidates = ctx.suppliers.filter((s) => !currentSupplierIds.has(s.id)).slice(0, 6);
  return {
    kind: 'quinn',
    text: 'Move them to which supplier?',
    options: [
      ...candidates.map((s) => ({
        label: s.name,
        next: () => previewStep(bulkReassignSupplier(ctx.products, match, label, s.id), () => startBulkProductFlow(ctx, selectedIds)),
      })),
      { label: 'Back', next: () => startBulkProductFlow(ctx, selectedIds) },
    ],
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Global entry — opens when Quinn is invoked from the hero with no scope

export function startGlobalFlow(ctx: FlowContext, seed?: string): Step {
  // Tiny "natural language" router. In a real build this would be an LLM
  // intent classifier; here we keyword-match to demo the interaction shape.
  if (seed) {
    const s = seed.toLowerCase();
    const supplier = ctx.suppliers.find((sup) => s.includes(sup.name.toLowerCase()));
    if (supplier && (s.includes('cutoff') || s.includes('cut off') || s.includes('cut-off'))) {
      return askCutoffStep(ctx, supplier.id);
    }
    if (supplier && (s.includes('unavailable') || s.includes('disable'))) {
      return previewStep(
        bulkSetAvailability(ctx.products, (p) => p.supplierId === supplier.id, `every product from ${supplier.name}`, 'Unavailable'),
        () => startGlobalFlow(ctx),
      );
    }
    if (s.includes('duplicate')) {
      return findDuplicatesStep(ctx);
    }
    if (s.includes('add') && s.includes('supplier')) {
      return addSupplierIntroStep();
    }
    if (s.includes('price') && s.includes('+5')) {
      return previewStep(
        bulkAdjustPrice(ctx.products, () => true, 'every product', 5),
        () => startGlobalFlow(ctx),
      );
    }
    return {
      kind: 'quinn',
      text: `I read that as \u201c${seed}\u201d. Pick the closest action and I\u2019ll take it from there:`,
      options: globalEntryOptions(ctx),
    };
  }
  return {
    kind: 'quinn',
    text: 'What can I help you do?',
    helper: 'Tap an option, or type a sentence in the box above and I\u2019ll figure out what you mean.',
    options: globalEntryOptions(ctx),
  };
}

function globalEntryOptions(ctx: FlowContext): Option[] {
  return [
    { label: 'Add a new supplier', next: () => addSupplierIntroStep() },
    { label: 'Find duplicate products', next: () => findDuplicatesStep(ctx) },
    {
      label: 'Bulk update prices',
      next: () => ({
        kind: 'quinn' as const,
        text: 'Across which scope?',
        options: ctx.suppliers.slice(0, 4).map((s) => ({
          label: `Every ${s.name} product`,
          next: () => ({
            kind: 'quinn' as const,
            text: 'By how much?',
            options: [-5, +5, +10].map((pct) => ({
              label: `${pct >= 0 ? '+' : ''}${pct}%`,
              next: () => previewStep(
                bulkAdjustPrice(ctx.products, (p) => p.supplierId === s.id, `every product from ${s.name}`, pct),
                () => startGlobalFlow(ctx),
              ),
            })),
          }),
        })),
      }),
    },
    {
      label: 'Mark a supplier unavailable',
      next: () => ({
        kind: 'quinn' as const,
        text: 'Which supplier?',
        options: ctx.suppliers.slice(0, 6).map((s) => ({
          label: s.name,
          next: () => startSupplierScopedFlow(ctx, s.id),
        })),
      }),
    },
  ];
}

function findDuplicatesStep(ctx: FlowContext): Step {
  // Naive "duplicate" detection: products that share a master product id.
  const byMaster = new Map<string, Product[]>();
  for (const p of ctx.products) {
    if (!p.masterProductId) continue;
    const arr = byMaster.get(p.masterProductId) ?? [];
    arr.push(p);
    byMaster.set(p.masterProductId, arr);
  }
  const duplicates = [...byMaster.values()].filter((arr) => arr.length > 1);
  const total = duplicates.reduce((sum, arr) => sum + arr.length, 0);
  return {
    kind: 'quinn',
    text: duplicates.length === 0
      ? 'No duplicates found \u2014 every Master Product has at most one supplier SKU. Nice and clean.'
      : `I found **${duplicates.length} master product${duplicates.length === 1 ? '' : 's'}** with more than one supplier SKU (${total} SKUs total). That\u2019s how price comparison works \u2014 nothing to clean up unless you want to merge duplicates from the same supplier.`,
    options: [
      { label: 'Show me the comparison view', next: () => ({ kind: 'success', message: 'Open Master products tab to see side-by-side prices.' }) },
      { label: 'Back', next: () => startGlobalFlow(ctx) },
    ],
  };
}

function addSupplierIntroStep(): Step {
  return {
    kind: 'quinn',
    text: 'I\u2019ll start a new supplier draft. Open the form to fill in the basics?',
    options: [
      { label: 'Open the new supplier form', emphasis: 'primary', next: () => ({ kind: 'success', message: 'New supplier draft opened. Fill in the basics and Edify will validate.' }) },
      { label: 'Cancel', next: () => ({ kind: 'success', message: 'No changes made.' }) },
    ],
  };
}

// ────────────────────────────────────────────────────────────────────────────

function previewStep(intent: Intent, back: () => Step): Step {
  return { kind: 'apply', intent, backLabel: 'Pick something else', back };
}
