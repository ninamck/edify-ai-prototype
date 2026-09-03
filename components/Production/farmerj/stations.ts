/**
 * The benches a shop works at, for the Sections board: each bench that
 * takes a work role (`Bench.sections`) is a card, named as the bench is,
 * with its kit. Resolved per shop from the site settings store by
 * `FjPlanProvider` and registered here next to the lines and the kit, so
 * `computeSectionsDay` can read them without a hook.
 *
 * Roles route work: a cook load is `hot` work and lands on whichever bench
 * takes `hot`. A shop that merges salads into its prep bench ticks both
 * roles on one bench and gets one card. A role no bench takes still shows,
 * as a card of its own, so nothing is lost while Setup is fixed.
 */

import type { EffectiveBench } from '@/components/Settings/siteSettingsStore';
import type { BenchKitItem } from '../fixtures';
import { FJ_BENCH_TEMPLATES, FJ_WORK_ROLE_BY_ID } from './fjFixtures';
import type { Section as WorkRole } from './recipes';

export type Station = {
  id: string;
  name: string;
  roles: WorkRole[];
  /** True for a service line (plates for channels), false for a kitchen bench. */
  isLine: boolean;
  kit: BenchKitItem[];
};

const isRole = (r: string): r is WorkRole => r in FJ_WORK_ROLE_BY_ID;

/** Kitchen benches lead the board, in their settings order; lines that take work follow. */
export function stationsFromBenches(benches: Pick<EffectiveBench, 'id' | 'name' | 'sections' | 'channels' | 'kit' | 'online'>[]): Station[] {
  const all = benches
    .filter(b => b.online !== false && (b.sections ?? []).length > 0)
    .map(b => ({ id: b.id, name: b.name, roles: (b.sections ?? []).filter(isRole), isLine: Array.isArray(b.channels), kit: b.kit ?? [] }));
  return [...all.filter(s => !s.isLine), ...all.filter(s => s.isLine)];
}

export function defaultStations(): Station[] {
  return stationsFromBenches(FJ_BENCH_TEMPLATES.map(t => ({ ...t, siteId: '', hasOverride: false })));
}

let REGISTRY: Record<string, Station[]> = {};
let REGISTRY_KEY = '';

export function setShopStations(map: Record<string, Station[]>): string {
  REGISTRY = map;
  REGISTRY_KEY = JSON.stringify(map);
  return REGISTRY_KEY;
}

export function stationsFor(shopId: string): Station[] {
  return REGISTRY[shopId] ?? defaultStations();
}

/** The bench a role lands on at this shop, if any takes it. */
export function stationForRole(stations: Station[], role: WorkRole): Station | undefined {
  return stations.find(s => s.roles.includes(role));
}
