'use client';

import { useEffect, useState, useMemo } from 'react';
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

/* ──────────── Scan GRN Modal ──────────── */

interface ScanGRNModalProps {
  po?: PO;
  eggLineName?: string;
  onOpenEditable?: () => void;
  onConfirmScan?: () => void;
  onClose: () => void;
}

export function ScanGRNModal({ po, eggLineName, onOpenEditable, onConfirmScan, onClose }: ScanGRNModalProps) {
  const [phase, setPhase] = useState<'scanning' | 'review'>('scanning');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('review'), 1100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          {phase === 'scanning' ? 'Scanning GRN' : 'Review scanned GRN'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.45 }}>
          {phase === 'scanning'
            ? 'Reading the supplier document and matching it against the selected purchase order.'
            : 'We found an alternative egg pack on the supplier GRN. Confirm the extracted details, or open the editable form to change them.'}
        </p>
      </div>
      {phase === 'scanning' ? (
        <div
          style={{
            padding: '32px 24px',
            borderRadius: '10px',
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border-subtle)',
            textAlign: 'center',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 10 }}>📷</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            Scanning supplier GRN…
          </div>
          <StatusBadge status="Matching PO lines" variant="info" />
          <div style={{ height: 6, borderRadius: 999, background: '#fff', border: '1px solid var(--color-border-subtle)', overflow: 'hidden', marginTop: 18 }}>
            <div style={{ width: '72%', height: '100%', background: 'var(--color-accent-active)' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '12px 0 0', lineHeight: 1.45 }}>
            Checking product name, pack size, supplier code, quantity and cost.
          </p>
        </div>
      ) : (
        <>
      <div
        style={{
          padding: '18px 20px',
          borderRadius: '10px',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-subtle)',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Supplier GRN scan
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {po ? `${po.supplier} · ${po.poNumber} · ${po.site}` : 'Bidfood · PO-2901 · Fitzroy Espresso'}
            </div>
          </div>
          <StatusBadge status="Recognised" variant="info" />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <ScanDetailRow label="Ordered on PO" value={eggLineName ?? 'Free range eggs 15pk'} />
          <ScanDetailRow label="Found on GRN" value="Free range eggs 4pk" strong />
          <ScanDetailRow label="Action" value="Create new supplier product and link to Free Range Eggs" />
          <ScanDetailRow label="Linked master" value="Free Range Eggs · per egg" />
          <ScanDetailRow label="Supplier code" value="FRE-4" />
          <ScanDetailRow label="Pack details" value="Pack · 4 eggs per pack · £4.00 per pack" />
          <ScanDetailRow label="Normalised cost" value="£1.00 per egg" />
          <ScanDetailRow label="Delivery update" value="Set ordered egg line to 0 and add the alternative as a new row" />
        </div>
      </div>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
        {phase === 'review' && onOpenEditable && (
          <button
            onClick={() => {
              onOpenEditable();
              onClose();
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#fff',
              border: '1px solid var(--color-border-subtle)',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Open editable details
          </button>
        )}
        {phase === 'review' && onConfirmScan && (
          <button
            onClick={() => {
              onConfirmScan();
              onClose();
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: 'var(--color-accent-active)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Confirm
          </button>
        )}
      </div>
    </ModalOverlay>
  );
}

function ScanDetailRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '130px 1fr',
      gap: 10,
      alignItems: 'baseline',
      fontSize: 12.5,
      lineHeight: 1.35,
    }}>
      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
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
