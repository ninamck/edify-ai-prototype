'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isFarmerJShopId } from '@/components/Production/farmerj/shops';
import { FJ_RUN_HOME } from '@/components/Production/farmerj/nav';
import { isFarmerJDemo } from '@/lib/demoConfig';

/**
 * /production lands on the active brand's home surface. Pret and Burger
 * King both open on the board (bench board / crew line); Farmer J opens on
 * the day plan.
 *
 * Reads the persisted persona directly rather than via `useActiveSite()`:
 * this effect fires before the ActiveSite provider has hydrated from
 * localStorage, so the context would still report the SSR default.
 */
export default function ProductionIndex() {
  const router = useRouter();
  useEffect(() => {
    let farmerJ = isFarmerJDemo;
    try {
      const stored = window.localStorage.getItem('edify.activeSiteId');
      if (stored) farmerJ = isFarmerJDemo || isFarmerJShopId(stored);
    } catch {
      // no localStorage: fall through to the build default
    }
    router.replace(farmerJ ? FJ_RUN_HOME : '/production/board');
  }, [router]);
  return null;
}
