'use client';

import { useState } from 'react';
import StatusBadge from './StatusBadge';
import { MOCK_COMPLETED_DELIVERIES, deliverySequenceTag } from './mockData';

interface ConfirmationScreenProps {
  grnNumber: string;
  supplier: string;
  poNumbers: string[];
  varianceCount: number;
  receivedBy: string;
  altCount?: number;
  masterId?: string;
  /** Lines resolved as "Coming in another delivery" — the rest arrives later. */
  backOrderCount?: number;
  /** POs left Partially Received (still in Awaiting Delivery). */
  openPoNumbers?: string[];
  onBackToDeliveries: () => void;
  onViewMaster?: () => void;
  /** Opens the Accepted tab where the new GRN row now lives. */
  onViewAccepted?: () => void;
}

export default function ConfirmationScreen({
  grnNumber,
  supplier,
  poNumbers,
  varianceCount,
  receivedBy,
  altCount = 0,
  backOrderCount = 0,
  openPoNumbers = [],
  onBackToDeliveries,
  onViewMaster,
  onViewAccepted,
}: ConfirmationScreenProps) {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const statusLabel = backOrderCount > 0
    ? 'Partially Received'
    : altCount > 0
      ? 'Alternative product sent'
      : varianceCount > 0
        ? 'Variance — Awaiting Resolution'
        : 'Fully Received';
  const statusVariant = altCount > 0 && backOrderCount === 0 ? 'warning' : undefined;

  // "1st/2nd delivery · PO-x" — shown when this GRN's PO has been split
  // across multiple deliveries (e.g. the back-order's second drop).
  const recordedGrn = MOCK_COMPLETED_DELIVERIES.find(g => g.grnNumber === grnNumber);
  const deliveryTag = recordedGrn ? deliverySequenceTag(recordedGrn) : null;

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Success banner */}
      <div
        style={{
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>✓</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          Delivery Accepted
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
            <div style={{ marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <StatusBadge status={statusLabel} variant={statusVariant} />
              {deliveryTag && <StatusBadge status={deliveryTag} variant="info" />}
            </div>
          </div>
          {varianceCount > 0 && altCount === 0 && (
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Variances</span>
              <div style={{ marginTop: '4px' }}>
                <StatusBadge status={`${varianceCount} item${varianceCount > 1 ? 's' : ''}`} variant="warning" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Back-order note — the rest comes in a second delivery */}
      {backOrderCount > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            borderRadius: '12px',
            padding: '18px 20px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            {backOrderCount} item{backOrderCount > 1 ? 's' : ''} coming in another delivery
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
            {openPoNumbers.length > 0 ? openPoNumbers.join(', ') : 'The PO'} stays in
            Awaiting Delivery with just the remaining quantities. Receive it again when
            the rest arrives — that delivery gets its own GRN against the same PO, so
            each invoice matches its delivery.
          </p>
        </div>
      )}

      {/* New products / cost update note */}
      {altCount > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            borderRadius: '12px',
            padding: '18px 20px',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            {altCount} new supplier product{altCount > 1 ? 's' : ''} created
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
            The alternative item{altCount > 1 ? 's were' : ' was'} added to the supplier catalogue and linked to the
            relevant master product. Each master&apos;s weighted-average cost has been updated for this site, so
            stock takes and COGS use the right figure.
          </p>
          {onViewMaster && (
            <button onClick={onViewMaster} style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-accent-deep)',
              cursor: 'pointer',
            }}>
              View master product
            </button>
          )}
        </div>
      )}

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
        {onViewAccepted && (
          <button
            onClick={onViewAccepted}
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
            View in Accepted →
          </button>
        )}
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
