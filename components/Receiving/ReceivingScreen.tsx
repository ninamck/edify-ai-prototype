'use client';

import { useState, useMemo } from 'react';
import Stepper from './Stepper';
import StatusBadge from './StatusBadge';
import ResponsiveDataList, { Column } from './ResponsiveDataList';
import { PO, POLine, VarianceResolution, poItemCount, poTotal } from './mockData';
import AddAlternativeProductModal, { type AlternativeProductPrefill, type StagedAlternative } from './AddAlternativeProductModal';
import { ScanCaptureModal, LineActionModal } from './ReceivingModals';
import { formatPrice } from '@/components/Suppliers/fixtures';

interface ReceivedLine {
  poLineId: string;
  receivedQty: number;
  resolution?: VarianceResolution;
}

/**
 * A row in the receiving table — either a real PO line or a staged
 * alternative the supplier sent in place of (or on top of) the order.
 */
type DisplayRow =
  | { kind: 'po'; line: POLine }
  | { kind: 'alt'; alt: StagedAlternative };

interface ReceivingScreenProps {
  pos: PO[];
  onConfirm: (data: { invoiceNumber: string; lines: ReceivedLine[]; alternatives: StagedAlternative[] }) => void;
  onBack: () => void;
  onAddPO: () => void;
}

const RESOLUTION_OPTIONS: VarianceResolution[] = [
  'Request credit note',
  'Back-order remaining',
  'Accept short',
];

function getVarianceLabel(expected: number, received: number): { label: string; variant: 'success' | 'warning' | 'error' } | null {
  if (received === expected) return null;
  if (received < expected) return { label: `Short ${expected - received}`, variant: 'error' };
  return { label: `Over ${received - expected}`, variant: 'warning' };
}

