'use client';

import StatusBadge from '@/components/Receiving/StatusBadge';
import { Invoice, getApprovedResolutions } from './mockData';

interface ApprovedStateProps {
  invoice: Invoice;
  onBackToInvoices: () => void;
}

interface CostUpdate { item: string; oldPrice: number; newPrice: number; change: string; }
interface DeliveryOnly { item: string; invoicePrice: number; masterPrice: number; }

export default function ApprovedState({ invoice, onBackToInvoices }: ApprovedStateProps) {
  const resolutions = getApprovedResolutions(invoice.id) ?? {};

  const COST_UPDATES: CostUpdate[] = invoice.variances
    .filter(v => v.type === 'price' && resolutions[v.id] === 'Accept & Update Cost in Edify')
    .map(v => {
      const pct = v.poValue > 0 ? ((v.invoiceValue - v.poValue) / v.poValue) * 100 : 0;
      return {
        item: v.itemName,
        oldPrice: v.poValue,
        newPrice: v.invoiceValue,
        change: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      };
    });

  const DELIVERY_ONLY: DeliveryOnly[] = invoice.variances
    .filter(v => v.type === 'price' && resolutions[v.id] === 'Accept for this delivery')
    .map(v => ({ item: v.itemName, invoicePrice: v.invoiceValue, masterPrice: v.poValue }));

  const creditNoteVariances = invoice.variances.filter(v => {
    const r = resolutions[v.id];
    return r === 'Credit Note' || r === 'Dispute → Credit Note' || r === 'Request credit note';
  });
  const creditNoteCount = creditNoteVariances.length;
  const creditValue = creditNoteVariances.reduce((s, v) => s + Math.abs(v.impact), 0);

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
          Invoice Approved
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Invoice approved and queued for Xero sync.{COST_UPDATES.length > 0 ? ` ${COST_UPDATES.length} ingredient cost${COST_UPDATES.length > 1 ? 's' : ''} updated. Recipe GP% recalculated.` : ''}{DELIVERY_ONLY.length > 0 ? ` ${DELIVERY_ONLY.length} price${DELIVERY_ONLY.length > 1 ? 's' : ''} accepted for this delivery only.` : ''}
        </p>
      </div>

      {/* Summary card */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '12px',
          padding: '20px',
          background: '#fff',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
          Approval Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', fontSize: '13px' }}>
          <SummaryRow label="Invoice" value={invoice.invoiceNumber} />
          <SummaryRow label="Supplier" value={invoice.supplier} />
          <SummaryRow label="Approved By" value="Nina McKinnon" />
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Xero Status</span>
            <div style={{ marginTop: '4px' }}><StatusBadge status="Queued for sync" variant="info" /></div>
          </div>
          {creditNoteCount > 0 && (
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Credit Notes</span>
              <div style={{ marginTop: '4px' }}>
                <StatusBadge status={`${creditNoteCount} · £${creditValue.toFixed(2)}`} variant="warning" />
              </div>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Total</span>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px', fontSize: '16px' }}>£{invoice.total.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Cost Updates card */}
      {COST_UPDATES.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            padding: '20px',
            background: '#fff',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            Ingredient Costs Updated
          </h3>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
            These prices are now the new master cost. Recipe GP% has been recalculated.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {COST_UPDATES.map(ci => (
              <div
                key={ci.item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-hover)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{ci.item}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    £{ci.oldPrice.toFixed(2)} → £{ci.newPrice.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusBadge status={ci.change} variant="warning" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery-only prices card */}
      {DELIVERY_ONLY.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            padding: '20px',
            background: '#fff',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            Accepted for This Delivery Only
          </h3>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
            These prices were accepted for this invoice but did not change the master ingredient cost.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DELIVERY_ONLY.map(d => (
              <div
                key={d.item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{d.item}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    Charged £{d.invoicePrice.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Master cost unchanged at £{d.masterPrice.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={onBackToInvoices}
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
          Back to Invoices
        </button>
        <button
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
          View in Xero
        </button>
      </div>
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
