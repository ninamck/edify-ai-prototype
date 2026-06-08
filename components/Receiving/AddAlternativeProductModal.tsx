'use client';

/**
 * Modal for logging an alternative / off-PO product a supplier actually
 * delivered. The user describes the new SKU (pack details + cost), links it to
 * a master product (existing or freshly created), and sees a live preview of
 * how the delivery will blend into the master's weighted-average cost (WAC).
 *
 * Nothing is written to the catalogue here — the modal returns a
 * `StagedAlternative` which the receiving flow commits on "Confirm Delivery".
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMasterProducts } from '@/components/Suppliers/store';
import { createMasterProductFromName } from '@/components/Ingredients/catalogue';
import { formatPrice } from '@/components/Suppliers/fixtures';
import { ScanCaptureModal } from './ReceivingModals';
import type { POLine } from './mockData';

export type PackType = 'Pack' | 'Single';
export type SingleUnitType = 'Each' | 'kg' | 'L' | 'g' | 'ml';

export interface StagedAlternative {
  /** Local-only id for list rendering before commit. */
  id: string;
  /** PO line this substitutes, when the supplier sent a different item for an
   *  ordered line. Absent for a standalone "unexpected item". */
  originPoLineId?: string;
  masterProductId: string;
  masterName: string;
  masterUnit: string;
  productName: string;
  supplierCode: string;
  packType: PackType;
  packQty: number;
  singleUnitType: SingleUnitType;
  packCost: number;
  /** Number of packs received. */
  receivedQty: number;
  /** Supplier name from the originating PO (resolved to a Supplier on commit). */
  supplierName: string;
  /** Site the delivery's WAC updates against. */
  site: string;
}

export type AlternativeProductPrefill = Partial<Pick<
  StagedAlternative,
  'masterProductId' | 'productName' | 'supplierCode' | 'packType' | 'packQty' | 'singleUnitType' | 'packCost' | 'receivedQty'
>>;

interface AddAlternativeProductModalProps {
  originLine?: POLine;
  initialValues?: AlternativeProductPrefill;
  /** Kick off a mock GRN scan as soon as the modal mounts. */
  autoScan?: boolean;
  /** Photo of the GRN captured/uploaded in the scan step, shown as a thumbnail. */
  scanImageUrl?: string | null;
  supplierName: string;
  site: string;
  onSave: (alt: StagedAlternative) => void;
  onClose: () => void;
}

