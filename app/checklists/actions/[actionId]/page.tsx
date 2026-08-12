import { ResolutionFlowClient } from './ResolutionFlow';

// Corrective actions are created at runtime in the client-side store, so
// params can't be pre-rendered — the client component resolves the id.
export default async function CorrectiveActionPage({
  params,
}: {
  params: Promise<{ actionId: string }>;
}) {
  const { actionId } = await params;
  return <ResolutionFlowClient actionId={actionId} />;
}
