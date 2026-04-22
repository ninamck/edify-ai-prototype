'use client';

import ProductionPlaceholder from '@/components/Production/ProductionPlaceholder';
import {
  useMadeOutputs,
  usePcrChecks,
  useProductionRuns,
} from '@/components/Production/productionStore';

export default function PcrQueuePage() {
  const madeOutputs = useMadeOutputs();
  const pcrChecks = usePcrChecks();
  const runs = useProductionRuns();

  const awaitingCheck = madeOutputs.filter(m => !pcrChecks.some(c => c.madeOutputId === m.id));

  return (
    <ProductionPlaceholder
      slice="Slice 3"
      title="PCR Queue"
      description="Quality + label checks per batch. Shelf-life clock starts on pass. Fail triggers an on-demand replacement run."
      dataCounts={[
        { label: 'Awaiting check', count: awaitingCheck.length },
        { label: 'Checks completed', count: pcrChecks.length },
        { label: 'Runs in progress', count: runs.filter(r => r.status === 'in_progress').length },
      ]}
      comingUp={[
        'Queue view (oldest first) + detail form.',
        'HACCP fields shown only for products that require them (configurable per Product).',
        'Pass → shelfLifeExpiresAt timer kicks off; Fail → modal to trigger replacement run.',
        'Switch to Manager role to access this from the sidebar.',
      ]}
    />
  );
}
