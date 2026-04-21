'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PassThroughDetailView from '@/components/PassThrough/PassThroughDetailView';
import { MOCK_PASS_THROUGH_INVOICES } from '@/components/PassThrough/mockData';

function PassThroughContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const invoice = MOCK_PASS_THROUGH_INVOICES.find(p => p.id === id);

  if (!invoice) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', fontFamily: 'var(--font-primary)' }}>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Pass-through invoice not found.</p>
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
    <PassThroughDetailView
      invoice={invoice}
      onBack={() => router.push('/invoices')}
    />
  );
}

export default function PassThroughPage() {
  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '1200px', margin: '0 auto' }}>
      <Suspense>
        <PassThroughContent />
      </Suspense>
    </div>
  );
}
