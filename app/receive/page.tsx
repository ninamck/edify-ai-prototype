'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import POSelection from '@/components/Receiving/POSelection';

export default function ReceivePage() {
  const router = useRouter();

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', fontFamily: 'var(--font-primary)' }}>
        <Link
          href="/receive/photo"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 18px',
            borderRadius: '8px', background: 'var(--color-accent-active)', color: 'var(--color-text-on-active)',
            fontSize: '14px', fontWeight: 700, textDecoration: 'none',
          }}
        >
          <Camera size={18} aria-hidden /> Take a photo
        </Link>
      </div>
      <POSelection
        onReceive={(poIds) => {
          router.push(`/receive/entry?pos=${poIds.join(',')}`);
        }}
      />
    </div>
  );
}
