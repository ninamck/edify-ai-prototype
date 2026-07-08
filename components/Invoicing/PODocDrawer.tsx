'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PO } from '@/components/Receiving/mockData';

// Right-hand drawer showing one purchase order in full: what was agreed with
// the supplier — items, quantities and prices — before anything was delivered
// or billed. Reached from PO chips in the match view; the table itself stays
// invoice-vs-received, with the PO as the price authority behind it.

export default function PODocDrawer({ po, onClose }: { po: PO; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = po.lines.reduce((s, l) => s + l.expectedQty * l.price, 0);

  const label: React.CSSProperties = { fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '3px' };
  const th: React.CSSProperties = { textAlign: 'right', padding: '8px 0 8px 10px', borderBottom: '2px solid var(--color-text-primary)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 0 8px 10px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right', fontSize: '12px' };

  // Portalled to <body> — the layout's content wrapper creates a stacking
  // context that would otherwise trap the drawer under the header.
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 20, 20, 0.10)', zIndex: 950 }}
    >
      <style>{`
        @keyframes po-doc-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <aside
        role="dialog"
        aria-label={`Purchase order ${po.poNumber}`}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(560px, 94vw)',
          background: '#fff',
          boxShadow: '-16px 0 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'po-doc-slide-in 0.22s ease-out',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Drawer chrome */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '9px', fontWeight: 800, letterSpacing: '0.06em',
            padding: '3px 7px', borderRadius: '4px',
            background: 'var(--color-text-primary)', color: '#fff',
          }}>
            PO
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {po.poNumber}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            · purchase order
          </span>
          <div style={{ flex: 1 }} />
          <a
            href={`/purchase-orders/${po.id}`}
            style={{
              padding: '6px 10px', borderRadius: '6px',
              background: 'transparent', border: '1px solid var(--color-border)',
              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
              color: 'var(--color-accent-active)', textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Open PO page →
          </a>
          <button
            onClick={onClose}
            aria-label="Close purchase order"
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

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>
          {/* Meta */}
          <div style={{ display: 'flex', gap: '28px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={label}>Supplier</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{po.supplier}</div>
            </div>
            <div>
              <div style={label}>Sent</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{po.dateSent}</div>
            </div>
            <div>
              <div style={label}>Status</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{po.status}</div>
            </div>
            <div>
              <div style={label}>Site</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{po.site}</div>
            </div>
          </div>

          {/* Lines as ordered */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>Item</th>
                <th style={th}>Ordered</th>
                <th style={th}>Unit £</th>
                <th style={th}>Total £</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map(line => (
                <tr key={line.id}>
                  <td style={{ ...td, textAlign: 'left', paddingLeft: 0 }}>
                    {line.name}
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginLeft: '6px' }}>{line.sku}</span>
                  </td>
                  <td style={td}>{line.expectedQty} {line.unit}</td>
                  <td style={td}>{line.price.toFixed(2)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{(line.expectedQty * line.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: '10px 10px 0 0', textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>Order total</td>
                <td style={{ padding: '10px 0 0 10px', textAlign: 'right', fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap' }}>£{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </aside>
    </div>,
    document.body
  );
}