function localId(): string {
  return `alt-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AddAlternativeProductModal({
  originLine,
  initialValues,
  autoScan,
  scanImageUrl,
  supplierName,
  site,
  onSave,
  onClose,
}: AddAlternativeProductModalProps) {
  const masters = useMasterProducts();

  // Render into document.body so the overlay escapes any ancestor stacking
  // context (the receiving layout's sticky/transformed wrappers would
  // otherwise trap a `position: fixed` modal beneath the top-level menu).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const initialMasterId = initialValues?.masterProductId ?? originLine?.masterProductId ?? '';
  const [masterId, setMasterId] = useState<string>(initialMasterId);
  const [masterQuery, setMasterQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(!initialMasterId);

  const [productName, setProductName] = useState(initialValues?.productName ?? '');
  const [supplierCode, setSupplierCode] = useState(initialValues?.supplierCode ?? '');
  const [packType, setPackType] = useState<PackType>(initialValues?.packType ?? 'Pack');
  const [packQty, setPackQty] = useState<number>(initialValues?.packQty ?? originLine?.unitsPerLineItem ?? 1);
  const [singleUnitType, setSingleUnitType] = useState<SingleUnitType>(initialValues?.singleUnitType ?? 'Each');
  const [packCost, setPackCost] = useState<number>(initialValues?.packCost ?? originLine?.price ?? 0);
  const [receivedQty, setReceivedQty] = useState<number>(initialValues?.receivedQty ?? 1);

  // Mock GRN scan: shows a brief "scanning" state, then fills every field so
  // the user only has to review and confirm.
  const [scanning, setScanning] = useState(false);
  const [scannedApplied, setScannedApplied] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const bannerImage = capturedImage ?? scanImageUrl;

  function handleCaptured(imageUrl: string | null) {
    setCapturedImage(imageUrl);
    setCaptureOpen(false);
    runScan();
  }

  function runScan() {
    setScanning(true);
    setTimeout(() => {
      const egg = masters.find((m) => m.name.toLowerCase().includes('egg'));
      if (egg) {
        setMasterId(egg.id);
        setPickerOpen(false);
      }
      setProductName('Free range eggs 4pk');
      setSupplierCode('FRE-4');
      setPackType('Pack');
      setPackQty(4);
      setSingleUnitType('Each');
      setPackCost(4);
      setReceivedQty(originLine?.expectedQty ?? 1);
      setScannedApplied(true);
      setScanning(false);
    }, 1100);
  }

  useEffect(() => {
    if (autoScan) runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMaster = useMemo(
    () => masters.find((m) => m.id === masterId) ?? null,
    [masters, masterId],
  );

  const matches = useMemo(() => {
    const q = masterQuery.trim().toLowerCase();
    if (!q) return masters.slice(0, 8);
    return masters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [masters, masterQuery]);

  const exactMatch = masters.some(
    (m) => m.name.toLowerCase() === masterQuery.trim().toLowerCase(),
  );

  // ── WAC preview ────────────────────────────────────────────────────────────
  const perUnitCost = packQty > 0 ? packCost / packQty : 0;
  const deliveredUnits = receivedQty * packQty;
  const prevSite = selectedMaster?.siteCosts?.[site];
  const currentWac = prevSite?.wac ?? null;
  const currentQty = prevSite?.onHandQty ?? 0;
  const newWac =
    currentWac != null && currentQty > 0 && deliveredUnits > 0
      ? (currentQty * currentWac + deliveredUnits * perUnitCost) / (currentQty + deliveredUnits)
      : perUnitCost;

  const canSave =
    !!selectedMaster &&
    productName.trim().length > 0 &&
    packQty > 0 &&
    packCost > 0 &&
    receivedQty > 0;

  function chooseMaster(id: string) {
    setMasterId(id);
    setPickerOpen(false);
  }

  function createMaster() {
    const name = masterQuery.trim();
    if (!name) return;
    const mp = createMasterProductFromName({ name, unit: 'each' });
    setMasterId(mp.id);
    setPickerOpen(false);
  }

  function handleSave() {
    if (!selectedMaster || !canSave) return;
    onSave({
      id: localId(),
      originPoLineId: originLine?.id,
      masterProductId: selectedMaster.id,
      masterName: selectedMaster.name,
      masterUnit: selectedMaster.unit,
      productName: productName.trim(),
      supplierCode: supplierCode.trim(),
      packType,
      packQty,
      singleUnitType,
      packCost,
      receivedQty,
      supplierName,
      site,
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
              {originLine ? 'Received a different item' : 'Add unexpected item'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
              {originLine
                ? `${supplierName} sent a different product for "${originLine.name}". Add it so cost and stock stay accurate.`
                : `${supplierName} delivered an item that wasn't on the PO. Add it to the catalogue.`}
            </p>
          </div>
          <button onClick={() => setCaptureOpen(true)} disabled={scanning} style={scanBtnStyle}>
            {scanning ? 'Scanning…' : '📷 Add GRN'}
          </button>
        </div>

        {scanning && (
          <div style={scanBannerStyle}>
            {bannerImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerImage} alt="Scanned GRN" style={scanThumbStyle} />
            )}
            <span>📷 Scanning supplier GRN… matching pack size, supplier code, quantity and cost.</span>
          </div>
        )}
        {scannedApplied && !scanning && (
          <div style={scanBannerStyle}>
            {bannerImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerImage} alt="Scanned GRN" style={scanThumbStyle} />
            )}
            <span>✓ Prefilled from scanned GRN — review the details below and confirm.</span>
          </div>
        )}

        {/* Master product link */}
        <Field label="Linked master product">
          {selectedMaster && !pickerOpen ? (
            <div style={selectedMasterStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {selectedMaster.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  per {selectedMaster.unit} · {selectedMaster.category}
                </div>
              </div>
              <button onClick={() => { setPickerOpen(true); setMasterQuery(''); }} style={linkBtnStyle}>
                Change
              </button>
            </div>
          ) : (
            <div>
              <input
                autoFocus
                value={masterQuery}
                onChange={(e) => setMasterQuery(e.target.value)}
                placeholder="Search master products (e.g. eggs)…"
                style={inputStyle}
              />
              <div style={pickerListStyle}>
                {matches.map((m) => (
                  <button key={m.id} onClick={() => chooseMaster(m.id)} style={pickerRowStyle}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>per {m.unit}</span>
                  </button>
                ))}
                {masterQuery.trim() && !exactMatch && (
                  <button onClick={createMaster} style={{ ...pickerRowStyle, color: 'var(--color-accent-deep)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-accent-deep)' }}>
                      + Create master product “{masterQuery.trim()}”
                    </span>
                  </button>
                )}
                {matches.length === 0 && !masterQuery.trim() && (
                  <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    Start typing to find a master product.
                  </div>
                )}
              </div>
            </div>
          )}
        </Field>

        {/* Product details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Product name" span={2}>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Free range eggs 30pk"
              style={inputStyle}
            />
          </Field>
          <Field label="Supplier code">
            <input
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              placeholder="e.g. EGG-30"
              style={inputStyle}
            />
          </Field>
          <Field label="Pack type">
            <select value={packType} onChange={(e) => setPackType(e.target.value as PackType)} style={inputStyle}>
              <option value="Pack">Pack</option>
              <option value="Single">Single</option>
            </select>
          </Field>
          <Field label={`Units per pack (${selectedMaster?.unit ?? 'unit'})`}>
            <input
              type="number"
              min={1}
              value={packQty}
              onChange={(e) => setPackQty(Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Single unit type">
            <select
              value={singleUnitType}
              onChange={(e) => setSingleUnitType(e.target.value as SingleUnitType)}
              style={inputStyle}
            >
              {(['Each', 'kg', 'L', 'g', 'ml'] as SingleUnitType[]).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label="Pack cost ex VAT (£)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={packCost}
              onChange={(e) => setPackCost(Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Received (packs)">
            <input
              type="number"
              min={1}
              value={receivedQty}
              onChange={(e) => setReceivedQty(Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
        </div>

        {/* WAC preview */}
        {selectedMaster && packQty > 0 && packCost > 0 && (
          <div style={previewStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{packType} price</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {formatPrice(packCost)} / {packType.toLowerCase()}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Unit cost</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {formatPrice(perUnitCost)} / {selectedMaster.unit}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Delivering</span>
              <span style={{ color: 'var(--color-text-primary)' }}>
                {deliveredUnits.toLocaleString()} {selectedMaster.unit}{deliveredUnits === 1 ? '' : 's'} → {site}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingTop: 8, borderTop: '1px solid var(--color-border-subtle)' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Weighted avg cost</span>
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
                {currentWac != null ? `${formatPrice(currentWac)} → ` : ''}
                <span style={{ color: 'var(--color-success)' }}>{formatPrice(newWac)}</span>
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              ...primaryBtnStyle,
              background: canSave ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
              color: canSave ? '#fff' : 'var(--color-text-secondary)',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            Add to delivery
          </button>
        </div>
      </div>

      {captureOpen && (
        <ScanCaptureModal
          onCaptured={handleCaptured}
          onClose={() => setCaptureOpen(false)}
        />
      )}
    </div>,
    document.body,
  );
}

function Field({ label, span = 1, children }: { label: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div style={{ gridColumn: `span ${span}`, marginBottom: 0 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 20,
};

const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: 26,
  width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
  fontFamily: 'var(--font-primary)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
  display: 'flex', flexDirection: 'column', gap: 14,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: '#fff',
  fontSize: 14, fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box',
};

const selectedMasterStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  padding: '10px 12px', borderRadius: 8,
  background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, color: 'var(--color-accent-deep)',
  fontFamily: 'var(--font-primary)', flexShrink: 0,
};

const pickerListStyle: React.CSSProperties = {
  marginTop: 6, border: '1px solid var(--color-border-subtle)', borderRadius: 8,
  overflow: 'hidden', display: 'flex', flexDirection: 'column',
};

const pickerRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  padding: '10px 12px', background: '#fff', border: 'none',
  borderBottom: '1px solid var(--color-border-subtle)',
  cursor: 'pointer', fontFamily: 'var(--font-primary)', fontSize: 13, textAlign: 'left',
};

const previewStyle: React.CSSProperties = {
  marginTop: 4, padding: '12px 14px', borderRadius: 10,
  background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 8, border: 'none',
  fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-primary)',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: '#fff',
  color: 'var(--color-text-secondary)', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)',
};

const scanBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--color-border)', background: '#fff',
  color: 'var(--color-text-primary)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap',
};

const scanBannerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 12px', borderRadius: 8,
  background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)',
  fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.4,
};

const scanThumbStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
  border: '1px solid var(--color-border-subtle)',
};
