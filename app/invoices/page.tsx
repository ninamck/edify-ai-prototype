'use client';

import { useRouter } from 'next/navigation';
import InvoiceList from '@/components/Invoicing/InvoiceList';
import { MOCK_INVOICES } from '@/components/Invoicing/mockData';

export default function InvoicesPage() {
  const router = useRouter();

  const viewInvoice = (id: string) => {
    const inv = MOCK_INVOICES.find(i => i.id === id);
    const route =
      inv?.status === 'Approved' ? `/invoices/approved?id=${id}` :
      inv?.status === 'Parse Failed' ? `/invoices/parse-failed?id=${id}` :
      `/invoices/match?id=${id}`;
    router.push(route);
  };

  return (
    <div style={{ padding: '28px 32px 48px', maxWidth: '1500px', margin: '0 auto' }}>
      <InvoiceList
        onViewInvoice={viewInvoice}
        onViewPassThrough={(id) => router.push(`/invoices/pass-through?id=${id}`)}
      />
    </div>
  );
}
