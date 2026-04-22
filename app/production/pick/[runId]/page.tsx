'use client';

import { use } from 'react';
import ProductionPlaceholder from '@/components/Production/ProductionPlaceholder';
import {
  usePickListLines,
  useProductionRuns,
  useSupplierProducts,
} from '@/components/Production/productionStore';

export default function PickListPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const pickLines = usePickListLines().filter(p => p.runId === runId);
  const run = useProductionRuns().find(r => r.id === runId);
  const stocked = useSupplierProducts();

  const lowStock = stocked.filter(sp => sp.onHand <= sp.parLevel);

  return (
    <ProductionPlaceholder
      slice="Slice 3"
      title={run ? `Pick List — ${run.name}` : 'Pick List'}
      description="Reserve Stocked products against Pick Lines for a run. Shortages open Quinn's assisted-ordering suggestion."
      dataCounts={[
        { label: 'Pick lines for this run', count: pickLines.length },
        { label: 'Stocked items (catalogue)', count: stocked.length },
        { label: 'Below par', count: lowStock.length },
      ]}
      comingUp={[
        'Pick lines populate when a Planner locks a run (Slice 2 → Slice 3 handoff).',
        'Tap to reserve; shortages flag a PO draft.',
        'Mobile-first cards with +/− Stepper.',
        'Switch to Dispatcher role to access this from the sidebar.',
      ]}
    />
  );
}
