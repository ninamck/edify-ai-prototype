'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GRN } from '@/components/Receiving/mockData';

// Right-hand drawer showing one delivery's full goods-received note: who
// signed, when, against which POs, and every line as counted at the door.
// Reached from delivery chips in the match table — the table stays the
// matching surface; this is the evidence behind one delivery.

export default function GRNDocDrawer({ grn, onClose }: { grn: GRN; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const total = grn.lines.reduce((s, l) => s + l.receivedQty * l.price, 0);
  const shortLines = grn.lines.filter(l => l.receivedQty < l.expectedQty);

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
        @keyframes grn-doc-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <aside
        role="dialog"
        aria-label={`Goods received note ${grn.grnNumber}`}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(560px, 94vw)',
          background: '#fff',
          boxShadow: '-16px 0 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'grn-doc-slide-in 0.22s ease-out',
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
            background: 'var(--color-accent-active)', color: '#fff',
          }}>
            GRN
          </span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {grn.grnNumber}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            · goods received note
          </span>
          <div style={{ flex: 1 }} />
          <a
            href={`/receive/grn/${grn.id}`}
            style={{
              padding: '6px 10px', borderRadius: '6px',
              background: 'transparent', border: '1px solid var(--color-border)',
              fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)',
              color: 'var(--color-accent-active)', textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Open in Receiving →
          </a>
          <button
            onClick={onClose}
            aria-label="Close goods received note"
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
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{grn.supplier}</div>
            </div>
            <div>
              <div style={label}>Received</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{grn.dateReceived}</div>
            </div>
            <div>
              <div style={label}>Signed by</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{grn.receivedBy}</div>
            </div>
            <div>
              <div style={label}>Against PO</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{grn.poNumbers.join(' + ')}</div>
            </div>
            <div>
              <div style={label}>Site</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{grn.site}</div>
            </div>
          </div>

          {shortLines.length > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#fff', border: '1px solid var(--color-warning-border)', borderLeft: '3px solid var(--color-warning)', fontSize: '12px', color: 'var(--color-text-primary)', marginBottom: '16px' }}>
              {shortLines.length} line{shortLines.length === 1 ? '' : 's'} received short on this delivery — {shortLines.map(l => `${l.name} (${l.receivedQty} of ${l.expectedQty})`).join(', ')}.
            </div>
          )}

          {/* Lines as counted at the door */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>Item</th>
                <th style={th}>Expected</th>
                <th style={th}>Received</th>
                <th style={th}>Unit £</th>
                <th style={th}>Total £</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map(line => {
                const short = line.receivedQty < line.expectedQty;
                return (
                  <tr key={line.id}>
                    <td style={{ ...td, textAlign: 'left', paddingLeft: 0 }}>
                      {line.name}
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px', marginLeft: '6px' }}>{line.sku}</span>
                      {line.alternativeFor && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Accepted alternative — PO ordered {line.alternativeFor.poName}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, color: 'var(--color-text-secondary)' }}>{line.expectedQty}</td>
                    <td style={{ ...td, fontWeight: short ? 700 : 500 }}>
                      {line.receivedQty}
                      {short && <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-warning)', marginLeft: '5px' }}>short</span>}
                    </td>
                    <td style={td}>{line.price.toFixed(2)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{(line.receivedQty * line.price).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ padding: '10px 10px 0 0', textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>Delivery total</td>
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
