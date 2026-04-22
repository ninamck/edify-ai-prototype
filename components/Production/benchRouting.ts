import type { Bench, Product } from './productionStore';

// Product → required capability tag. Until recipes are built out with step-
// level capability tags (Slice 2+ extension), this is the shortcut.
const PRODUCT_CAPABILITY: Record<string, string> = {
  'prd-banana-muffin':    'cap-bake',
  'prd-blueberry-muffin': 'cap-bake',
  'prd-almond-friand':    'cap-bake',
  'prd-choc-traybake':    'cap-bake',
  'prd-ham-croissant':    'cap-hot-line',
  'prd-chicken-pesto':    'cap-assembly',
  'prd-vegan-slaw':       'cap-assembly',
  'prd-coldbrew-tub':     'cap-cold-prep',
};

export function requiredCapabilityFor(productId: string): string | null {
  return PRODUCT_CAPABILITY[productId] ?? null;
}

export function benchesFor(productId: string, benches: readonly Bench[]): Bench[] {
  const cap = requiredCapabilityFor(productId);
  if (!cap) return [];
  return benches.filter(b => b.capabilityTagIds.includes(cap));
}

export function recommendedBench(
  productId: string,
  benches: readonly Bench[],
): Bench | null {
  return benchesFor(productId, benches)[0] ?? null;
}

// A product is "made" and therefore needs a bench. Stocked products don't.
export function isMadeProduct(product: Product): boolean {
  return product.type === 'made';
}
