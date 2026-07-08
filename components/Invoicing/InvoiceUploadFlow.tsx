'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MOCK_COMPLETED_DELIVERIES } from '@/components/Receiving/mockData';
import { addUploadedInvoice, ParsedInvoiceLine } from './mockData';

interface InvoiceUploadFlowProps {
  onDone: (invoiceId: string) => void;
  onCancel: () => void;
}

type Step = 'upload' | 'parsing' | 'review' | 'link';

// What the mock OCR "reads" off whatever document the user uploads.
// The avocado price deliberately disagrees with the PO (£2.10 vs £2.00) so
// the resulting match lands with one small variance to review.
const PARSED_HEADER = {
  supplier: 'Fresh Direct',
  invoiceNumber: 'INV-5102',
  date: '14 Apr 2026',
};

const PARSED_LINES: (ParsedInvoiceLine & { confidence: number })[] = [
  { description: 'Baby spinach 500g', sku: 'BS-500', qty: 8, unitPrice: 3.50, confidence: 99 },
  { description: 'Cherry tomatoes 500g', sku: 'CT-500', qty: 10, unitPrice: 3.50, confidence: 99 },
  { description: 'Avocados', sku: 'AVO-EA', qty: 30, unitPrice: 2.10, confidence: 88 },
  { description: 'Lemons', sku: 'LEM-EA', qty: 40, unitPrice: 0.60, confidence: 98 },
  { description: 'Sourdough loaves', sku: 'SDL-WH', qty: 15, unitPrice: 6.00, confidence: 97 },
];

const SUGGESTED_GRN_NUMBER = 'GRN-1275';
const GRN_CONFIDENCE = 94;

const PARSE_STAGES = [
  'Reading document',
  'Identifying supplier — Fresh Direct',
  'Extracting line items — 5 found',
  'Reading totals',
  'Scanning deliveries for a match',
];

const AMBER = '#D97706';
const AMBER_BG = '#FBF4E4';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '12px',
  padding: '24px',
};

const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  padding: '10px 22px',
  borderRadius: '8px',
  background: enabled ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
  color: enabled ? '#fff' : 'var(--color-text-secondary)',
  border: enabled ? 'none' : '1px solid var(--color-border)',
  fontWeight: 700,
  fontSize: '14px',
  fontFamily: 'var(--font-primary)',
  cursor: enabled ? 'pointer' : 'not-allowed',
});

