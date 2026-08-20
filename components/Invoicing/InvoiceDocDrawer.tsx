'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Invoice } from './mockData';

// Right-hand drawer that shows the supplier's original invoice as a rendered
// "PDF" — a paper document on a grey backdrop, matching what a bookkeeper
// would see if they opened the emailed attachment.

const SUPPLIER_DETAILS: Record<string, { address: string; vatNo: string; phone: string }> = {
  'Bidfood': { address: '814 Leeds Road, Slough SL1 4JG', vatNo: 'GB 730 8148 83', phone: '01753 484 100' },
  'Fresh Direct': { address: 'Bicester Distribution Park, Bicester OX26 4SS', vatNo: 'GB 512 3346 71', phone: '01869 365 600' },
  'Metro': { address: '22 Camley Street, London N1C 4PF', vatNo: 'GB 204 8871 22', phone: '020 7387 5511' },
};

const DEFAULT_SUPPLIER = { address: '1 Supplier Way, London E1 6AN', vatNo: 'GB 000 0000 00', phone: '020 0000 0000' };

export default function InvoiceDocDrawer({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const supplier = SUPPLIER_DETAILS[invoice.supplier] ?? DEFAULT_SUPPLIER;
  const fileName = `${invoice.invoiceNumber}-${invoice.supplier.toLowerCase().replace(/\s+/g, '-')}.pdf`;

  const label: React.CSSProperties = { fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8a86', marginBottom: '3px' };

  // Portalled to <body> — the layout's content wrapper creates a stacking
  // context (z-index 1) that would otherwise trap the drawer under the header.
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 20, 20, 0.10)', zIndex: 950 }}
    >
      <style>{`
        @keyframes invoice-doc-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <aside
        role="dialog"
        aria-label={`Invoice document ${invoice.invoiceNumber}`}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(580px, 94vw)',
          background: '#E8E8E5',
          boxShadow: '-16px 0 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'invoice-doc-slide-in 0.22s ease-out',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Drawer chrome */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px',
          background: '#fff',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '9px', fontWeight: 800, letterSpacing: '0.06em',
            padding: '3px 7px', borderRadius: '4px',
            background: '#B01038', color: '#fff',
          }}>
            PDF
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            · received by email
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Close invoice document"
            style={{
              padding: '6px 10px', borderRadius: '6px',
              background: 'transparent', border: '1px solid var(--color-border)',
              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)', cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Scrollable backdrop with the paper document */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 40px' }}>
          <div style={{
            background: '#fff',
            borderRadius: '3px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
            padding: '36px 38px',
            maxWidth: '520px',
            margin: '0 auto',
            color: '#1e1e1c',
          }}>
            {/* Letterhead */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
              <div>
                <div style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-0.01em' }}>{invoice.supplier}</div>
                <div style={{ fontSize: '11px', color: '#6b6b67', marginTop: '4px', lineHeight: 1.5 }}>
                  {supplier.address}<br />
                  VAT No. {supplier.vatNo} · {supplier.phone}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.14em', color: '#8a8a86' }}>INVOICE</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>{invoice.invoiceNumber}</div>
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: '28px', marginBottom: '26px', flexWrap: 'wrap' }}>
              <div>
                <div style={label}>Billed to</div>
                <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.5 }}>
                  Fitzroy Espresso<br />
                  <span style={{ fontWeight: 400, color: '#6b6b67' }}>12 Fitzroy Lane, London EC1V 4NX</span>
                </div>
              </div>
              <div>
                <div style={label}>Invoice date</div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{invoice.date}</div>
              </div>
              <div>
                <div style={label}>Terms</div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Net 30</div>
              </div>
            </div>

            {/* Lines */}
            {invoice.lines.length === 0 ? (
              <div style={{ padding: '28px 0', fontSize: '12px', color: '#6b6b67', fontStyle: 'italic', borderTop: '2px solid #1e1e1c', borderBottom: '1px solid #d9d9d4' }}>
                Line detail illegible in scanned copy.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr>
                    {['Description', 'Qty', 'Unit $', 'Amount $'].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 0 ? 'left' : 'right',
                        padding: '8px 0',
                        borderBottom: '2px solid #1e1e1c',
                        fontSize: '10px', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: '#1e1e1c',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map(line => (
                    <tr key={line.id}>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #ececea' }}>
                        {line.description}
                        <span style={{ color: '#a0a09b', fontSize: '10px', marginLeft: '6px' }}>{line.sku}</span>
                      </td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #ececea', textAlign: 'right' }}>{line.qty}</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #ececea', textAlign: 'right' }}>{line.unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '8px 0', borderBottom: '1px solid #ececea', textAlign: 'right', fontWeight: 600 }}>{line.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <div style={{ width: '200px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#6b6b67' }}>
                  <span>Subtotal</span>
                  <span>${invoice.total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#6b6b67' }}>
                  <span>VAT</span>
                  <span>$0.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: '4px', borderTop: '2px solid #1e1e1c', fontWeight: 800, fontSize: '14px' }}>
                  <span>Total due</span>
                  <span>${invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '34px', paddingTop: '14px', borderTop: '1px solid #ececea', fontSize: '10px', color: '#8a8a86', lineHeight: 1.6 }}>
              Payment to: {invoice.supplier} Ltd · Sort 20-00-00 · Account 55512345 · Ref {invoice.invoiceNumber}<br />
              Queries: accounts@{invoice.supplier.toLowerCase().replace(/\s+/g, '')}.co.uk · Thank you for your business.
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
