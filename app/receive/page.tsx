'use client';

import { useRouter } from 'next/navigation';
import POSelection from '@/components/Receiving/POSelection';

export default function ReceivePage() {
  const router = useRouter();

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '860px', margin: '0 auto' }}>
      <POSelection
        onReceive={(poIds) => {
          router.push(`/receive/entry?pos=${poIds.join(',')}`);
        }}
        onBack={() => router.push('/')}
      />
    </div>
  );
}
