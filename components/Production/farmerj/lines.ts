/**
 * Service lines the planner splits a shop's day across.
 *
 * A line is a bench from the site settings store with two facts the
 * cascade reads: which sales channels plate on it and whether it plates in
 * half batches (small containers). `FjPlanProvider` resolves each shop's
 * benches through the store and registers them here, so the engines
 * (`computeDayPlan`, prep, ordering, close) can read a shop's lines without
 * every caller threading them through.
 */

import type { Bench } from '../fixtures';
import { FJ_LINE_TEMPLATES, isFjLine } from './fjFixtures';
import type { SalesChannel } from './salesDay';

export const ALL_CHANNELS: SalesChannel[] = ['instore', 'kiosk', 'deliveroo', 'clickcollect', 'corporate', 'citypantry', 'ordit'];

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  instore: 'In store',
  kiosk: 'Kiosk',
  deliveroo: 'Deliveroo',
  clickcollect: 'Click & Collect',
  corporate: 'Corporate',
  citypantry: 'CityPantry',
  ordit: 'Ordit',
};

/** Channels that leave the shop in a bag or a box: the second make line's trade. */
export const DELIVERY_CHANNELS: ReadonlySet<SalesChannel> = new Set<SalesChannel>(['deliveroo', 'clickcollect', 'corporate', 'citypantry', 'ordit']);

/** The catering platforms: office orders placed a day ahead, packed in X4 and X6 boxes. */
export const PLATFORM_CHANNELS: ReadonlySet<SalesChannel> = new Set<SalesChannel>(['corporate', 'citypantry', 'ordit']);

export type PlanLine = {
  id: string;
  name: string;
  /** Plates small containers; a recipe with a half batch rounds to halves here. */
  halfBatches: boolean;
  channels: SalesChannel[];
};

const isChannel = (c: string): c is SalesChannel => (ALL_CHANNELS as string[]).includes(c);

/**
 * Turn a site's benches into plan lines. Only benches with channels are
 * lines; kitchen benches (hot section, basement prep) own kit and plate
 * nothing. Offline benches drop out. Every channel plates somewhere:
 * channels no bench claims go to the first line, so demand is never lost
 * when a GM edits a line badly.
 */
export function linesFromBenches(benches: Bench[]): PlanLine[] {
  const lineBenches = benches.filter(isFjLine);
  const live = lineBenches.filter(b => b.online !== false);
  const src = live.length ? live : lineBenches;
  const lines: PlanLine[] = src.map(b => ({
    id: b.id,
    name: b.name,
    halfBatches: Boolean(b.halfBatches),
    channels: (b.channels ?? []).filter(isChannel),
  }));
  if (!lines.length) return defaultLines();
  const claimed = new Set(lines.flatMap(l => l.channels));
  const orphans = ALL_CHANNELS.filter(c => !claimed.has(c));
  if (orphans.length) lines[0] = { ...lines[0], channels: [...lines[0].channels, ...orphans] };
  return lines;
}

export function defaultLines(): PlanLine[] {
  return linesFromBenches(FJ_LINE_TEMPLATES.map(t => ({ ...t, siteId: '' })));
}

/** The line carry-over comes off: the first full-batch line, else the first line. */
export function carryLine(lines: PlanLine[]): PlanLine {
  return lines.find(l => !l.halfBatches) ?? lines[0];
}

/** The line catering is plated on: the first half-batch line, else the last line. */
export function cateringLine(lines: PlanLine[]): PlanLine {
  return lines.find(l => l.halfBatches) ?? lines[lines.length - 1];
}

// ─── Registry ────────────────────────────────────────────────────────────────

let REGISTRY: Record<string, PlanLine[]> = {};
let REGISTRY_KEY = '';

/** Replace the registry. Returns a key that changes when any line changed. */
export function setShopLines(map: Record<string, PlanLine[]>): string {
  REGISTRY = map;
  REGISTRY_KEY = JSON.stringify(map);
  return REGISTRY_KEY;
}

export function linesFor(shopId: string): PlanLine[] {
  return REGISTRY[shopId] ?? defaultLines();
}

export function linesKey(): string {
  return REGISTRY_KEY;
}
