'use client';

import RunSheetView from '@/components/Production2/RunSheetView';
import { useProductionSite } from '@/components/Production2/ProductionSiteContext';
import { DEMO_TODAY } from '@/components/Production2/fixtures';

export default function ProductionRunSheetPage() {
  const { siteId } = useProductionSite();
  return <RunSheetView siteId={siteId} date={DEMO_TODAY} />;
}
