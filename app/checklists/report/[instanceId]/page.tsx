import { AuditReportClient } from './AuditReport';

// Audits completed live exist only in the client-side store, so params
// can't be pre-rendered — the client component resolves the id.
export default async function AuditReportPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  return <AuditReportClient instanceId={instanceId} />;
}
