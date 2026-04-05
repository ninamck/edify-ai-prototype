'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import InvoiceMatchView from '@/components/Invoicing/InvoiceMatchView';
import { MOCK_INVOICES } from '@/components/Invoicing/mockData';

function MatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const invoice = MOCK_INVOICES.find(i => i.id === id);

  if (!invoice) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', fontFamily: 'var(--font-primary)' }}>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Invoice not found.</p>
        <button
          onClick={() => router.push('/invoices')}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: 'var(--color-accent-active)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          Back to Invoices
        </button>
      </div>
    );
  }

  return (
    <InvoiceMatchView
      invoice={invoice}
      onApprove={() => router.push(`/invoices/approved?id=${invoice.id}`)}
      onBack={() => router.push('/invoices')}
    />
  );
}

export default function InvoiceMatchPage() {
  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '1100px', margin: '0 auto' }}>
      <Suspense>
        <MatchContent />
      </Suspense>
    </div>
  );
}
