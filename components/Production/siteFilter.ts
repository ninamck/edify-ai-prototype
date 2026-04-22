import type { Site } from './productionStore';

export function forCurrentSite<T extends { siteId?: string }>(
  collection: readonly T[],
  siteId: string,
): T[] {
  return collection.filter(item => item.siteId === siteId);
}

export function isHub(site: Site | undefined | null): boolean {
  return site?.kind === 'hub';
}

export function isSpoke(site: Site | undefined | null): boolean {
  return site?.kind === 'spoke';
}

const DAY_KEYS: (keyof Site['tierAssignments'])[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

export function dayOfWeekFor(dateISO: string): keyof Site['tierAssignments'] {
  const d = new Date(dateISO);
  return DAY_KEYS[d.getDay()];
}
