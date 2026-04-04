import { ALL_COMPLETED_INSTANCES } from '../../mockData';
import { HistoryDetailClient } from './HistoryDetail';

export function generateStaticParams() {
  return ALL_COMPLETED_INSTANCES.map((inst) => ({ instanceId: inst.id }));
}

export default async function HistoryDetailPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  return <HistoryDetailClient instanceId={instanceId} />;
}
