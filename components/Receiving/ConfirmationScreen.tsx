'use client';

import { useState } from 'react';
import StatusBadge from './StatusBadge';

interface ConfirmationScreenProps {
  grnNumber: string;
  supplier: string;
  poNumbers: string[];
  varianceCount: number;
  receivedBy: string;
  onBackToDeliveries: () => void;
}

export default function ConfirmationScreen({
  grnNumber,
  supplier,
  poNumbers,
  varianceCount,
  receivedBy,
  onBackToDeliveries,
}: ConfirmationScreenProps) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Success banner */}
      <div
        style={{
          background: 'var(--color-success-light)',
          border: '1px solid var(--color-success-border)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>✓</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success)', margin: '0 0 4px' }}>
          Delivery Confirmed
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {grnNumber} has been recorded for {supplier}
        </p>
      </div>

      {/* Summary card */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '12px',
          padding: '20px',
          background: '#fff',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
          Delivery Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', fontSize: '13px' }}>
          <SummaryRow label="GRN" value={grnNumber} />
          <SummaryRow label="Supplier" value={supplier} />
          <SummaryRow label="Purchase Orders" value={poNumbers.join(', ')} />
          <SummaryRow label="Confirmed By" value={receivedBy} />
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Status</span>
            <div style={{ marginTop: '4px' }}>
              <StatusBadge status={varianceCount > 0 ? 'Variance — Awaiting Resolution' : 'Fully Received'} />
            </div>
          </div>
          {varianceCount > 0 && (
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Variances</span>
              <div style={{ marginTop: '4px' }}>
                <StatusBadge status={`${varianceCount} item${varianceCount > 1 ? 's' : ''}`} variant="warning" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowInvoiceModal(true)}
          style={{
            padding: '12px 24px',
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
          Attach Invoice
        </button>
        <button
          onClick={onBackToDeliveries}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: '#fff',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            fontWeight: 600,
            fontSize: '14px',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          Back to Deliveries
        </button>
      </div>

      {/* Attach Invoice Modal */}
      {showInvoiceModal && (
        <AttachInvoiceModal onClose={() => setShowInvoiceModal(false)} />
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>{value}</div>
    </div>
  );
}

function AttachInvoiceModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '14px',
          padding: '28px',
          width: '100%',
          maxWidth: '440px',
          fontFamily: 'var(--font-primary)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
          Attach Invoice
        </h3>

        {/* Drop zone */}
        <div
          style={{
            border: '2px dashed var(--color-border)',
            borderRadius: '10px',
            padding: '32px',
            textAlign: 'center',
            marginBottom: '20px',
            background: 'var(--color-bg-hover)',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            Drop invoice file here
          </p>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: 0 }}>
            or click to browse — PDF, PNG, JPG accepted
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Skip for now
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'var(--color-accent-active)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
