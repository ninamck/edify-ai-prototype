'use client';

import { useRouter } from 'next/navigation';
import InvoiceUploadFlow from '@/components/Invoicing/InvoiceUploadFlow';

export default function InvoiceUploadPage() {
  const router = useRouter();
  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1500px', margin: '0 auto' }}>
      <InvoiceUploadFlow
        onDone={(id) => router.push(`/invoices/match?id=${id}`)}
        onCancel={() => router.push('/invoices')}
      />
    </div>
  );
}
