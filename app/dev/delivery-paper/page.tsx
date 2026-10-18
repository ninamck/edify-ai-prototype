import Paper from '@/components/Receiving/capture/Paper';
import { DEFAULT_SAMPLE, isSampleId } from '@/components/Receiving/capture/samples';

export default async function DeliveryPaperPage({ searchParams }: { searchParams: Promise<{ sample?: string; page?: string }> }) {
  const { sample, page } = await searchParams;
  return (
    <div style={{ margin: 0, background: '#000', minHeight: '100vh' }}>
      <Paper sampleId={isSampleId(sample) ? sample : DEFAULT_SAMPLE} page={Number(page) || 1} />
    </div>
  );
}
