import type {
  DemandLine,
  DemandSource,
  Product,
  ProductionRun,
  Site,
} from './productionStore';

export type MatrixCell = {
  qty: number;
  sources: DemandSource[];
  hasForecast: boolean;
  hasCommitted: boolean;
  hasCatering: boolean;
};

export type MatrixRow = {
  productId: string;
  product: Product | undefined;
  /** keyed by siteId; missing key = no demand for that spoke */
  bySite: Map<string, MatrixCell>;
  total: number;
  committedTotal: number;
  forecastTotal: number;
  priority: boolean;
  demandLineIds: string[];
};

export type ProductMatrix = {
  /** Destination spokes in display order (already filtered to ones with demand). */
  siteIds: string[];
  /** Rows sorted: priority first, then name. */
  rows: MatrixRow[];
  /** Column-wise totals (all sources) for the footer. */
  siteTotals: Map<string, number>;
  /** Column-wise totals excluding pure-forecast cells — for when the Planner hides forecast. */
  siteCommittedTotals: Map<string, number>;
  grandTotal: number;
  grandCommittedTotal: number;
};

function classifyCell(sources: DemandSource[]): {
  hasForecast: boolean;
  hasCommitted: boolean;
  hasCatering: boolean;
} {
  return {
    hasForecast: sources.includes('forecast'),
    hasCatering: sources.includes('catering'),
    hasCommitted: sources.includes('spoke_order') || sources.includes('catering') || sources.includes('manual'),
  };
}

/**
 * Aggregate a set of demand lines into a product × spoke matrix.
 * Keeps the sources so cells can render forecast/committed/catering distinctly.
 */
export function buildMatrix(
  demandLines: readonly DemandLine[],
  products: readonly Product[],
  allSites: readonly Site[],
): ProductMatrix {
  // Group by product, then by site
  const byProduct = new Map<string, Map<string, { qty: number; sources: DemandSource[] }>>();
  const demandLineIdsByProduct = new Map<string, string[]>();

  for (const d of demandLines) {
    let pmap = byProduct.get(d.productId);
    if (!pmap) {
      pmap = new Map();
      byProduct.set(d.productId, pmap);
    }
    const existing = pmap.get(d.siteId);
    if (existing) {
      existing.qty += d.quantity;
      if (!existing.sources.includes(d.source)) existing.sources.push(d.source);
    } else {
      pmap.set(d.siteId, { qty: d.quantity, sources: [d.source] });
    }
    const ids = demandLineIdsByProduct.get(d.productId) ?? [];
    ids.push(d.id);
    demandLineIdsByProduct.set(d.productId, ids);
  }

  // Determine the site columns actually in use, ordered by allSites order
  const usedSiteIds = new Set<string>();
  for (const pmap of byProduct.values()) {
    for (const siteId of pmap.keys()) usedSiteIds.add(siteId);
  }
  const siteIds = allSites
    .filter(s => usedSiteIds.has(s.id) && s.kind === 'spoke')
    .map(s => s.id);

  // Build rows
  const rows: MatrixRow[] = [];
  const siteTotals = new Map<string, number>();
  const siteCommittedTotals = new Map<string, number>();
  let grandTotal = 0;
  let grandCommittedTotal = 0;

  for (const [productId, pmap] of byProduct.entries()) {
    const product = products.find(p => p.id === productId);
    const bySite = new Map<string, MatrixCell>();
    let total = 0;
    let committedTotal = 0;
    let forecastTotal = 0;

    for (const [siteId, { qty, sources }] of pmap.entries()) {
      const { hasForecast, hasCommitted, hasCatering } = classifyCell(sources);
      bySite.set(siteId, { qty, sources, hasForecast, hasCommitted, hasCatering });
      total += qty;
      const isPureForecast = hasForecast && !hasCommitted;
      if (isPureForecast) forecastTotal += qty;
      else committedTotal += qty;

      siteTotals.set(siteId, (siteTotals.get(siteId) ?? 0) + qty);
      if (!isPureForecast) {
        siteCommittedTotals.set(siteId, (siteCommittedTotals.get(siteId) ?? 0) + qty);
      }
    }

    grandTotal += total;
    grandCommittedTotal += committedTotal;

    rows.push({
      productId,
      product,
      bySite,
      total,
      committedTotal,
      forecastTotal,
      priority: product?.priorityFlag ?? false,
      demandLineIds: demandLineIdsByProduct.get(productId) ?? [],
    });
  }

  // Sort: priority first, then by product name.
  rows.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return (a.product?.name ?? '').localeCompare(b.product?.name ?? '');
  });

  return { siteIds, rows, siteTotals, siteCommittedTotals, grandTotal, grandCommittedTotal };
}

/** Short 2-3 letter code for a site column header — initials of the name. */
export function siteCode(site: Site): string {
  const parts = site.name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return site.name.slice(0, 2).toUpperCase();
}
