'use client';

import { useRef, useState, useMemo } from 'react';
import StatusBadge from './StatusBadge';
import Stepper from './Stepper';
import { MOCK_POS, PO, POLine, poItemCount, poTotal } from './mockData';
import { useProducts, findSupplier } from '@/components/Suppliers/store';
import { formatPrice, type Product } from '@/components/Suppliers/fixtures';

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

/* ──────────── Add catalogue item (already-known product, not on the PO) ──────────── */

/**
 * An existing catalogue product added to the GRN that wasn't on the PO —
 * e.g. the GM phoned the supplier after the PO went out and got an item
 * added to the order, so it arrives on the delivery + invoice but isn't
 * on any PO line. Staged locally and committed on "Confirm Delivery" so
 * the GRN matches the invoice.
 */
export interface CatalogueExtra {
  /** Local-only id for list rendering before commit. */
  id: string;
  productId: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
  qty: number;
}

interface AddCatalogueItemModalProps {
  /** Supplier on the delivery — their products are listed first. */
  supplierName: string;
  onAdd: (extra: CatalogueExtra) => void;
  onClose: () => void;
}

export function AddCatalogueItemModal({ supplierName, onAdd, onClose }: AddCatalogueItemModalProps) {
  const products = useProducts();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const supplierOf = (p: Product) => findSupplier(p.supplierId)?.name ?? '';
    const list = products
      .filter(p => p.source !== 'made' && p.status === 'Available')
      .filter(p => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.supplierCode.toLowerCase().includes(q) ||
          supplierOf(p).toLowerCase().includes(q)
        );
      });
    // Products from the delivery's supplier float to the top — that's
    // almost always where the off-PO item came from.
    const sLower = supplierName.toLowerCase();
    return list
      .sort((a, b) => {
        const aMatch = supplierOf(a).toLowerCase().includes(sLower) ? 0 : 1;
        const bMatch = supplierOf(b).toLowerCase().includes(sLower) ? 0 : 1;
        return aMatch - bMatch || a.name.localeCompare(b.name);
      })
      .slice(0, 30);
  }, [products, search, supplierName]);

  const handleAdd = () => {
    if (!selected || qty <= 0) return;
    onAdd({
      id: `extra-${Date.now()}`,
      productId: selected.id,
      name: selected.name,
      sku: selected.supplierCode,
      unit: selected.packType === 'Pack' ? 'PACK' : 'EA',
      price: selected.packCost,
      qty,
    });
    onClose();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
        Add item from catalogue
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
        For items added to the order after the PO was sent — they&rsquo;ll be
        recorded on the GRN so the invoice matches.
      </p>

      <input
        type="text"
        placeholder="Search your catalogue by name, code or supplier…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
        autoFocus
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

      {matches.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
          No catalogue products match.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
          {matches.map(p => {
            const isSelected = selected?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(isSelected ? null : p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: isSelected
                    ? '1.5px solid var(--color-accent-active)'
                    : '1px solid var(--color-border-subtle)',
                  background: isSelected ? 'var(--color-bg-hover)' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-primary)',
                  width: '100%',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {p.supplierCode} · {findSupplier(p.supplierId)?.name ?? 'Unknown supplier'}
                  </div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                  {formatPrice(p.packCost)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: '8px',
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border-subtle)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Quantity received
          </span>
          <Stepper value={qty} onChange={setQty} label={selected.name} />
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
        <button
          onClick={handleAdd}
          disabled={!selected || qty <= 0}
          style={{
            ...primaryBtnStyle,
            opacity: !selected || qty <= 0 ? 0.5 : 1,
            cursor: !selected || qty <= 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Add to GRN
        </button>
      </div>
    </ModalOverlay>
  );
}

/* ──────────── Resolve line — action chooser ──────────── */

interface LineActionModalProps {
  line: POLine;
  onReject: () => void;
  onAddProduct: () => void;
  onAcceptPrice: () => void;
  onClose: () => void;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style: { flexShrink: 0 },
};

function RejectIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7-7V4h9.6l7.4 7.4a2 2 0 0 1 0 2z" />
      <circle cx="7.8" cy="7.8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * When a delivered line doesn't match the PO, the user picks how to resolve it.
 * Only "Add a substitute item" is wired up today; reject / accept-price are stubs
 * for future flows.
 */
export function LineActionModal({ line, onReject, onAddProduct, onAcceptPrice, onClose }: LineActionModalProps) {
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Edit “{line.name}”
        </h3>
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <button onClick={onReject} style={captureOptionStyle}>
          <span style={optionTitleRowStyle}>
            <RejectIcon />
            Reject item sent
          </span>
          <span style={optionDescStyle}>Flag it to send back to the supplier.</span>
        </button>
        <button onClick={onAddProduct} style={captureOptionStyle}>
          <span style={optionTitleRowStyle}>
            <AddIcon />
            Add a substitute item
          </span>
          <span style={optionDescStyle}>Log it and link it to a master product.</span>
        </button>
        <button onClick={onAcceptPrice} style={captureOptionStyle}>
          <span style={optionTitleRowStyle}>
            <PriceIcon />
            Accept a new price
          </span>
          <span style={optionDescStyle}>Accept the supplier&apos;s updated price.</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
      </div>
    </ModalOverlay>
  );
}

/* ──────────── Scan GRN — capture photo ──────────── */

interface ScanCaptureModalProps {
  po?: PO;
  /** Called with the captured/uploaded photo URL (or null for the sample). */
  onCaptured: (imageUrl: string | null) => void;
  onClose: () => void;
}

/**
 * Phone-first capture step for "Scan GRN": the user either snaps a photo of
 * the supplier's delivery note with their camera or uploads one they already
 * took. Once a photo is chosen we hand it back to the receiving flow, which
 * runs the (mock) extraction and prefills the alternative-product form.
 */
export function ScanCaptureModal({ po, onCaptured, onClose }: ScanCaptureModalProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          Add GRN
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.45 }}>
          Take a photo of the supplier&apos;s delivery note, or upload one from your phone.
          {po ? ` ${po.supplier} · ${po.poNumber}` : ''}
        </p>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      {preview ? (
        <>
          <div
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-hover)',
              marginBottom: 16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Captured GRN" style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => { setPreview(null); }} style={cancelBtnStyle}>Retake</button>
            <button onClick={() => onCaptured(preview)} style={primaryBtnStyle}>Scan this GRN</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <button onClick={() => cameraInputRef.current?.click()} style={captureOptionStyle}>
              <span style={{ fontSize: 26 }}>📷</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Take photo</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Use your camera to snap the delivery note now
              </span>
            </button>
            <button onClick={() => uploadInputRef.current?.click()} style={captureOptionStyle}>
              <span style={{ fontSize: 26 }}>🖼️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Upload photo</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                Choose a photo of the GRN you already took
              </span>
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <button onClick={() => onCaptured(null)} style={sampleLinkStyle}>Use sample GRN photo</button>
            <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          </div>
        </>
      )}
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

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '8px',
  background: 'var(--color-accent-active)',
  border: 'none',
  fontSize: '13px',
  fontWeight: 700,
  fontFamily: 'var(--font-primary)',
  color: '#fff',
  cursor: 'pointer',
};

const captureOptionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '16px 18px',
  borderRadius: 12,
  border: '1px solid var(--color-border)',
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'var(--font-primary)',
  width: '100%',
};

const optionTitleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)',
};

const optionDescStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4,
};

const sampleLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-accent-deep)',
  cursor: 'pointer',
};
