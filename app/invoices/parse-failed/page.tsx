'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import PassThroughDetailView from '@/components/PassThrough/PassThroughDetailView';
import {
  MOCK_INVOICES,
  markInvoiceExternallySynced,
  promoteParseFailedToMatched,
  saveApprovedResolutions,
} from '@/components/Invoicing/mockData';
import type { PassThroughInvoice } from '@/components/PassThrough/mockData';
import { recordSync } from '@/components/Invoicing/syncLog';
import { MOCK_COMPLETED_DELIVERIES, GRN } from '@/components/Receiving/mockData';

function grnLineTotal(grn: GRN): number {
  return grn.lines.reduce((sum, l) => sum + l.receivedQty * l.price, 0);
}

function ParseFailedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';
  const invoice = MOCK_INVOICES.find(i => i.id === id);

  const [selectedGrns, setSelectedGrns] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const candidateGRNs = useMemo(() => {
    if (!invoice) return [];
    const linked = new Set(MOCK_INVOICES.flatMap(i => i.grnNumbers));
    return MOCK_COMPLETED_DELIVERIES.filter(
      g => g.supplier === invoice.supplier && !linked.has(g.grnNumber)
    );
  }, [invoice]);

  const pickedGRNs = useMemo(
    () => candidateGRNs.filter(g => selectedGrns.includes(g.grnNumber)),
    [candidateGRNs, selectedGrns]
  );

  // Pass-through fallback: used only when the user opts for manual entry
  // without linking a GRN. When a GRN is linked, we promote + route away.
  const adapted: PassThroughInvoice | null = useMemo(() => {
    if (!invoice) return null;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      supplier: invoice.supplier,
      invoiceDate: invoice.date,
      totalExVat: invoice.total,
      vatRate: null,
      category: null,
      status: 'Awaiting review',
      activity: [
        {
          id: `pa-pf-${invoice.id}`,
          timestamp: `${invoice.date} · 07:02`,
          event: 'auto-routed',
          by: 'System',
          note: "Parse failed — line items couldn't be read. Routed to manual entry.",
        },
      ],
    };
  }, [invoice]);

  if (!invoice || !adapted) {
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

  const confirmAndPromote = () => {
    promoteParseFailedToMatched(invoice.id, selectedGrns);
    setShowConfirm(false);
    router.push(`/invoices/match?id=${invoice.id}`);
  };

  const linkedTotal = pickedGRNs.reduce((s, g) => s + grnLineTotal(g), 0);
  const linkedItemCount = pickedGRNs.reduce((s, g) => s + g.lines.length, 0);

  const grnPicker = (
    <section style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: '12px',
      padding: '18px',
      background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Link a Goods Received Notice
        </h2>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          recommended — opens the normal match view with the invoice pre-filled from the GRN
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px', lineHeight: 1.5, fontWeight: 500 }}>
        {candidateGRNs.length > 0
          ? `Pick one or more unlinked ${invoice.supplier} GRNs. You'll see the invoice next to the GRN and can edit any line where the PDF differs.`
          : `No unlinked GRNs from ${invoice.supplier}. Enter fields below manually and send direct to Xero.`}
      </p>
      {candidateGRNs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {candidateGRNs.map(grn => {
            const total = grnLineTotal(grn);
            const selected = selectedGrns.includes(grn.grnNumber);
            return (
              <button
                key={grn.grnNumber}
                onClick={() =>
                  setSelectedGrns(prev =>
                    selected ? prev.filter(n => n !== grn.grnNumber) : [...prev, grn.grnNumber]
                  )
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: selected ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
                  background: selected ? 'rgba(3,28,89,0.06)' : '#fff',
                  fontFamily: 'var(--font-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '16px', height: '16px', borderRadius: '4px',
                    border: selected ? 'none' : '1.5px solid var(--color-border)',
                    background: selected ? 'var(--color-accent-active)' : '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '11px', fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {selected ? '✓' : ''}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {grn.grnNumber}
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                      · Received {grn.dateReceived} · {grn.receivedBy} · PO {grn.poNumbers.join(', ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {grn.lines.length} item{grn.lines.length === 1 ? '' : 's'} · £{total.toFixed(2)}
                  </div>
                </div>
              </button>
            );
          })}
          {selectedGrns.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                {selectedGrns.length} selected · {linkedItemCount} items · £{linkedTotal.toFixed(2)}
              </span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedGrns([])}
                  style={{
                    background: 'transparent', border: 'none', padding: 0,
                    fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)',
                    cursor: 'pointer', fontFamily: 'var(--font-primary)',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: 'var(--color-accent-active)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-primary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Link and review →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );

  return (
    <>
      <PassThroughDetailView
        invoice={adapted}
        modeLabel="Parse recovered"
        modeDescription="Parse failed — link a GRN to open the normal match view, or enter the fields manually to send direct to Xero."
        topContent={grnPicker}
        onBack={() => router.push('/invoices')}
        onSend={({ invoiceId, grandTotal }) => {
          const row = MOCK_INVOICES.find(i => i.id === invoiceId);
          if (row) row.status = 'Approved';
          saveApprovedResolutions(invoiceId, {});
          markInvoiceExternallySynced(invoiceId);
          recordSync([invoiceId], [invoice.invoiceNumber], grandTotal);
        }}
      />

      {showConfirm && (
        <ConfirmLinkModal
          invoiceNumber={invoice.invoiceNumber}
          supplier={invoice.supplier}
          grns={pickedGRNs}
          total={linkedTotal}
          onCancel={() => setShowConfirm(false)}
          onConfirm={confirmAndPromote}
        />
      )}
    </>
  );
}

function ConfirmLinkModal({
  invoiceNumber, supplier, grns, total, onCancel, onConfirm,
}: {
  invoiceNumber: string;
  supplier: string;
  grns: GRN[];
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px' }}>
          Link {grns.length === 1 ? grns[0].grnNumber : `${grns.length} GRNs`} to {invoiceNumber}?
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Invoice lines will be pre-filled from {supplier}'s GRN{grns.length === 1 ? '' : 's'}. You'll see the invoice next to the GRN in the match view and can edit any line if the PDF shows different values.
        </p>
        <ul style={{ margin: '0 0 18px', padding: '0 0 0 18px', fontSize: '13px', lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
          {grns.map(g => (
            <li key={g.grnNumber}>
              <strong>{g.grnNumber}</strong> · {g.lines.length} item{g.lines.length === 1 ? '' : 's'} · £{g.lines.reduce((s, l) => s + l.receivedQty * l.price, 0).toFixed(2)}
            </li>
          ))}
          <li style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            Total invoice value: <strong style={{ color: 'var(--color-text-primary)' }}>£{total.toFixed(2)}</strong>
          </li>
        </ul>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '10px 18px', borderRadius: '8px', background: '#fff', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--color-accent-active)', border: 'none', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer' }}
          >
            Link and open match view
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ParseFailedPage() {
  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '1200px', margin: '0 auto' }}>
      <Suspense>
        <ParseFailedContent />
      </Suspense>
    </div>
  );
}
