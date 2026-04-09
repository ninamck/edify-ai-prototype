'use client';

import { useRouter } from 'next/navigation';
import { MOCK_COMPLETED_DELIVERIES, MOCK_POS } from '@/components/Receiving/mockData';

export default function GRNDetail({ id }: { id: string }) {
  const router = useRouter();

  const grn = MOCK_COMPLETED_DELIVERIES.find(g => g.id === id);

  if (!grn) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--font-primary)' }}>
        <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>GRN not found.</p>
        <button
          onClick={() => router.back()}
          style={{ padding: '9px 20px', borderRadius: '8px', background: 'var(--color-accent-active)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-primary)', cursor: 'pointer' }}
        >
          Go back
        </button>
      </div>
    );
  }

  const pos = MOCK_POS.filter(p => grn.poNumbers.includes(p.poNumber));
  const total = grn.lines.reduce((s, l) => s + l.price * l.receivedQty, 0);
  const hasVariance = grn.lines.some(l => l.receivedQty !== l.expectedQty);

  const cell: React.CSSProperties = {
    padding: '10px 14px',
    borderBottom: '1px solid var(--color-border-subtle)',
    fontSize: '13px',
    fontFamily: 'var(--font-primary)',
  };

  return (
    <div style={{ padding: '28px 24px 48px', maxWidth: '860px', margin: '0 auto', fontFamily: 'var(--font-primary)' }}>
      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '8px', padding: 0 }}
      >
        ← Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            {grn.grnNumber}
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            {grn.supplier} · Received {grn.dateReceived} by {grn.receivedBy}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {grn.attachmentUrl && (
            <a
              href={grn.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '7px 14px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'none', fontFamily: 'var(--font-primary)' }}
            >
              View PDF
            </a>
          )}
          <span style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
            background: grn.status === 'Closed' ? 'var(--color-success-light)' : hasVariance ? 'var(--color-warning-light)' : 'var(--color-info-light)',
            color: grn.status === 'Closed' ? 'var(--color-success)' : hasVariance ? 'var(--color-warning)' : 'var(--color-info)',
          }}>
            {grn.status}
          </span>
        </div>
      </div>

      {/* Meta cards */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <MetaCard label="PO Reference" value={grn.poNumbers.join(', ')} />
        <MetaCard label="Site" value={grn.site} />
        <MetaCard label="Items" value={`${grn.lines.length} lines`} />
        {grn.invoiceNumber && <MetaCard label="Invoice" value={grn.invoiceNumber} />}
        <MetaCard label="Total Received" value={`$${total.toFixed(2)}`} highlight />
      </div>

      {/* Lines table */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-hover)' }}>
              {['Description', 'SKU', 'Unit', 'Ordered', 'Received', 'Unit Price', 'Total'].map(h => (
                <th key={h} style={{ ...cell, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', textAlign: h === 'Ordered' || h === 'Received' ? 'center' : 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grn.lines.map(line => {
              const isShort = line.receivedQty < line.expectedQty;
              const lineTotal = line.price * line.receivedQty;
              return (
                <tr key={line.id} style={{ background: isShort ? 'rgba(217,119,6,0.06)' : 'transparent' }}>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--color-text-primary)', boxShadow: isShort ? 'inset 3px 0 0 #D97706' : 'none' }}>
                    {line.name}
                  </td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)', fontSize: '12px' }}>{line.sku}</td>
                  <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{line.unit}</td>
                  <td style={{ ...cell, textAlign: 'center', color: 'var(--color-text-secondary)' }}>{line.expectedQty}</td>
                  <td style={{ ...cell, textAlign: 'center', fontWeight: isShort ? 700 : 500, color: isShort ? 'var(--color-warning)' : undefined }}>
                    {line.receivedQty}
                    {isShort && (
                      <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                        of {line.expectedQty}
                      </span>
                    )}
                  </td>
                  <td style={{ ...cell }}>${line.price.toFixed(2)}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>${lineTotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--color-border)' }}>
              <td colSpan={6} style={{ ...cell, textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: 'none' }}>Total received</td>
              <td style={{ ...cell, fontWeight: 700, fontSize: '14px', borderBottom: 'none' }}>${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Linked POs */}
      {pos.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
            Linked Purchase Orders
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {pos.map(po => (
              <div key={po.id} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: '#fff', fontSize: '13px' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-accent-active)', marginBottom: '2px' }}>{po.poNumber}</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{po.supplier} · {po.lines.length} lines · {po.dateSent}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', background: '#fff', minWidth: '120px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: highlight ? 'var(--color-accent-active)' : 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}
