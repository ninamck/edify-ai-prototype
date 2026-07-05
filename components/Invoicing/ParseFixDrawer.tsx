'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Invoice, updateInvoiceLine } from './mockData';

// Sidebar for correcting parsed invoice values when OCR misread the PDF.
// Edits write straight back to the invoice, so the match table on the main
// screen updates live — the backdrop is deliberately near-transparent so the
// user can watch the numbers change as they type.

export default function ParseFixDrawer({ invoice, focusLineId, onClose, onEdited }: {
  invoice: Invoice;
  focusLineId: string | null;
  onClose: () => void;
  onEdited: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const commit = (lineId: string, field: 'qty' | 'unitPrice', current: number, raw: string): boolean => {
    const n = parseFloat(raw);
    if (isNaN(n) || n < 0 || n === current) return false;
    updateInvoiceLine(invoice.id, lineId, { [field]: n });
    onEdited();
    return true;
  };

  const inputStyle: React.CSSProperties = {
    width: '76px', padding: '6px 8px', borderRadius: '6px',
    border: '1px solid var(--color-border)', fontSize: '13px',
    fontFamily: 'var(--font-primary)', background: '#fff',
    color: 'var(--color-text-primary)', textAlign: 'right', outline: 'none',
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 20, 20, 0.06)', zIndex: 960 }}
    >
      <style>{`
        @keyframes parse-fix-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <aside
        role="dialog"
        aria-label={`Fix parsed values for ${invoice.invoiceNumber}`}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(440px, 92vw)',
          background: '#fff',
          boxShadow: '-16px 0 40px rgba(0,0,0,0.16)',
          display: 'flex', flexDirection: 'column',
          animation: 'parse-fix-slide-in 0.22s ease-out',
          fontFamily: 'var(--font-primary)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Fix parsed values
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                padding: '5px 9px', borderRadius: '6px', background: 'transparent',
                border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600,
                fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            {invoice.invoiceNumber} · {invoice.supplier} — edit what the parser read off the PDF.
            Changes update the match table behind this panel immediately.
          </div>
        </div>

        {/* Lines */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {invoice.lines.map(line => {
            const hasVariance = invoice.variances.some(v => v.sku === line.sku);
            const isFocused = line.id === focusLineId;
            return (
              <div
                key={line.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: isFocused ? '1.5px solid #D97706' : '1px solid var(--color-border-subtle)',
                  background: hasVariance ? '#F9F4F0' : '#fff',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{line.description}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{line.sku}</div>
                  </div>
                  <div style={{ flex: 1 }} />
                  {hasVariance && (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                      border: '1px solid #D97706', background: '#FBF4E4',
                      color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}>
                      Variance
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Qty
                    <input
                      key={`${line.id}-qty-${line.qty}`}
                      type="number"
                      defaultValue={line.qty}
                      autoFocus={isFocused}
                      onBlur={e => { if (!commit(line.id, 'qty', line.qty, e.target.value)) e.target.value = String(line.qty); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                    Unit price £
                    <input
                      key={`${line.id}-price-${line.unitPrice}`}
                      type="number"
                      step="0.01"
                      defaultValue={line.unitPrice.toFixed(2)}
                      onBlur={e => { if (!commit(line.id, 'unitPrice', line.unitPrice, e.target.value)) e.target.value = line.unitPrice.toFixed(2); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={inputStyle}
                    />
                  </label>
                  <div style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', paddingBottom: '6px' }}>
                    £{line.lineTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: '8px',
              background: 'var(--color-accent-active)', color: '#fff', border: 'none',
              fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-primary)', cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
