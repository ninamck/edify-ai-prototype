import { SAMPLE_DOCUMENTS, type SampleId } from '@/components/Receiving/photo/fixtures';
import SamplePaper from './SamplePaper';

export default async function PhotoSamplesPage({ searchParams }: { searchParams: Promise<{ sample?: string; page?: string }> }) {
  const { sample, page } = await searchParams;
  const sampleId = (sample && sample in SAMPLE_DOCUMENTS ? sample : 'fd-note') as SampleId;
  return (
    <div style={{ padding: 0, margin: 0, background: '#000', minHeight: '100vh' }}>
      <SamplePaper sampleId={sampleId} page={Number(page) || 1} />
    </div>
  );
}
