'use client';

import { use } from 'react';
import ProductionPlaceholder from '@/components/Production/ProductionPlaceholder';
import {
  useBenches,
  useCapabilityTags,
} from '@/components/Production/productionStore';

export default function BenchTasksPage({
  params,
}: {
  params: Promise<{ benchId: string }>;
}) {
  const { benchId } = use(params);
  const benches = useBenches();
  const tags = useCapabilityTags();
  const bench = benches.find(b => b.id === benchId);

  const benchTags = tags.filter(t => bench?.capabilityTagIds.includes(t.id));

  return (
    <ProductionPlaceholder
      slice="Slice 3"
      title={bench ? `Bench Task List — ${bench.name}` : 'Bench Task List'}
      description={
        bench
          ? `Mobile-first task board for the ${bench.name}. Wet hands, loud kitchen — large tap targets, bold numbers, single primary button per card.`
          : `No bench with id "${benchId}". Try one of the configured benches.`
      }
      dataCounts={
        bench
          ? [
              { label: 'Capabilities', count: benchTags.length },
              { label: 'Capacity / hr', count: bench.capacityPerHour },
              { label: 'Hours (shift length)', count: parseInt(bench.activeHours.end, 10) - parseInt(bench.activeHours.start, 10) },
              { label: 'Assignments today', count: 0 },
            ]
          : benches.map(b => ({
              label: b.name,
              count: b.capacityPerHour,
              href: `/production/bench/${b.id}/tasks`,
            }))
      }
      comingUp={[
        'Vertically stacked TaskCards, biggest/readiest at the top.',
        'Single-tap Start → In Progress → Complete with actual quantity.',
        'Reject capture via "+1 reject" before completing.',
        'Switch to Maker role in the header to see this screen come alive.',
      ]}
    />
  );
}
