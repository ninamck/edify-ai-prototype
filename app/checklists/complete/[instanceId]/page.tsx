import { MOCK_INSTANCES } from '../../mockData';
import { CompletionFlowClient } from './CompletionFlow';

export function generateStaticParams() {
  return MOCK_INSTANCES.map((inst) => ({ instanceId: inst.id }));
}

export default async function CompletionFlowPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  return <CompletionFlowClient instanceId={instanceId} />;
}
