import { MOCK_COMPLETED_DELIVERIES } from '@/components/Receiving/mockData';
import GRNDetail from './GRNDetail';

export function generateStaticParams() {
  return MOCK_COMPLETED_DELIVERIES.map(g => ({ id: g.id }));
}

export default function GRNDetailPage({ params }: { params: { id: string } }) {
  return <GRNDetail id={params.id} />;
}
