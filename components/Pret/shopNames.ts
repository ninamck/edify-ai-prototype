'use client';

import { useCallback } from 'react';
import { cashShop } from './cashFixtures';
import { useCashAudience, type CashAudience } from './cashOperators';

/**
 * Kyle runs Dunkin' shops in New York and South Carolina, so the Dunkin set-up
 * renames the four demo shops. The ids stay the same so every fixture keeps
 * working; only what people read changes.
 */
export const DUNKIN_SHOPS: Record<string, { name: string; caption: string }> = {
  'all-sites': { name: 'All shops', caption: 'Every shop in the district' },
  'fitzroy-espresso': { name: 'Fordham Rd, Bronx', caption: 'Drive-thru · Bronx, NY' },
  'fitzroy-kings-cross': { name: 'W 34th St, Manhattan', caption: 'Walk-in · Manhattan, NY' },
  'fitzroy-heathrow': { name: 'JFK Terminal 4', caption: 'Airport · Queens, NY' },
  'fitzroy-gatwick': { name: 'LaGuardia Terminal B', caption: 'Airport · Queens, NY' },
  'fitzroy-islington': { name: 'King St, Charleston', caption: 'Walk-in · Charleston, SC' },
};

export function shopName(siteId: string, audience: CashAudience, fallback?: string): string {
  if (audience === 'dunkin' && DUNKIN_SHOPS[siteId]) return DUNKIN_SHOPS[siteId].name;
  return fallback ?? cashShop(siteId)?.name ?? siteId;
}

export function shopCaption(siteId: string, audience: CashAudience, fallback: string): string {
  return audience === 'dunkin' && DUNKIN_SHOPS[siteId] ? DUNKIN_SHOPS[siteId].caption : fallback;
}

/** Name lookup that follows the demo switch. */
export function useShopName(): (siteId: string, fallback?: string) => string {
  const [audience] = useCashAudience();
  return useCallback((siteId: string, fallback?: string) => shopName(siteId, audience, fallback), [audience]);
}
