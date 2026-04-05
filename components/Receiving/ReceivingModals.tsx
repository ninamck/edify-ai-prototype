'use client';

import { useState, useMemo } from 'react';
import StatusBadge from './StatusBadge';
import { MOCK_POS, PO, poItemCount, poTotal } from './mockData';

/* ──────────── Add PO Modal ──────────── */

interface AddPOModalProps {
  excludeIds: string[];
  onAdd: (poId: string) => void;
  onClose: () => void;
}

export function AddPOModal({ excludeIds, onAdd, onClose }: AddPOModalProps) {
  const [search, setSearch] = useState('');

  const available = useMemo(() => {
    return MOCK_POS.filter(po => !excludeIds.includes(po.id))
      .filter(po => po.status === 'Sent' || po.status === 'Partially Received')
      .filter(po => {
        if (!search) return true;
        const q = search.toLowerCase();
        return po.supplier.toLowerCase().includes(q) || po.poNumber.toLowerCase().includes(q);
      });
  }, [excludeIds, search]);

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
        Add Purchase Order
      </h3>

      <input
        type="text"
        placeholder="Search by supplier or PO number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          fontSize: '13px',
          fontFamily: 'var(--font-primary)',
          marginBottom: '14px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {available.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
          No additional POs available.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
          {available.map(po => (
            <PORow key={po.id} po={po} onAdd={() => { onAdd(po.id); onClose(); }} />
          ))}
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
      </div>
    </ModalOverlay>
  );
}

function PORow({ po, onAdd }: { po: PO; onAdd: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        gap: '10px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{po.poNumber}</span>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{po.supplier}</span>
          <StatusBadge status={po.status} />
        </div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '3px' }}>
          {poItemCount(po)} items · {poTotal(po)}
        </div>
      </div>
      <button
        onClick={onAdd}
        style={{
          padding: '7px 16px',
          borderRadius: '6px',
          background: 'var(--color-accent-active)',
          color: '#fff',
          border: 'none',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'var(--font-primary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Add
      </button>
    </div>
  );
}

/* ──────────── Scan GRN Modal (v2 placeholder) ──────────── */

interface ScanGRNModalProps {
  onClose: () => void;
}

export function ScanGRNModal({ onClose }: ScanGRNModalProps) {
  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
        Scan GRN
      </h3>
      <div
        style={{
          padding: '40px 24px',
          borderRadius: '10px',
          background: 'var(--color-bg-hover)',
          border: '2px dashed var(--color-border)',
          textAlign: 'center',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📷</div>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
          Barcode / QR scanning
        </p>
        <StatusBadge status="Coming in v2" variant="info" />
        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '10px 0 0' }}>
          Scan a supplier GRN barcode to auto-match against purchase orders.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={cancelBtnStyle}>Close</button>
      </div>
    </ModalOverlay>
  );
}

/* ──────────── Shared ──────────── */

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
          maxWidth: '480px',
          fontFamily: 'var(--font-primary)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '8px',
  background: '#fff',
  border: '1px solid var(--color-border)',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};
