import type { StockItem, StockStatus } from './status';

export interface CtaConfig {
  primary: { label: string; href: string };
  secondaries: Array<{ label: string; href: string }>;
}

// Each status maps to a primary action + 1-2 secondaries. CTAs push to
// existing routes with a prefill query param so the demo click-through
// reads correctly — the receiving page consuming the prefill is a
// follow-up; landing on the right surface is what carries the story.
//
// Healthy items get a sensible default set (no primary) so the drawer
// still offers useful actions when the operator opens an OK row.

export function ctaConfigFor(status: StockStatus, item: StockItem): CtaConfig {
  const ing = encodeURIComponent(item.id);
  // "Run mid-week count" used to deep-link to a standalone
  // /stock-count route. Stocktake now lives as a tab on /stock, so the
  // CTAs route there with a `tab=stocktake` hint; future work can have
  // the stock page read that query and auto-open the Stocktake tab.
  const stocktakeHref = `/stock?tab=stocktake&prefill=${ing}`;

  switch (status) {
    case 'stockout':
      return {
        primary: {
          label: 'Add to next order',
          href: `/assisted-ordering?prefill=${ing}`,
        },
        secondaries: [
          { label: 'Run mid-week count', href: stocktakeHref },
          { label: 'Adjust par', href: `/settings?section=par&ingredient=${ing}` },
        ],
      };
    case 'variance':
      return {
        primary: {
          label: 'Run mid-week count',
          href: stocktakeHref,
        },
        secondaries: [
          { label: 'Investigate variance', href: `/stock?item=${ing}` },
        ],
      };
    case 'spoilage':
      return {
        primary: {
          label: 'Log waste',
          href: `/log-waste?prefill=${ing}`,
        },
        secondaries: [
          { label: 'Adjust par', href: `/settings?section=par&ingredient=${ing}` },
          { label: 'Run mid-week count', href: stocktakeHref },
        ],
      };
    case 'overstock':
      return {
        primary: {
          label: 'Pause from next order',
          href: `/assisted-ordering?pause=${ing}`,
        },
        secondaries: [
          { label: 'Adjust par', href: `/settings?section=par&ingredient=${ing}` },
        ],
      };
    case 'stale':
      return {
        primary: {
          label: 'Run mid-week count',
          href: stocktakeHref,
        },
        secondaries: [],
      };
    case 'healthy':
      return {
        primary: { label: '', href: '' },
        secondaries: [
          { label: 'Log waste', href: `/log-waste?prefill=${ing}` },
          { label: 'Run mid-week count', href: stocktakeHref },
          { label: 'Adjust par', href: `/settings?section=par&ingredient=${ing}` },
        ],
      };
  }
}
