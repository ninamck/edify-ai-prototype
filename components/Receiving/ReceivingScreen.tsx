'use client';

import { useState, useMemo } from 'react';
import Stepper from './Stepper';
import StatusBadge from './StatusBadge';
import ResponsiveDataList, { Column } from './ResponsiveDataList';
import { PO, POLine, VarianceResolution, poItemCount, poTotal } from './mockData';

interface ReceivedLine {
  poLineId: string;
  receivedQty: number;
  resolution?: VarianceResolution;
}

interface ReceivingScreenProps {
  pos: PO[];
  onConfirm: (data: { invoiceNumber: string; lines: ReceivedLine[] }) => void;
  onBack: () => void;
  onAddPO: () => void;
  onScanGRN: () => void;
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

export default function ReceivingScreen({ pos, onConfirm, onBack, onAddPO, onScanGRN }: ReceivingScreenProps) {
  const allLines = useMemo(() => pos.flatMap(po => po.lines), [pos]);

  const [receivedMap, setReceivedMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    allLines.forEach(l => { map[l.id] = l.expectedQty; });
    return map;
  });

  const [resolutionMap, setResolutionMap] = useState<Record<string, VarianceResolution>>({});
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [attachedFile, setAttachedFile] = useState<string | null>(null);

  const setQty = (lineId: string, qty: number) => {
    setReceivedMap(prev => ({ ...prev, [lineId]: qty }));
  };

  const setResolution = (lineId: string, res: VarianceResolution) => {
    setResolutionMap(prev => ({ ...prev, [lineId]: res }));
  };

  const varianceLines = allLines.filter(l => receivedMap[l.id] !== l.expectedQty);
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
    });
  };

  const columns: Column<POLine>[] = [
    {
      key: 'name',
      header: 'Item',
      mobileRole: 'title',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>{row.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{row.sku} · {row.unit}</div>
        </div>
      ),
    },
    {
      key: 'expected',
      header: 'Expected',
      mobileRole: 'subtitle',
      width: '90px',
      render: (row) => (
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '100px',
            background: 'var(--color-bg-hover)',
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
          }}
        >
          {row.expectedQty}
        </span>
      ),
    },
    {
      key: 'received',
      header: 'Received',
      width: '160px',
      render: (row) => (
        <Stepper
          value={receivedMap[row.id] ?? row.expectedQty}
          onChange={(v) => setQty(row.id, v)}
          label={row.name}
        />
      ),
    },
    {
      key: 'price',
      header: 'Unit Price',
      width: '90px',
      render: (row) => <span>${row.price.toFixed(2)}</span>,
    },
    {
      key: 'variance',
      header: 'Variance',
      mobileRole: 'badge',
      width: '120px',
      render: (row) => {
        const v = getVarianceLabel(row.expectedQty, receivedMap[row.id] ?? row.expectedQty);
        if (!v) return <StatusBadge status="OK" variant="success" />;
        return <StatusBadge status={v.label} variant={v.variant} />;
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
          <button onClick={onAddPO} style={secondaryBtnStyle}>+ Add PO</button>
          <button onClick={onScanGRN} style={secondaryBtnStyle}>Scan GRN</button>
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
                background: 'var(--color-success-light)',
                border: '1px solid var(--color-success-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)' }}>{po.poNumber}</span>
                  <StatusBadge status={po.status} />
                </div>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{total}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
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
          data={allLines}
          getRowKey={(row) => row.id}
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
          Invoice / Delivery Note
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
                  background: 'var(--color-success-light)',
                  border: '1px solid var(--color-success-border)',
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
