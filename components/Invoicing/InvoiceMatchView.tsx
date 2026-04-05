'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import {
  Invoice,
  MatchVariance,
  PriceResolution,
  QtyResolution,
  getGRNsForInvoice,
  getGRNMatchLines,
  getUnmatchedInvoiceLines,
  invoiceGRNTotal,
  getSuggestedGRN,
  GRNMatchLine,
  GRN,
} from './mockData';

type AnyResolution = PriceResolution | QtyResolution;

interface InvoiceMatchViewProps {
  invoice: Invoice;
  onApprove: () => void;
  onBack: () => void;
}

const PRICE_OPTIONS: PriceResolution[] = ['Accept & Update Cost', 'Accept This Delivery', 'Dispute → Credit Note'];
const QTY_OPTIONS: QtyResolution[] = ['Credit Note', 'Accept Short', 'Back-order'];

export default function InvoiceMatchView({ invoice, onApprove, onBack }: InvoiceMatchViewProps) {
  const [resolutions, setResolutions] = useState<Record<string, AnyResolution>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [linkedGRNs, setLinkedGRNs] = useState<string[]>([]);

  const suggestedGRN = getSuggestedGRN(invoice);

  const grns = useMemo(() => getGRNsForInvoice(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const grnLines = useMemo(() => getGRNMatchLines(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const grnTotal = useMemo(() => invoiceGRNTotal(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const unmatchedLines = useMemo(() => getUnmatchedInvoiceLines(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const varianceTotal = invoice.total - grnTotal;

  const hasUnmatched = unmatchedLines.length > 0;
  const canSuggest = hasUnmatched && suggestedGRN && !linkedGRNs.includes(suggestedGRN.grnNumber);

  const allResolved = invoice.variances.length > 0 && invoice.variances.every(v => resolutions[v.id]);
  const noVariances = invoice.variances.length === 0;
  const canApprove = (noVariances || allResolved) && !hasUnmatched;

  const setRes = (varianceId: string, res: AnyResolution) => {
    setResolutions(prev => ({ ...prev, [varianceId]: res }));
  };

  const handleLinkGRN = (grnNumber: string) => {
    setLinkedGRNs(prev => [...prev, grnNumber]);
  };

  if (showConfirm) {
    return (
      <ApprovalConfirmation
        invoice={invoice}
        resolutions={resolutions}
        grns={grns}
        onBack={() => setShowConfirm(false)}
        onConfirm={onApprove}
      />
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Header */}
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '4px' }}
      >
        ← Back to Invoices
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            {invoice.invoiceNumber} — {invoice.supplier}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Three-way match: Invoice ↔ GRN{grns.length > 1 ? 's' : ''} ↔ PO
          </p>
        </div>
        <button
          disabled={!canApprove}
          onClick={() => setShowConfirm(true)}
          style={{
            padding: '10px 22px',
            borderRadius: '8px',
            background: canApprove ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
            color: canApprove ? '#fff' : 'var(--color-text-secondary)',
            border: canApprove ? 'none' : '1px solid var(--color-border)',
            fontWeight: 700,
            fontSize: '14px',
            fontFamily: 'var(--font-primary)',
            cursor: canApprove ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Approve & Sync to Xero
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <MatchSummaryCard
          label="GRN Total"
          value={`$${grnTotal.toFixed(2)}`}
          sub={grns.length > 0
            ? grns.map(g => g.grnNumber).join(' + ') + (hasUnmatched ? ' (partial)' : '')
            : '—'
          }
          variant="default"
        />
        <MatchSummaryCard
          label="Invoice Total"
          value={`$${invoice.total.toFixed(2)}`}
          sub="Per supplier invoice"
          variant="default"
        />
        <MatchSummaryCard
          label="Variance"
          value={varianceTotal === 0 ? '$0.00' : `${varianceTotal > 0 ? '+' : ''}$${varianceTotal.toFixed(2)}`}
          sub={hasUnmatched ? `${unmatchedLines.length} unmatched items` : varianceTotal === 0 ? 'Matched' : varianceTotal > 0 ? 'Invoice higher' : 'Invoice lower'}
          variant={hasUnmatched ? 'error' : varianceTotal === 0 ? 'success' : 'error'}
        />
        {grns.length > 0 && (
          <MatchSummaryCard
            label="Items Matched"
            value={`${invoice.lines.length - unmatchedLines.length} / ${invoice.lines.length}`}
            sub={hasUnmatched ? `${unmatchedLines.length} unmatched` : 'All items matched'}
            variant={hasUnmatched ? 'warning' : 'success'}
          />
        )}
      </div>

      {/* Unmatched items alert + suggest GRN */}
      {canSuggest && suggestedGRN && (
        <SuggestGRNBanner
          unmatchedLines={unmatchedLines}
          suggestedGRN={suggestedGRN}
          onLink={() => handleLinkGRN(suggestedGRN.grnNumber)}
        />
      )}

      {hasUnmatched && !canSuggest && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'var(--color-error-light)', border: '1px solid var(--color-error-border)', marginBottom: '20px', fontSize: '13px', color: 'var(--color-error)', fontWeight: 600 }}>
          {unmatchedLines.length} invoice item{unmatchedLines.length > 1 ? 's' : ''} could not be matched to any linked GRN. Manual review required.
        </div>
      )}

      {/* Linked GRN success banner */}
      {linkedGRNs.length > 0 && !hasUnmatched && (
        <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>✓</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>All items now matched across {grns.length} GRNs</div>
            <div style={{ color: 'var(--color-success)', marginTop: '2px' }}>
              {grns.map(g => g.grnNumber).join(' + ')} — {invoice.lines.length} line items fully covered
            </div>
          </div>
        </div>
      )}

      {/* Split view */}
      <SplitView invoice={invoice} grnLines={grnLines} grns={grns} unmatchedLines={unmatchedLines} />

      {/* Variance resolution */}
      {invoice.variances.length > 0 && !hasUnmatched && (
        <div style={{ marginTop: '24px' }}>
          {allResolved ? (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', marginBottom: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>
              All variances resolved. Ready for approval.
            </div>
          ) : (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', marginBottom: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)' }}>
              Resolve all {invoice.variances.length} variance{invoice.variances.length > 1 ? 's' : ''} to enable approval.
            </div>
          )}

          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
            Resolve Variances ({invoice.variances.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {invoice.variances.map(v => (
              <VarianceCard
                key={v.id}
                variance={v}
                resolution={resolutions[v.id]}
                onResolve={(res) => setRes(v.id, res)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────── Suggest GRN Banner ──────────── */

function SuggestGRNBanner({ unmatchedLines, suggestedGRN, onLink }: { unmatchedLines: { description: string; sku: string }[]; suggestedGRN: GRN; onLink: () => void }) {
  return (
    <div style={{
      padding: '18px 20px',
      borderRadius: '12px',
      background: 'var(--color-info-light)',
      border: '1px solid rgba(3, 105, 161, 0.2)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>💡</span>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-info)' }}>
              {unmatchedLines.length} item{unmatchedLines.length > 1 ? 's' : ''} not found in linked GRN
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 10px', lineHeight: 1.5 }}>
            This invoice covers items from two separate deliveries. We found a matching GRN for the remaining items:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            {unmatchedLines.map(line => (
              <div key={line.sku} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>✕</span>
                {line.description} <span style={{ opacity: 0.6 }}>({line.sku})</span>
              </div>
            ))}
          </div>
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fff',
            border: '1px solid rgba(3, 105, 161, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                {suggestedGRN.grnNumber}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {suggestedGRN.supplier} · Received {suggestedGRN.dateReceived} · {suggestedGRN.lines.length} items · PO {suggestedGRN.poNumbers.join(', ')}
              </div>
            </div>
            <button
              onClick={onLink}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'var(--color-accent-active)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '12px', fontWeight: 500,
                fontFamily: 'var(--font-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Link {suggestedGRN.grnNumber}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Split View ──────────── */

function SplitView({ invoice, grnLines, grns, unmatchedLines }: { invoice: Invoice; grnLines: GRNMatchLine[]; grns: GRN[]; unmatchedLines: { description: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[] }) {
  const unmatchedSkus = new Set(unmatchedLines.map(l => l.sku));

  return (
    <>
      <style>{`
        .inv-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 700px) { .inv-split { grid-template-columns: 1fr !important; } }
      `}</style>
      <div className="inv-split">
        {/* Left: Supplier Invoice */}
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>Supplier Invoice</div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>{invoice.invoiceNumber} · {invoice.date}</div>
            </div>
            <button style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              View PDF
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-primary)' }}>
            <thead>
              <tr>
                {['Description', 'Qty', 'Price', 'Total'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map(line => {
                const isUnmatched = unmatchedSkus.has(line.sku);
                const priceVar = invoice.variances.find(v => v.sku === line.sku && v.type === 'price');
                const qtyVar = invoice.variances.find(v => v.sku === line.sku && v.type === 'qty');
                const hasVariance = !!priceVar || !!qtyVar;
                const rowBg = isUnmatched
                  ? 'rgba(185, 28, 28, 0.06)'
                  : priceVar ? 'var(--color-warning-light)'
                  : qtyVar ? 'var(--color-info-light)'
                  : 'transparent';
                return (
                  <tr key={line.id} style={{ background: rowBg }}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: hasVariance || isUnmatched ? 600 : 400 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {line.description}
                        {isUnmatched && (
                          <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--color-error)', color: '#fff' }}>NO GRN</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{line.sku}</div>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>{line.qty}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: priceVar ? 700 : 400, color: priceVar ? 'var(--color-warning)' : undefined }}>${line.unitPrice.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600 }}>${line.lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Total</td>
                <td style={{ padding: '10px 12px', fontWeight: 700 }}>${invoice.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Right: GRN(s) */}
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
              GRN{grns.length > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {grns.length > 0
                ? grns.map((g, i) => (
                    <span key={g.id}>
                      {i > 0 && ' + '}
                      {g.grnNumber} · Received {g.dateReceived}
                    </span>
                  ))
                : 'No linked GRN'
              }
            </div>
          </div>
          {grnLines.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-primary)' }}>
              <thead>
                <tr>
                  {['Description', 'Received', 'Price', 'Total', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border-subtle)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grnLines.map(line => {
                  const invoiceLine = invoice.lines.find(il => il.sku === line.sku);
                  const priceMatch = invoiceLine ? invoiceLine.unitPrice === line.unitPrice : true;
                  return (
                    <tr key={line.id}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <div>{line.description}</div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{line.sku}</div>
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600 }}>{line.receivedQty}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: !priceMatch ? 600 : 400, color: !priceMatch ? 'var(--color-success)' : undefined }}>
                        ${line.unitPrice.toFixed(2)}
                        {!priceMatch && invoiceLine && (
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-warning)', marginLeft: '4px' }}>
                            (inv: ${invoiceLine.unitPrice.toFixed(2)})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600 }}>${line.lineTotal.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                        {line.matched
                          ? <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✓</span>
                          : <span style={{ color: 'var(--color-warning)', fontWeight: 700 }}>⚠</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Total</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>${grnLines.reduce((s, l) => s + l.lineTotal, 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>No GRN data available.</p>
          )}
        </div>
      </div>
    </>
  );
}

/* ──────────── Variance Card ──────────── */

function VarianceCard({ variance, resolution, onResolve }: { variance: MatchVariance; resolution?: AnyResolution; onResolve: (r: AnyResolution) => void }) {
  const options = variance.type === 'price' ? PRICE_OPTIONS : QTY_OPTIONS;
  const priceDiff = variance.invoiceValue - variance.poValue;
  const detail = variance.type === 'price'
    ? `PO/GRN: $${variance.poValue.toFixed(2)} → Invoice: $${variance.invoiceValue.toFixed(2)} (${priceDiff >= 0 ? '+' : ''}$${priceDiff.toFixed(2)}/unit)`
    : `GRN: ${variance.grnValue} → Invoice claims: ${variance.invoiceValue}`;
  const impactLabel = variance.impact >= 0
    ? `+$${variance.impact.toFixed(2)}`
    : `-$${Math.abs(variance.impact).toFixed(2)}`;

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>{variance.itemName}</span>
            <StatusBadge status={variance.type === 'price' ? 'Price' : 'Quantity'} variant={variance.type === 'price' ? 'warning' : 'info'} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '4px' }}>{detail}</div>
        </div>
        <span style={{ fontWeight: 700, fontSize: '14px', color: variance.impact >= 0 ? 'var(--color-error)' : 'var(--color-success)', whiteSpace: 'nowrap' }}>{impactLabel}</span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onResolve(opt)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: 'pointer',
              border: resolution === opt ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
              background: resolution === opt ? 'rgba(34,68,68,0.08)' : '#fff',
              color: resolution === opt ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      {resolution === 'Accept & Update Cost' && variance.type === 'price' && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-info-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-info)' }}>
          Updates master ingredient cost to ${variance.invoiceValue.toFixed(2)} — cascades to recipe costing and GP%.
        </div>
      )}
      {resolution === 'Accept This Delivery' && variance.type === 'price' && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-success-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-success)' }}>
          Pays ${variance.invoiceValue.toFixed(2)} for this delivery only. Ingredient cost stays at ${variance.poValue.toFixed(2)}.
        </div>
      )}
    </div>
  );
}

/* ──────────── Match Summary Card ──────────── */

function MatchSummaryCard({ label, value, sub, variant }: { label: string; value: string; sub: string; variant: 'default' | 'success' | 'error' | 'warning' }) {
  const bg = variant === 'error' ? 'var(--color-error-light)' : variant === 'success' ? 'var(--color-success-light)' : variant === 'warning' ? 'var(--color-warning-light)' : '#fff';
  const border = variant === 'error' ? 'var(--color-error-border)' : variant === 'success' ? 'var(--color-success-border)' : variant === 'warning' ? 'var(--color-warning-border)' : 'var(--color-border-subtle)';
  const valueColor = variant === 'error' ? 'var(--color-error)' : variant === 'success' ? 'var(--color-success)' : variant === 'warning' ? 'var(--color-warning)' : 'var(--color-text-primary)';

  return (
    <div style={{ padding: '14px 18px', borderRadius: '10px', background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: valueColor }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>{sub}</div>
    </div>
  );
}

/* ──────────── Approval Confirmation ──────────── */

function ApprovalConfirmation({ invoice, resolutions, grns, onBack, onConfirm }: { invoice: Invoice; resolutions: Record<string, AnyResolution>; grns: GRN[]; onBack: () => void; onConfirm: () => void }) {
  const creditNotes = invoice.variances.filter(v => resolutions[v.id]?.includes('Credit Note') || resolutions[v.id]?.includes('Dispute'));
  const creditTotal = creditNotes.reduce((s, v) => s + Math.abs(v.impact), 0);
  const costUpdates = invoice.variances.filter(v => resolutions[v.id] === 'Accept & Update Cost');
  const deliveryOnly = invoice.variances.filter(v => resolutions[v.id] === 'Accept This Delivery');

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '16px' }}
      >
        ← Back to match
      </button>

      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 20px' }}>
        Confirm Approval — {invoice.invoiceNumber}
      </h1>

      {/* Resolution Summary */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 14px' }}>Resolution Summary</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {invoice.variances.map(v => {
            const res = resolutions[v.id];
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{v.itemName}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    {v.type === 'price' ? `$${v.poValue.toFixed(2)} → $${v.invoiceValue.toFixed(2)}` : `GRN: ${v.grnValue} vs Invoice: ${v.invoiceValue}`}
                  </span>
                </div>
                <StatusBadge status={res ?? 'Unresolved'} variant={res ? 'success' : 'error'} />
              </div>
            );
          })}
        </div>
      </div>

      {/* GRNs linked */}
      {grns.length > 1 && (
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>Linked GRNs ({grns.length})</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {grns.map(g => (
              <div key={g.id} style={{ padding: '8px 14px', borderRadius: '8px', background: 'var(--color-bg-hover)', fontSize: '12px', fontWeight: 500 }}>
                <span style={{ fontWeight: 700 }}>{g.grnNumber}</span>
                <span style={{ color: 'var(--color-text-secondary)', marginLeft: '6px' }}>{g.lines.length} items · PO {g.poNumbers.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What happens on approval */}
      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', background: '#fff', padding: '18px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>What Happens on Approval</h3>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: 1.8 }}>
          {costUpdates.map(v => (
            <li key={v.id}>
              <strong>{v.itemName}</strong> master cost updated ${v.poValue.toFixed(2)} → ${v.invoiceValue.toFixed(2)}
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-info)', marginLeft: '6px' }}>Affects recipes & GP%</span>
            </li>
          ))}
          {costUpdates.length > 0 && <li>Recipe GP% recalculated for affected recipes</li>}
          {deliveryOnly.map(v => (
            <li key={v.id}>
              <strong>{v.itemName}</strong> charged at ${v.invoiceValue.toFixed(2)} for this delivery
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-success)', marginLeft: '6px' }}>Cost stays at ${v.poValue.toFixed(2)}</span>
            </li>
          ))}
          <li>Invoice pushed to Xero (account codes mapped)</li>
          {creditTotal > 0 && <li>Credit note for <strong>${creditTotal.toFixed(2)}</strong> exported to Xero separately</li>}
        </ul>
      </div>

      {/* Warning */}
      <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', marginBottom: '20px', fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)' }}>
        Approval is final. Costs update and invoice pushes to Xero. Logged for audit.
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{ padding: '12px 24px', borderRadius: '8px', background: '#fff', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          style={{ padding: '12px 24px', borderRadius: '8px', background: 'var(--color-accent-active)', border: 'none', fontWeight: 700, fontSize: '14px', fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer' }}
        >
          Approve Invoice & Push to Xero
        </button>
      </div>
    </div>
  );
}
