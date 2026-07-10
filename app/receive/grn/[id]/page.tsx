import { MOCK_COMPLETED_DELIVERIES } from '@/components/Receiving/mockData';
import GRNDetail from './GRNDetail';

export function generateStaticParams() {
  return MOCK_COMPLETED_DELIVERIES.map(g => ({ id: g.id }));
}

export default async function GRNDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GRNDetail id={id} />;
}
