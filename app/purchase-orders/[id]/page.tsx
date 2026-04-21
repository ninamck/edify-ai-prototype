'use client';

import { useRouter } from 'next/navigation';
import { use } from 'react';
import PODetailView from '@/components/PurchaseOrders/PODetailView';
import { getPOCoverageByPOId, getPOCoverage } from '@/components/Invoicing/mockData';

export default function POPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const coverage = getPOCoverageByPOId(id) ?? getPOCoverage(id);

  if (!coverage) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', fontFamily: 'var(--font-primary)' }}>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>Purchase order not found.</p>
        <button
          onClick={() => router.push('/')}
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
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '1100px', margin: '0 auto' }}>
      <PODetailView
        coverage={coverage}
        onBack={() => router.back()}
        onOpenInvoice={(invoiceId) => router.push(`/invoices/match?id=${invoiceId}`)}
      />
    </div>
  );
}