export default function InvoiceUploadFlow({ onDone, onCancel }: InvoiceUploadFlowProps) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  // Confidence stays on each line so it travels with the invoice into matching.
  const [lines, setLines] = useState<ParsedInvoiceLine[]>(PARSED_LINES);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const grn = MOCK_COMPLETED_DELIVERIES.find(g => g.grnNumber === SUGGESTED_GRN_NUMBER)!;
  const invoiceTotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const grnTotal = grn.lines.reduce((s, l) => s + l.receivedQty * l.price, 0);

  // Staged fake-OCR progress while on the parsing step
  useEffect(() => {
    if (step !== 'parsing') return;
    if (stageIdx >= PARSE_STAGES.length) {
      const t = setTimeout(() => setStep('review'), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStageIdx(i => i + 1), 650);
    return () => clearTimeout(t);
  }, [step, stageIdx]);

  // Release the photo preview blob when the flow unmounts
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const acceptFile = (file: File) => {
    setFileName(file.name);
    if (file.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(file));
    setStageIdx(0);
    setStep('parsing');
  };

  const setLine = (idx: number, patch: Partial<ParsedInvoiceLine>) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const stepNumber: Record<Step, number> = { upload: 1, parsing: 2, review: 3, link: 4 };
  const current = stepNumber[step];

  return (
    <div style={{ fontFamily: 'var(--font-primary)', maxWidth: '860px', margin: '0 auto' }}>
      <button
        onClick={onCancel}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '4px', padding: 0 }}
      >
        ← Back to Invoices
      </button>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
        Add an invoice
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
        Upload a PDF or photo — Edify parses it, finds the delivery it bills, and runs the three-way match.
      </p>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['Upload', 'Parse', 'Review', 'Link & match'] as const).map((label, i) => {
          const n = i + 1;
          const active = n === current;
          const done = n < current;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '22px', height: '22px', borderRadius: '50%',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                background: done ? 'var(--color-success)' : active ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                color: done || active ? '#fff' : 'var(--color-text-secondary)',
                border: done || active ? 'none' : '1px solid var(--color-border)',
              }}>
                {done ? '✓' : n}
              </span>
              <span style={{ fontSize: '13px', fontWeight: active ? 700 : 500, color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                {label}
              </span>
              {n < 4 && <span aria-hidden="true" style={{ width: '28px', height: '1px', background: 'var(--color-border)' }} />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div style={cardStyle}>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) acceptFile(file);
            }}
            style={{
              border: `2px dashed ${dragging ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              background: dragging ? 'var(--color-bg-hover)' : 'transparent',
              transition: 'all 0.15s',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '34px', marginBottom: '10px' }}>📄</div>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
              Drag an invoice here
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
              PDF, JPG or PNG — supplier emails, scans, or a photo of the paper copy
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => fileInputRef.current?.click()} style={primaryBtn(true)}>
                Browse files
              </button>
              <button
                onClick={() => photoInputRef.current?.click()}
                style={{
                  padding: '10px 22px', borderRadius: '8px', background: '#fff',
                  color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
                  fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-primary)', cursor: 'pointer',
                }}
              >
                📷 Take a photo
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
          />
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Most invoices arrive automatically via the supplier email inbox — manual upload is for paper
            copies handed over with the delivery.
          </p>
        </div>
      )}

      {/* ── Step 2: Parsing ── */}
      {step === 'parsing' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
              background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)',
            }}>
              {fileName?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMG'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{fileName}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {PARSE_STAGES.map((label, i) => {
              const done = i < stageIdx;
              const active = i === stageIdx;
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: done || active ? 1 : 0.35 }}>
                  <span style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700,
                    background: done ? 'var(--color-success)' : active ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                    color: done || active ? '#fff' : 'var(--color-text-secondary)',
                  }}>
                    {done ? '✓' : active ? '…' : ''}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: active ? 700 : 500, color: 'var(--color-text-primary)' }}>
                    {label}{active ? '…' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Review parse ── */}
      {step === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px 16px', borderRadius: '12px',
            background: '#fff', border: '1px solid var(--color-border-subtle)', borderLeft: '3px solid var(--color-success)',
            fontSize: '13px', color: 'var(--color-text-primary)',
          }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span> Parsed <strong>{PARSED_HEADER.invoiceNumber}</strong> from {PARSED_HEADER.supplier} — check the fields below, fix anything the
            parse got wrong, then continue.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: previewUrl ? 'minmax(180px, 260px) 1fr' : '1fr', gap: '16px', alignItems: 'start' }}>
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Uploaded invoice"
                style={{ width: '100%', borderRadius: '10px', border: '1px solid var(--color-border-subtle)' }}
              />
            )}
            <div style={cardStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                {[
                  { label: 'Supplier', value: PARSED_HEADER.supplier, confidence: 99 },
                  { label: 'Invoice no.', value: PARSED_HEADER.invoiceNumber, confidence: 98 },
                  { label: 'Invoice date', value: PARSED_HEADER.date, confidence: 96 },
                  { label: 'Total (ex VAT)', value: `£${invoiceTotal.toFixed(2)}`, confidence: 97 },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', marginBottom: '3px' }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{f.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{f.confidence}% confident</div>
                  </div>
                ))}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Item', 'Qty', 'Unit price', 'Line total', 'Parse'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Item' ? 'left' : 'right', padding: '6px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => {
                    const confidence = PARSED_LINES[idx].confidence;
                    const shaky = confidence < 95;
                    return (
                      <tr key={l.sku} style={{ background: shaky ? AMBER_BG : 'transparent' }}>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                          {l.description}
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}> {l.sku}</span>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right' }}>
                          <input
                            type="number"
                            value={l.qty}
                            onChange={e => setLine(idx, { qty: Number(e.target.value) })}
                            style={{ width: '58px', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--color-border)', textAlign: 'right', fontSize: '13px', fontFamily: 'var(--font-primary)' }}
                          />
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={l.unitPrice}
                            onChange={e => setLine(idx, { unitPrice: Number(e.target.value) })}
                            style={{
                              width: '72px', padding: '4px 6px', borderRadius: '6px', textAlign: 'right', fontSize: '13px', fontFamily: 'var(--font-primary)',
                              border: shaky ? `1.5px solid ${AMBER}` : '1px solid var(--color-border)',
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right', fontWeight: 600 }}>
                          £{(l.qty * l.unitPrice).toFixed(2)}
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right', fontSize: '11px', color: shaky ? AMBER : 'var(--color-text-secondary)', fontWeight: shaky ? 700 : 400, whiteSpace: 'nowrap' }}>
                          {confidence}%{shaky ? ' — check' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
                <button onClick={() => setStep('link')} style={primaryBtn(true)}>
                  Fields look right — find the delivery
                </button>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  Low-confidence fields are highlighted amber — edit them inline if the document reads differently.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Link & match ── */}
      {step === 'link' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(3,105,161,0.07)', border: '1px solid rgba(3,105,161,0.25)',
            fontSize: '13px', color: 'var(--color-text-primary)',
          }}>
            🔗 One delivery fits this invoice — <strong>{GRN_CONFIDENCE}% confident</strong>. Every line matches what {grn.receivedBy} signed
            in on {grn.dateReceived}, and it&rsquo;s the only {PARSED_HEADER.supplier} delivery still awaiting an invoice.
          </div>

          <div style={{ ...cardStyle, border: `2px solid var(--color-accent-active)` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-text-primary)' }}>{grn.grnNumber}</span>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '100px',
                background: 'rgba(3,105,161,0.08)', border: '1px solid rgba(3,105,161,0.3)', color: 'var(--color-info)',
              }}>
                {GRN_CONFIDENCE}% match
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
              Received {grn.dateReceived} · {grn.receivedBy} · {grn.poNumbers.join(', ')} · {grn.site}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
              {lines.map(l => {
                const gl = grn.lines.find(g => g.sku === l.sku);
                const received = gl?.receivedQty ?? 0;
                const qtyMatches = received === l.qty;
                const priceMatches = gl ? gl.price === l.unitPrice : false;
                return (
                  <div key={l.sku} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{l.description}</span>
                    <span style={{ whiteSpace: 'nowrap', fontWeight: 600, color: qtyMatches && priceMatches ? 'var(--color-success)' : AMBER }}>
                      {qtyMatches ? `${l.qty} billed = ${received} received ✓` : `${l.qty} billed vs ${received} received`}
                      {!priceMatches && gl ? ` · £${l.unitPrice.toFixed(2)} vs PO £${gl.price.toFixed(2)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)', marginBottom: '16px' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>GRN total vs invoice £{invoiceTotal.toFixed(2)}</span>
              <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>£{grnTotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const id = addUploadedInvoice({ ...PARSED_HEADER, lines }, [grn.grnNumber]);
                  onDone(id);
                }}
                style={primaryBtn(true)}
              >
                Link {grn.grnNumber} &amp; run match
              </button>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Wrong delivery? Check <Link href="/receive" style={{ color: 'var(--color-accent-deep)', fontWeight: 600 }}>Receiving</Link> for the full list.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
