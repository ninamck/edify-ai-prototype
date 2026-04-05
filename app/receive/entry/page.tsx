'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, useCallback } from 'react';
import ReceivingScreen from '@/components/Receiving/ReceivingScreen';
import { MOCK_POS, PO } from '@/components/Receiving/mockData';
import { AddPOModal, ScanGRNModal } from '@/components/Receiving/ReceivingModals';

function EntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poParam = searchParams.get('pos') ?? '';

  const [selectedIds, setSelectedIds] = useState<string[]>(() => poParam.split(',').filter(Boolean));
  const [showAddPO, setShowAddPO] = useState(false);
  const [showScanGRN, setShowScanGRN] = useState(false);

  const selectedPOs: PO[] = useMemo(() => {
    return selectedIds.map(id => MOCK_POS.find(po => po.id === id)).filter(Boolean) as PO[];
  }, [selectedIds]);

  const handleAddPO = useCallback((poId: string) => {
    setSelectedIds(prev => [...prev, poId]);
  }, []);

  if (selectedPOs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', fontFamily: 'var(--font-primary)' }}>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>No POs selected.</p>
        <button
          onClick={() => router.push('/receive')}
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
          Go to PO Selection
        </button>
      </div>
    );
  }

  return (
    <>
      <ReceivingScreen
        pos={selectedPOs}
        onConfirm={(data) => {
          const variances = data.lines.filter(l => {
            const po = selectedPOs.flatMap(p => p.lines).find(pl => pl.id === l.poLineId);
            return po && l.receivedQty !== po.expectedQty;
          }).length;
          const supplier = selectedPOs[0].supplier;
          const poNums = selectedPOs.map(p => p.poNumber).join(',');
          router.push(`/receive/confirmed?supplier=${encodeURIComponent(supplier)}&pos=${encodeURIComponent(poNums)}&variances=${variances}`);
        }}
        onBack={() => router.push('/receive')}
        onAddPO={() => setShowAddPO(true)}
        onScanGRN={() => setShowScanGRN(true)}
      />

      {showAddPO && (
        <AddPOModal
          excludeIds={selectedIds}
          onAdd={handleAddPO}
          onClose={() => setShowAddPO(false)}
        />
      )}
      {showScanGRN && (
        <ScanGRNModal onClose={() => setShowScanGRN(false)} />
      )}
    </>
  );
}

export default function ReceiveEntryPage() {
  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '920px', margin: '0 auto' }}>
      <Suspense>
        <EntryContent />
      </Suspense>
    </div>
  );
}
