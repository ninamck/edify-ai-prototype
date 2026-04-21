'use client';

import { useRouter } from 'next/navigation';
import RulesView from '@/components/InvoicingRules/RulesView';

export default function InvoiceSettingsPage() {
  const router = useRouter();
  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '960px', margin: '0 auto' }}>
      <RulesView onBack={() => router.push('/invoices')} />
    </div>
  );
}
