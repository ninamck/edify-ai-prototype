'use client';

import { useRouter } from 'next/navigation';
import InvoiceList from '@/components/Invoicing/InvoiceList';

export default function InvoicesPage() {
  const router = useRouter();

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '960px', margin: '0 auto' }}>
      <InvoiceList
        onViewInvoice={(id) => router.push(`/invoices/match?id=${id}`)}
        onViewPassThrough={(id) => router.push(`/invoices/pass-through?id=${id}`)}
      />
    </div>
  );
}
