'use client';

import ProductionPlaceholder from '@/components/Production/ProductionPlaceholder';
import {
  useDispatchManifests,
  useMadeOutputs,
  useSpokes,
} from '@/components/Production/productionStore';

export default function DispatchQueuePage() {
  const manifests = useDispatchManifests();
  const madeOutputs = useMadeOutputs();
  const spokes = useSpokes();

  return (
    <ProductionPlaceholder
      slice="Slice 3"
      title="Dispatch Queue"
      description="Consolidate Made + Picked into manifests per destination. Groups by temperature zone; warns if shelf life is too tight for the delivery + sale window."
      dataCounts={[
        { label: 'Destinations (spokes)', count: spokes.length },
        { label: 'Made outputs ready', count: madeOutputs.filter(m => m.destination === 'dispatch').length },
        { label: 'Manifests in flight', count: manifests.filter(m => m.status !== 'delivered').length },
        { label: 'Delivered', count: manifests.filter(m => m.status === 'delivered').length },
      ]}
      comingUp={[
        'Destination queue rows (one per spoke with ordered / produced / dispatched / remaining counts).',
        'Manifest builder drawer on click.',
        'Temperature-zone grouping; shelf-life-vs-delivery warnings.',
        'Switch to Dispatcher role to access this from the sidebar.',
      ]}
    />
  );
}
