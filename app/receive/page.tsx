'use client';

import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import POSelection from '@/components/Receiving/POSelection';
import { sampleForPo } from '@/components/Receiving/capture/samples';

export default function ReceivePage() {
  const router = useRouter();

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '860px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          padding: '16px',
          marginBottom: '20px',
          borderRadius: '14px',
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Delivery just arrived?</div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.45 }}>
            Photo the delivery note, invoice or receipt. Edify checks it against your order.
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/receive/photo')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '48px',
            padding: '0 20px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--color-accent-active)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          <Camera size={20} aria-hidden /> Take a photo
        </button>
      </div>
      <POSelection
        onReceive={(poIds) => {
          router.push(`/receive/entry?pos=${poIds.join(',')}`);
        }}
        canPhoto={(poId) => sampleForPo(poId) != null}
        onPhoto={(poId) => router.push(`/receive/photo?po=${poId}`)}
      />
    </div>
  );
}