export default function ReceivingScreen({ pos, onConfirm, onBack, onAddPO }: ReceivingScreenProps) {
  const allLines = useMemo(() => pos.flatMap(po => po.lines), [pos]);

  const [receivedMap, setReceivedMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    allLines.forEach(l => { map[l.id] = l.expectedQty; });
    return map;
  });

  const [resolutionMap, setResolutionMap] = useState<Record<string, VarianceResolution>>({});
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<StagedAlternative[]>([]);
  const [altModal, setAltModal] = useState<{ open: boolean; line?: POLine; initialValues?: AlternativeProductPrefill; autoScan?: boolean } | null>(null);
  const [scanCapture, setScanCapture] = useState(false);
  const [scanImageUrl, setScanImageUrl] = useState<string | null>(null);
  const [grnFile, setGrnFile] = useState<{ name: string; image: string | null } | null>(null);
  const [lineActionLine, setLineActionLine] = useState<POLine | null>(null);

  const poForLine = (lineId: string): PO => pos.find(p => p.lines.some(l => l.id === lineId)) ?? pos[0];
  const modalPO = altModal?.line ? poForLine(altModal.line.id) : pos[0];

  const addAlternative = (alt: StagedAlternative) => {
    setAlternatives(prev => [...prev, alt]);
    // When the alternative substitutes an ordered line, that line wasn't
    // delivered — drop its received qty to 0 (it gets an "Alternative sent"
    // tag instead of a short-variance flag).
    if (alt.originPoLineId) {
      const originId = alt.originPoLineId;
      setReceivedMap(prev => ({ ...prev, [originId]: 0 }));
    }
    setAltModal(null);
  };
  const removeAlternative = (id: string) => {
    const removed = alternatives.find(a => a.id === id);
    setAlternatives(prev => prev.filter(a => a.id !== id));
    // Restore the substituted line's expected qty if nothing else replaces it.
    if (removed?.originPoLineId) {
      const stillSubstituted = alternatives.some(
        a => a.id !== id && a.originPoLineId === removed.originPoLineId,
      );
      if (!stillSubstituted) {
        const line = allLines.find(l => l.id === removed.originPoLineId);
        if (line) setReceivedMap(prev => ({ ...prev, [line.id]: line.expectedQty }));
      }
    }
  };

  const setQty = (lineId: string, qty: number) => {
    setReceivedMap(prev => ({ ...prev, [lineId]: qty }));
  };

  const setResolution = (lineId: string, res: VarianceResolution) => {
    setResolutionMap(prev => ({ ...prev, [lineId]: res }));
  };

  const scanEggLine = useMemo(
    () => allLines.find(l => l.masterProductId === 'mp-eggs') ?? allLines.find(l => l.sku === 'FRE-15'),
    [allLines],
  );
  const scanPO = scanEggLine ? poForLine(scanEggLine.id) : pos[0];

  // "Scan GRN" → capture a photo (camera/upload) → run the mock scan that
  // prefills the editable alternative-product form, so the user just confirms.
  const handleScanCaptured = (imageUrl: string | null) => {
    if (!scanEggLine || !scanPO) return;
    setScanImageUrl(imageUrl);
    setGrnFile({ name: 'scanned-grn-bidfood-eggs.jpg', image: imageUrl });
    setScanCapture(false);
    setAltModal({ open: true, line: scanEggLine, autoScan: true });
  };

  const substitutedLineIds = useMemo(
    () => new Set(alternatives.filter(a => a.originPoLineId).map(a => a.originPoLineId!)),
    [alternatives],
  );

  // Interleave alternatives directly under the PO line they replace; any
  // standalone (off-PO) alternatives fall to the bottom of the order.
  const tableData = useMemo<DisplayRow[]>(() => {
    const rows: DisplayRow[] = [];
    for (const line of allLines) {
      rows.push({ kind: 'po', line });
      alternatives
        .filter(a => a.originPoLineId === line.id)
        .forEach(alt => rows.push({ kind: 'alt', alt }));
    }
    alternatives
      .filter(a => !a.originPoLineId)
      .forEach(alt => rows.push({ kind: 'alt', alt }));
    return rows;
  }, [allLines, alternatives]);

  // Substituted lines are intentionally at 0 — don't treat them as shorts.
  const varianceLines = allLines.filter(
    l => !substitutedLineIds.has(l.id) && (receivedMap[l.id] ?? l.expectedQty) !== l.expectedQty,
  );
  const unresolvedVariances = varianceLines.filter(l => !resolutionMap[l.id]);
  const canConfirm = unresolvedVariances.length === 0;

  const handleConfirm = () => {
    onConfirm({
      invoiceNumber,
      lines: allLines.map(l => ({
        poLineId: l.id,
        receivedQty: receivedMap[l.id] ?? l.expectedQty,
        resolution: resolutionMap[l.id],
      })),
      alternatives,
    });
  };

  const columns: Column<DisplayRow>[] = [
    {
      key: 'name',
      header: 'Item',
      mobileRole: 'title',
      render: (row) => {
        if (row.kind === 'po') {
          const substituted = substitutedLineIds.has(row.line.id);
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: substituted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', textDecoration: substituted ? 'line-through' : 'none' }}>
                {row.line.name}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{row.line.sku} · {row.line.unit}</div>
            </div>
          );
        }
        const { alt } = row;
        return (
          <div>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{alt.productName}</span>
          </div>
        );
      },
    },
    {
      key: 'expected',
      header: 'Expected',
      mobileRole: 'subtitle',
      width: '90px',
      render: (row) => {
        if (row.kind === 'alt') return <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>—</span>;
        return <span style={expectedPillStyle}>{row.line.expectedQty}</span>;
      },
    },
    {
      key: 'received',
      header: 'Received',
      width: '160px',
      render: (row) => {
        if (row.kind === 'alt') {
          return (
            <div style={{ lineHeight: 1.3 }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{row.alt.receivedQty}</span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}> × {row.alt.packQty} {row.alt.masterUnit}</span>
            </div>
          );
        }
        if (substitutedLineIds.has(row.line.id)) {
          return <span style={zeroPillStyle}>0</span>;
        }
        return (
          <Stepper
            value={receivedMap[row.line.id] ?? row.line.expectedQty}
            onChange={(v) => setQty(row.line.id, v)}
            label={row.line.name}
          />
        );
      },
    },
    {
      key: 'price',
      header: 'Unit Price',
      width: '90px',
      render: (row) => row.kind === 'po'
        ? <span>£{row.line.price.toFixed(2)}</span>
        : <span>{formatPrice(row.alt.packCost)}</span>,
    },
    {
      key: 'variance',
      header: 'Variance',
      mobileRole: 'badge',
      width: '150px',
      render: (row) => {
        if (row.kind === 'alt') {
          return <StatusBadge status="New product" variant="warning" />;
        }
        if (substitutedLineIds.has(row.line.id)) {
          return <StatusBadge status="Alternative sent" variant="warning" />;
        }
        const v = getVarianceLabel(row.line.expectedQty, receivedMap[row.line.id] ?? row.line.expectedQty);
        if (!v) return <StatusBadge status="OK" variant="success" />;
        return <StatusBadge status={v.label} variant={v.variant} />;
      },
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      align: 'right',
      render: (row) => {
        if (row.kind === 'alt') {
          return <button onClick={() => removeAlternative(row.alt.id)} style={removeBtnStyle}>Remove</button>;
        }
        if (substitutedLineIds.has(row.line.id)) return null;
        return (
          <button onClick={() => setLineActionLine(row.line)} style={substituteBtnStyle}>
            Edit
          </button>
        );
      },
    },
  ];

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)' }}
        >
          ← Back to POs
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Receive Items</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onAddPO} style={secondaryBtnStyle}>Add PO</button>
          <button onClick={() => setAltModal({ open: true })} style={secondaryBtnStyle}>Add new item</button>
          <button onClick={() => setScanCapture(true)} style={secondaryBtnStyle}>Add GRN</button>
        </div>
      </div>

      {/* PO summary cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {pos.map(po => {
          const total = poTotal(po);
          const itemCount = poItemCount(po);
          return (
            <div
              key={po.id}
              style={{
                padding: '16px 18px',
                borderRadius: '10px',
                background: 'var(--color-bg-hover)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)' }}>{po.poNumber}</span>
                  <StatusBadge status={po.status} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{total}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{po.supplier}</span>
                <span>·</span>
                <span>{po.site}</span>
                <span>·</span>
                <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>Sent {po.dateSent}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Line items table */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
        <ResponsiveDataList
          columns={columns}
          data={tableData}
          getRowKey={(row) => row.kind === 'po' ? row.line.id : row.alt.id}
          emptyText="No line items"
        />
      </div>

      {/* Variance resolution section */}
      {varianceLines.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
            Resolve Variances ({varianceLines.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {varianceLines.map(line => {
              const v = getVarianceLabel(line.expectedQty, receivedMap[line.id]);
              return (
                <div
                  key={line.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: v?.variant === 'error' ? 'var(--color-error-light)' : 'var(--color-warning-light)',
                    border: `1px solid ${v?.variant === 'error' ? 'var(--color-error-border)' : 'var(--color-warning-border)'}`,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{line.name}</span>
                    {v && <StatusBadge status={v.label} variant={v.variant} />}
                  </div>
                  <select
                    value={resolutionMap[line.id] ?? ''}
                    onChange={(e) => setResolution(line.id, e.target.value as VarianceResolution)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-primary)',
                      background: '#fff',
                      cursor: 'pointer',
                      minWidth: '200px',
                    }}
                  >
                    <option value="" disabled>Select resolution…</option>
                    {RESOLUTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoice details */}
      <div
        style={{
          marginTop: '24px',
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid var(--color-border-subtle)',
          background: '#fff',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 14px' }}>
          Invoice
        </h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', fontFamily: 'var(--font-primary)' }}>
              Reference #
            </label>
            <input
              type="text"
              placeholder="e.g. INV-4521"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '14px',
                fontFamily: 'var(--font-primary)',
                outline: 'none',
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ flex: '1 1 280px', minWidth: '220px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', fontFamily: 'var(--font-primary)' }}>
              Attach file
            </label>
            {attachedFile ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: '16px' }}>📄</span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {attachedFile}
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '16px',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                  aria-label="Remove file"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAttachedFile('invoice-bidfood-2901.pdf')}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '2px dashed var(--color-border)',
                  background: 'var(--color-bg-hover)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'var(--font-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: '15px' }}>📎</span>
                Drop or click to attach — PDF, PNG, JPG
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Goods received note (GRN) */}
      {grnFile && (
        <div
          style={{
            marginTop: '16px',
            padding: '18px',
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 14px' }}>
            Goods received note (GRN)
          </h3>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--color-bg-hover)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {grnFile.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={grnFile.image}
                alt="GRN"
                style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--color-border-subtle)' }}
              />
            ) : (
              <span style={{ fontSize: '16px' }}>📄</span>
            )}
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {grnFile.name}
            </span>
            <button
              type="button"
              onClick={() => setGrnFile(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                padding: '0 2px',
                lineHeight: 1,
              }}
              aria-label="Remove GRN"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Confirm button */}
      <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          disabled={!canConfirm}
          onClick={handleConfirm}
          style={{
            padding: '12px 32px',
            borderRadius: '8px',
            background: canConfirm ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
            color: canConfirm ? '#fff' : 'var(--color-text-secondary)',
            border: canConfirm ? 'none' : '1px solid var(--color-border)',
            fontWeight: 700,
            fontSize: '15px',
            fontFamily: 'var(--font-primary)',
            cursor: canConfirm ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          Confirm Delivery
        </button>
      </div>

      {scanCapture && (
        <ScanCaptureModal
          po={scanPO}
          onCaptured={handleScanCaptured}
          onClose={() => setScanCapture(false)}
        />
      )}
      {lineActionLine && (
        <LineActionModal
          line={lineActionLine}
          onReject={() => setLineActionLine(null)}
          onAddProduct={() => {
            setAltModal({ open: true, line: lineActionLine });
            setLineActionLine(null);
          }}
          onAcceptPrice={() => setLineActionLine(null)}
          onClose={() => setLineActionLine(null)}
        />
      )}
      {altModal?.open && (
        <AddAlternativeProductModal
          originLine={altModal.line}
          initialValues={altModal.initialValues}
          autoScan={altModal.autoScan}
          scanImageUrl={altModal.autoScan ? scanImageUrl : null}
          supplierName={modalPO.supplier}
          site={modalPO.site}
          onSave={addAlternative}
          onClose={() => setAltModal(null)}
        />
      )}
    </div>
  );
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '8px',
  background: '#fff',
  border: '1px solid var(--color-border)',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
};

const substituteBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  background: '#fff',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-accent-deep)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const expectedPillStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: '100px',
  background: 'var(--color-bg-hover)',
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
};

const zeroPillStyle: React.CSSProperties = {
  ...expectedPillStyle,
  color: 'var(--color-text-muted)',
};

const removeBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  background: '#fff',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  flexShrink: 0,
};
