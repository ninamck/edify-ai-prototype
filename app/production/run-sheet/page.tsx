'use client';

import RunSheetView from '@/components/Production/RunSheetView';
import { useProductionSite } from '@/components/Production/ProductionSiteContext';
import { DEMO_TODAY } from '@/components/Production/fixtures';

export default function ProductionRunSheetPage() {
  const { siteId } = useProductionSite();
  return <RunSheetView siteId={siteId} date={DEMO_TODAY} />;
}
