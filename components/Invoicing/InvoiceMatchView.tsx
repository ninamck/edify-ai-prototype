'use client';

import { useState, useMemo } from 'react';
import StatusBadge from '@/components/Receiving/StatusBadge';
import {
  Invoice,
  MatchVariance,
  PriceResolution,
  QtyResolution,
  getGRNsForInvoice,
  getUnmatchedInvoiceLines,
  invoiceGRNTotal,
  getSuggestedGRN,
  GRN,
} from './mockData';
import { MOCK_POS, POLine } from '@/components/Receiving/mockData';

type AnyResolution = PriceResolution | QtyResolution;

interface InvoiceMatchViewProps {
  invoice: Invoice;
  onApprove: () => void;
  onBack: () => void;
}

const PRICE_OPTIONS: PriceResolution[] = ['Accept & Update Cost in Edify', 'Accept for this delivery', 'Dispute → Credit Note'];
const QTY_OPTIONS: QtyResolution[] = ['Credit Note', 'Accept Short', 'Back-order'];

export default function InvoiceMatchView({ invoice, onApprove, onBack }: InvoiceMatchViewProps) {
  const [resolutions, setResolutions] = useState<Record<string, AnyResolution>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [linkedGRNs, setLinkedGRNs] = useState<string[]>([]);

  const suggestedGRN = getSuggestedGRN(invoice);

  const grns = useMemo(() => getGRNsForInvoice(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const grnTotal = useMemo(() => invoiceGRNTotal(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const unmatchedLines = useMemo(() => getUnmatchedInvoiceLines(invoice, linkedGRNs), [invoice, linkedGRNs]);
  const varianceTotal = invoice.total - grnTotal;

  const hasUnmatched = unmatchedLines.length > 0;
  const canSuggest = hasUnmatched && suggestedGRN && !linkedGRNs.includes(suggestedGRN.grnNumber);

  const [lineTaxRates, setLineTaxRates] = useState<Record<string, number>>({});
  const setLineRate = (lineId: string, rate: number) => {
    setLineTaxRates(prev => {
      const next = { ...prev };
      if (rate === 0) delete next[lineId];
      else next[lineId] = rate;
      return next;
    });
  };
  const totalTax = useMemo(
    () => invoice.lines.reduce((sum, il) => sum + il.lineTotal * (lineTaxRates[il.id] ?? 0) / 100, 0),
    [invoice.lines, lineTaxRates]
  );
  const anyTax = totalTax > 0;

  const allResolved = invoice.variances.length > 0 && invoice.variances.every(v => resolutions[v.id]);
  const noVariances = invoice.variances.length === 0;
  const canApprove = noVariances || allResolved;

  const setRes = (varianceId: string, res: AnyResolution | null) => {
    setResolutions(prev => {
      const next = { ...prev };
      if (res === null) delete next[varianceId];
      else next[varianceId] = res;
      return next;
    });
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
        unmatchedLines={unmatchedLines}
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
          Approve & Sync
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
        {anyTax && (
          <MatchSummaryCard
            label="Tax on Invoice"
            value={`$${totalTax.toFixed(2)}`}
            sub={`Invoice total incl. tax: $${(invoice.total + totalTax).toFixed(2)}`}
            variant="default"
          />
        )}
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

      {/* Split view — variance resolution is inline within the table */}
      <SplitView invoice={invoice} grns={grns} unmatchedLines={unmatchedLines} resolutions={resolutions} onResolve={setRes} lineTaxRates={lineTaxRates} setLineRate={setLineRate} totalTax={totalTax} anyTax={anyTax} />

      {/* Variance status banner */}
      {invoice.variances.length > 0 && !hasUnmatched && (
        <div style={{ marginTop: '16px' }}>
          {allResolved ? (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-success-light)', border: '1px solid var(--color-success-border)', fontSize: '13px', fontWeight: 600, color: 'var(--color-success)' }}>
              All variances resolved. Ready for approval.
            </div>
          ) : (
            <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning-border)', fontSize: '13px', fontWeight: 500, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700 }}>{invoice.variances.filter(v => resolutions[v.id]).length} of {invoice.variances.length} variances resolved</span>
              <span>— click ⚠ on any highlighted row to resolve.</span>
            </div>
          )}
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
              {unmatchedLines.length} item{unmatchedLines.length > 1 ? 's' : ''} not found in linked Goods Received Notice (GRN)
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

function SplitView({ invoice, grns, unmatchedLines, resolutions, onResolve, lineTaxRates, setLineRate, totalTax, anyTax }: {
  invoice: Invoice;
  grns: GRN[];
  unmatchedLines: { description: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[];
  resolutions: Record<string, AnyResolution>;
  onResolve: (varianceId: string, res: AnyResolution | null) => void;
  lineTaxRates: Record<string, number>;
  setLineRate: (lineId: string, rate: number) => void;
  totalTax: number;
  anyTax: boolean;
}) {
  const [rightTab, setRightTab] = useState<'grn' | 'po'>('grn');
  const [expandedVariance, setExpandedVariance] = useState<string | null>(null);

  const grnGroups = grns.map(grn => {
    const lines = grn.lines.map(gl => ({
      id: gl.id,
      description: gl.name,
      sku: gl.sku,
      orderedQty: gl.expectedQty,
      receivedQty: gl.receivedQty,
      unitPrice: gl.price,
      lineTotal: gl.receivedQty * gl.price,
      matched: !invoice.variances.some(v => v.sku === gl.sku),
    }));
    const pos = MOCK_POS.filter(p => grn.poNumbers.includes(p.poNumber));
    return { grn, lines, pos };
  });

  const multiGroup = grns.length > 1;
  const matchedSkus = new Set(grnGroups.flatMap(g => g.lines.map(l => l.sku)));
  const unmatchedInvRows = invoice.lines.filter(il => !matchedSkus.has(il.sku));

  const allGrnTotal = grnGroups.reduce((s, g) => s + g.lines.reduce((ss, l) => ss + l.lineTotal, 0), 0);
  const allPoTotal = grnGroups.reduce((s, g) => s + g.pos.reduce((ss, p) => ss + p.lines.reduce((sss, l) => sss + l.price * l.expectedQty, 0), 0), 0);

  // right column count differs by tab
  const RC = rightTab === 'grn' ? 5 : 4;

  const cell: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '12px' };
  const divider: React.CSSProperties = { borderRight: '2px solid var(--color-border)' };
  const colLabelStyle: React.CSSProperties = {
    textAlign: 'center', padding: '8px 12px', fontWeight: 600, fontSize: '11px',
    textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-secondary)',
    borderBottom: '1px solid var(--color-border-subtle)', whiteSpace: 'nowrap',
    background: 'var(--color-bg-subtle, #fafafa)',
  };

  const TaxSelect = ({ lineId }: { lineId: string }) => {
    const rate = lineTaxRates[lineId] ?? 0;
    return (
      <select
        value={rate}
        onChange={e => setLineRate(lineId, Number(e.target.value))}
        style={{
          fontSize: '11px', fontFamily: 'var(--font-primary)',
          border: '1px solid var(--color-border)', borderRadius: '4px',
          padding: '2px 4px', background: '#fff', color: 'var(--color-text-primary)',
          cursor: 'pointer', outline: 'none',
        }}
      >
        <option value={0}>— No tax</option>
        <option value={5}>5%</option>
        <option value={10}>10%</option>
        <option value={15}>15%</option>
        <option value={20}>20%</option>
      </select>
    );
  };

  const Chevron = ({ open }: { open: boolean }) => (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const VarBadge = ({ varianceId, label }: { varianceId: string; label: string }) => {
    const resolution = resolutions[varianceId];
    const isOpen = expandedVariance === varianceId;
    const toggle = () => setExpandedVariance(isOpen ? null : varianceId);

    if (resolution) {
      const resolvedLabel = resolution === 'Accept & Update Cost in Edify' ? 'Price Updated'
        : resolution === 'Accept for this delivery' ? 'Accepted'
        : resolution === 'Dispute → Credit Note' ? 'Disputed'
        : resolution === 'Credit Note' ? 'Credit Note'
        : resolution === 'Accept Short' ? 'Short Accepted'
        : resolution === 'Back-order' ? 'Back-ordered'
        : 'Resolved';
      return (
        <button onClick={toggle} title="Click to change resolution" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '6px',
          border: '1.5px solid var(--color-success)',
          background: 'rgba(16, 185, 129, 0.08)',
          color: 'var(--color-success)', fontWeight: 700, fontSize: '12px',
          fontFamily: 'var(--font-primary)', cursor: 'pointer', lineHeight: 1.3,
        }}>
          {resolvedLabel}<Chevron open={isOpen} />
        </button>
      );
    }

    return (
      <button onClick={toggle} title="Click to resolve" style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px', borderRadius: '6px',
        border: '1.5px solid var(--color-warning)',
        background: isOpen ? 'rgba(217, 119, 6, 0.14)' : 'rgba(217, 119, 6, 0.08)',
        color: 'var(--color-warning)', fontWeight: 700, fontSize: '12px',
        fontFamily: 'var(--font-primary)', cursor: 'pointer', lineHeight: 1.3,
      }}>
        {label}<Chevron open={isOpen} />
      </button>
    );
  };

  return (
    <>
      <style>{`
        .split-tab-toggle { display: inline-flex; border: 1px solid var(--color-border); border-radius: 6px; overflow: hidden; flex-shrink: 0; }
        .split-tab-toggle button { padding: 3px 10px; font-size: 12px; font-weight: 600; font-family: var(--font-primary); border: none; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background 0.12s, color 0.12s; white-space: nowrap; }
        .split-tab-toggle button.active { background: var(--color-text-primary); color: #fff; }
        .split-tab-toggle button:not(.active):hover { background: var(--color-bg-subtle, #f5f5f5); }
      `}</style>

      <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff', fontFamily: 'var(--font-primary)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontWeight: 500 }}>

          {/* ── Panel headers ── */}
          <thead>
            <tr>
              {/* Invoice panel header */}
              <td colSpan={6} style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)', ...divider }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>Supplier Invoice</div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>{invoice.invoiceNumber} · {invoice.date}</div>
                  </div>
                  <button style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    View PDF
                  </button>
                </div>
              </td>
              {/* GRN/PO panel header */}
              <td colSpan={RC} style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      {rightTab === 'grn' ? (grns.length > 1 ? `${grns.length} GRNs` : 'GRN') : 'PO Prices'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {rightTab === 'grn'
                        ? (grns.length > 0 ? grns.map((g, i) => <span key={g.id}>{i > 0 && ' + '}{g.grnNumber} · {g.dateReceived}</span>) : 'No linked GRN')
                        : (grnGroups.some(g => g.pos.length > 0)
                            ? grnGroups.filter(g => g.pos.length > 0).map((g, i) => <span key={g.grn.id}>{i > 0 && ' + '}{g.pos.map(p => p.poNumber).join(', ')} via {g.grn.grnNumber}</span>)
                            : 'No linked PO')
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {rightTab === 'grn' && grns.length === 1 && grns[0].attachmentUrl && (
                      <a
                        href={grns[0].attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: '5px 12px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        View GRN Doc
                      </a>
                    )}
                    <div className="split-tab-toggle">
                      <button className={rightTab === 'grn' ? 'active' : ''} onClick={() => setRightTab('grn')}>GRN</button>
                      <button className={rightTab === 'po' ? 'active' : ''} onClick={() => setRightTab('po')}>PO Prices</button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            {/* Column labels */}
            <tr>
              <th style={colLabelStyle}>Description</th>
              <th style={colLabelStyle}>Qty</th>
              <th style={colLabelStyle}>Price</th>
              <th style={colLabelStyle}>Total</th>
              <th style={colLabelStyle}>Tax</th>
              <th style={{ ...colLabelStyle, ...divider }}>Tax $</th>
              {rightTab === 'grn' ? (
                <>
                  <th style={colLabelStyle}>Ordered</th>
                  <th style={colLabelStyle}>Received</th>
                  <th style={colLabelStyle}>Price</th>
                  <th style={colLabelStyle}>Total</th>
                  <th style={{ ...colLabelStyle, width: '32px' }}></th>
                </>
              ) : (
                <>
                  <th style={colLabelStyle}>Ordered</th>
                  <th style={colLabelStyle}>PO Price</th>
                  <th style={colLabelStyle}>Total</th>
                  <th style={{ ...colLabelStyle, width: '32px' }}></th>
                </>
              )}
            </tr>
          </thead>

          {/* ── GRN groups ── */}
          {grnGroups.map(({ grn, lines, pos }) => {
            const invGroupSkus = new Set(lines.map(l => l.sku));
            const invGroupTotal = invoice.lines.filter(il => invGroupSkus.has(il.sku)).reduce((s, l) => s + l.lineTotal, 0);
            const grnGroupTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
            const poGroupTotal = pos.reduce((s, p) => s + p.lines.reduce((ss, l) => ss + l.price * l.expectedQty, 0), 0);
            const poLines = pos.flatMap(p => p.lines);

            return (
              <tbody key={grn.id}>
                {/* Group section header (multi-GRN only) */}
                {multiGroup && (
                  <tr>
                    <td colSpan={6} style={{ padding: '8px 12px', background: 'var(--color-bg-subtle, #f9f9f9)', borderTop: '2px solid var(--color-border)', borderBottom: '1px solid var(--color-border-subtle)', ...divider }} />
                    <td colSpan={RC} style={{ padding: '8px 12px', background: 'var(--color-bg-subtle, #f9f9f9)', borderTop: '2px solid var(--color-border)', borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--color-text-primary)' }}>
                            {rightTab === 'grn' ? grn.grnNumber : (pos.length > 0 ? pos.map(p => p.poNumber).join(' + ') : 'No PO')}
                          </span>
                          <span style={{ fontWeight: 500, fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>
                            {rightTab === 'grn' ? `Received ${grn.dateReceived} · ${grn.receivedBy}` : `via ${grn.grnNumber}`}
                          </span>
                        </div>
                        {rightTab === 'grn' && grn.attachmentUrl && (
                          <a
                            href={grn.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ padding: '3px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}
                          >
                            View GRN Doc
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {/* GRN tab rows */}
                {rightTab === 'grn' && lines.flatMap(grnLine => {
                  const invLine = invoice.lines.find(il => il.sku === grnLine.sku);
                  const isShort = grnLine.receivedQty < grnLine.orderedQty;
                  const priceVar = invLine ? invLine.unitPrice !== grnLine.unitPrice : false;
                  const priceDiff = invLine ? invLine.unitPrice - grnLine.unitPrice : 0;
                  const variance = invoice.variances.find(v => v.sku === grnLine.sku);
                  const isExpanded = !!variance && expandedVariance === variance.id;
                  const isResolved = !!variance && !!resolutions[variance.id];
                  const hasVar = (priceVar || variance?.type === 'qty') && !isResolved;
                  const rowBg = hasVar ? 'rgba(217, 119, 6, 0.05)' : 'transparent';
                  const leftAccent: React.CSSProperties = hasVar ? { boxShadow: 'inset 3px 0 0 var(--color-warning)' } : {};
                  const qtyDiff = variance?.type === 'qty' ? variance.invoiceValue - variance.grnValue : 0;
                  const varLabel = variance?.type === 'qty'
                    ? `${qtyDiff > 0 ? '+' : ''}${qtyDiff} unit${Math.abs(qtyDiff) !== 1 ? 's' : ''}`
                    : `${priceDiff > 0 ? '+' : ''}$${Math.abs(priceDiff).toFixed(2)} / unit`;

                  const dataRow = (
                    <tr key={grnLine.id} style={{ background: rowBg }}>
                      <td style={{ ...cell, ...leftAccent }}>
                        <div style={{ fontWeight: hasVar ? 600 : 400 }}>{invLine?.description ?? grnLine.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{grnLine.sku}</div>
                      </td>
                      <td style={{ ...cell, fontWeight: variance?.type === 'qty' ? 700 : 400, color: variance?.type === 'qty' ? 'var(--color-warning)' : undefined }}>{invLine?.qty ?? '—'}</td>
                      <td style={{ ...cell, fontWeight: priceVar ? 700 : 400, color: priceVar ? 'var(--color-warning)' : undefined }}>
                        {invLine ? `$${invLine.unitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>
                        {invLine ? `$${invLine.lineTotal.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell }}>
                        {invLine && <TaxSelect lineId={invLine.id} />}
                      </td>
                      <td style={{ ...cell, ...divider, fontWeight: 600, color: invLine && (lineTaxRates[invLine.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {invLine && (lineTaxRates[invLine.id] ?? 0) > 0
                          ? `$${(invLine.lineTotal * (lineTaxRates[invLine.id] ?? 0) / 100).toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ ...cell, color: 'var(--color-text-secondary)', textAlign: 'center' }}>{grnLine.orderedQty}</td>
                      <td style={{ ...cell, textAlign: 'center', fontWeight: isShort || variance?.type === 'qty' ? 700 : 600, color: isShort || variance?.type === 'qty' ? 'var(--color-warning)' : undefined }}>
                        {grnLine.receivedQty}
                        {isShort && <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '4px' }}>of {grnLine.orderedQty}</span>}
                      </td>
                      <td style={{ ...cell, fontWeight: priceVar ? 700 : 400, color: priceVar ? 'var(--color-warning)' : undefined }}>${grnLine.unitPrice.toFixed(2)}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>${grnLine.lineTotal.toFixed(2)}</td>
                      <td style={{ ...cell, padding: '6px 12px', textAlign: 'center' }}>
                        {variance
                          ? <VarBadge varianceId={variance.id} label={varLabel} />
                          : <span style={{ color: 'var(--color-success)', fontSize: '13px', fontWeight: 600, opacity: 0.7 }}>✓</span>
                        }
                      </td>
                    </tr>
                  );

                  if (!variance || !isExpanded) return [dataRow];

                  const resolution = resolutions[variance.id] as AnyResolution | undefined;
                  const options = variance.type === 'price' ? PRICE_OPTIONS : QTY_OPTIONS;
                  const vDiff = variance.invoiceValue - variance.poValue;
                  const detail = variance.type === 'price'
                    ? `PO/GRN: $${variance.poValue.toFixed(2)} → Invoice: $${variance.invoiceValue.toFixed(2)} (${vDiff >= 0 ? '+' : ''}$${vDiff.toFixed(2)}/unit)`
                    : `GRN: ${variance.grnValue} → Invoice claims: ${variance.invoiceValue}`;
                  const impactLabel = variance.impact >= 0 ? `+$${variance.impact.toFixed(2)}` : `-$${Math.abs(variance.impact).toFixed(2)}`;

                  const expandBg = isResolved ? 'rgba(16,185,129,0.03)' : 'rgba(217,119,6,0.04)';
                  const expandAccent = isResolved ? 'inset 3px 0 0 var(--color-success)' : 'inset 3px 0 0 var(--color-warning)';

                  const expandRow = (
                    <tr key={`expand-${grnLine.id}`}>
                      <td colSpan={6 + RC} style={{ padding: '14px 18px', background: expandBg, borderBottom: '1px solid var(--color-border-subtle)', boxShadow: expandAccent }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{variance.itemName}</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(217,119,6,0.1)', color: 'var(--color-warning)', border: '1px solid rgba(217,119,6,0.3)' }}>
                                {variance.type === 'price' ? 'Price' : 'Quantity'}
                              </span>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: variance.impact >= 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{impactLabel}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{detail}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: '2 1 280px' }}>
                            {options.map(opt => (
                              <button
                                key={opt}
                                onClick={() => onResolve(variance.id, resolution === opt ? null : opt as AnyResolution)}
                                style={{
                                  padding: '6px 16px', borderRadius: '999px',
                                  border: resolution === opt ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
                                  background: resolution === opt ? 'rgba(34,68,68,0.08)' : '#fff',
                                  color: resolution === opt ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
                                  fontWeight: resolution === opt ? 700 : 600, fontSize: '12px',
                                  fontFamily: 'var(--font-primary)', cursor: 'pointer',
                                }}
                              >{opt}</button>
                            ))}
                          </div>
                          <button onClick={() => setExpandedVariance(null)} style={{ padding: '4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1, alignSelf: 'flex-start', flexShrink: 0 }}>✕</button>
                        </div>
                        {resolution === 'Accept & Update Cost in Edify' && variance.type === 'price' && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '7px', background: 'var(--color-info-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-info)' }}>
                            Updates master ingredient cost to ${variance.invoiceValue.toFixed(2)} — cascades to recipe costing and GP%.
                          </div>
                        )}
                        {resolution === 'Accept for this delivery' && variance.type === 'price' && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '7px', background: 'var(--color-success-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-success)' }}>
                            Pays ${variance.invoiceValue.toFixed(2)} for this delivery only. Ingredient cost stays at ${variance.poValue.toFixed(2)}.
                          </div>
                        )}
                      </td>
                    </tr>
                  );

                  return [dataRow, expandRow];
                })}

                {/* PO Prices tab rows */}
                {rightTab === 'po' && poLines.flatMap(poLine => {
                  const invLine = invoice.lines.find(il => il.sku === poLine.sku);
                  const priceMatch = invLine ? invLine.unitPrice === poLine.price : true;
                  const priceDiff = invLine ? invLine.unitPrice - poLine.price : 0;
                  const lineTotal = poLine.price * poLine.expectedQty;
                  const variance = invoice.variances.find(v => v.sku === poLine.sku);
                  const isExpanded = !!variance && expandedVariance === variance.id;
                  const isResolved = !!variance && !!resolutions[variance.id];
                  const rowBg = !priceMatch && !isResolved ? 'rgba(217, 119, 6, 0.05)' : 'transparent';
                  const leftAccent: React.CSSProperties = !priceMatch && !isResolved ? { boxShadow: 'inset 3px 0 0 var(--color-warning)' } : {};

                  const dataRow = (
                    <tr key={poLine.id} style={{ background: rowBg }}>
                      <td style={{ ...cell, ...leftAccent }}>
                        <div style={{ fontWeight: !priceMatch ? 600 : 400 }}>{invLine?.description ?? poLine.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{poLine.sku}</div>
                      </td>
                      <td style={cell}>{invLine?.qty ?? '—'}</td>
                      <td style={{ ...cell, fontWeight: !priceMatch ? 700 : 400, color: !priceMatch ? 'var(--color-warning)' : undefined }}>
                        {invLine ? `$${invLine.unitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>
                        {invLine ? `$${invLine.lineTotal.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ ...cell }}>
                        {invLine && <TaxSelect lineId={invLine.id} />}
                      </td>
                      <td style={{ ...cell, ...divider, fontWeight: 600, color: invLine && (lineTaxRates[invLine.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {invLine && (lineTaxRates[invLine.id] ?? 0) > 0
                          ? `$${(invLine.lineTotal * (lineTaxRates[invLine.id] ?? 0) / 100).toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ ...cell, color: 'var(--color-text-secondary)' }}>{poLine.expectedQty}</td>
                      <td style={{ ...cell, fontWeight: !priceMatch ? 700 : 400, color: !priceMatch ? 'var(--color-warning)' : undefined }}>
                        ${poLine.price.toFixed(2)}
                      </td>
                      <td style={{ ...cell, fontWeight: 600 }}>${lineTotal.toFixed(2)}</td>
                      <td style={{ ...cell, padding: '6px 12px', textAlign: 'center' }}>
                        {variance
                          ? <VarBadge varianceId={variance.id} label={`${priceDiff > 0 ? '+' : ''}$${Math.abs(priceDiff).toFixed(2)} / unit`} />
                          : <span style={{ color: 'var(--color-success)', fontSize: '13px', fontWeight: 600, opacity: 0.7 }}>✓</span>
                        }
                      </td>
                    </tr>
                  );

                  if (!variance || !isExpanded) return [dataRow];

                  const resolution = resolutions[variance.id] as AnyResolution | undefined;
                  const options = variance.type === 'price' ? PRICE_OPTIONS : QTY_OPTIONS;
                  const vDiff = variance.invoiceValue - variance.poValue;
                  const detail = variance.type === 'price'
                    ? `PO: $${variance.poValue.toFixed(2)} → Invoice: $${variance.invoiceValue.toFixed(2)} (${vDiff >= 0 ? '+' : ''}$${vDiff.toFixed(2)}/unit)`
                    : `GRN: ${variance.grnValue} → Invoice claims: ${variance.invoiceValue}`;
                  const impactLabel = variance.impact >= 0 ? `+$${variance.impact.toFixed(2)}` : `-$${Math.abs(variance.impact).toFixed(2)}`;

                  const expandBgPo = isResolved ? 'rgba(16,185,129,0.03)' : 'rgba(217,119,6,0.04)';
                  const expandAccentPo = isResolved ? 'inset 3px 0 0 var(--color-success)' : 'inset 3px 0 0 var(--color-warning)';

                  const expandRow = (
                    <tr key={`expand-po-${poLine.id}`}>
                      <td colSpan={6 + RC} style={{ padding: '14px 18px', background: expandBgPo, borderBottom: '1px solid var(--color-border-subtle)', boxShadow: expandAccentPo }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-text-primary)' }}>{variance.itemName}</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(217,119,6,0.1)', color: 'var(--color-warning)', border: '1px solid rgba(217,119,6,0.3)' }}>Price</span>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: variance.impact >= 0 ? 'var(--color-error)' : 'var(--color-success)' }}>{impactLabel}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{detail}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', flex: '2 1 280px' }}>
                            {options.map(opt => (
                              <button
                                key={opt}
                                onClick={() => onResolve(variance.id, resolution === opt ? null : opt as AnyResolution)}
                                style={{
                                  padding: '6px 16px', borderRadius: '999px',
                                  border: resolution === opt ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
                                  background: resolution === opt ? 'rgba(34,68,68,0.08)' : '#fff',
                                  color: resolution === opt ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
                                  fontWeight: resolution === opt ? 700 : 600, fontSize: '12px',
                                  fontFamily: 'var(--font-primary)', cursor: 'pointer',
                                }}
                              >{opt}</button>
                            ))}
                          </div>
                          <button onClick={() => setExpandedVariance(null)} style={{ padding: '4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '15px', lineHeight: 1, alignSelf: 'flex-start', flexShrink: 0 }}>✕</button>
                        </div>
                        {resolution === 'Accept & Update Cost in Edify' && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '7px', background: 'var(--color-info-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-info)' }}>
                            Updates master ingredient cost to ${variance.invoiceValue.toFixed(2)} — cascades to recipe costing and GP%.
                          </div>
                        )}
                        {resolution === 'Accept for this delivery' && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '7px', background: 'var(--color-success-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-success)' }}>
                            Pays ${variance.invoiceValue.toFixed(2)} for this delivery only. Ingredient cost stays at ${variance.poValue.toFixed(2)}.
                          </div>
                        )}
                      </td>
                    </tr>
                  );

                  return [dataRow, expandRow];
                })}

              </tbody>
            );
          })}

          {/* ── Unmatched invoice lines (no GRN) ── */}
          {unmatchedInvRows.length > 0 && (
            <tbody>
              {unmatchedInvRows.map(il => {
                const priceVar = invoice.variances.find(v => v.sku === il.sku && v.type === 'price');
                return (
                  <tr key={il.id} style={{ background: 'rgba(185, 28, 28, 0.05)' }}>
                    <td style={cell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        {il.description}
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(185, 28, 28, 0.1)', color: 'var(--color-error)', border: '1px solid rgba(185, 28, 28, 0.25)' }}>NO GRN</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{il.sku}</div>
                    </td>
                    <td style={cell}>{il.qty}</td>
                    <td style={{ ...cell, color: priceVar ? 'var(--color-warning)' : undefined }}>${il.unitPrice.toFixed(2)}</td>
                    <td style={{ ...cell, fontWeight: 600 }}>${il.lineTotal.toFixed(2)}</td>
                    <td style={{ ...cell }}>
                      <TaxSelect lineId={il.id} />
                    </td>
                    <td style={{ ...cell, ...divider, fontWeight: 600, color: (lineTaxRates[il.id] ?? 0) > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {(lineTaxRates[il.id] ?? 0) > 0
                        ? `$${(il.lineTotal * (lineTaxRates[il.id] ?? 0) / 100).toFixed(2)}`
                        : '—'}
                    </td>
                    <td colSpan={RC} style={{ ...cell, color: 'var(--color-text-secondary)', textAlign: 'center' }}>—</td>
                  </tr>
                );
              })}
            </tbody>
          )}

          {/* ── Grand totals ── */}
          <tfoot>
            {/* Subtotal row */}
            <tr style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td colSpan={2} />
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 500 : 700, textAlign: 'right', color: anyTax ? 'var(--color-text-secondary)' : undefined }}>
                {anyTax ? 'Subtotal' : (multiGroup ? 'Grand Total' : 'Total')}
              </td>
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 500 : 700, color: anyTax ? 'var(--color-text-secondary)' : undefined }}>
                ${invoice.total.toFixed(2)}
              </td>
              <td />
              <td style={{ padding: '8px 12px', fontWeight: anyTax ? 600 : 400, ...divider, color: anyTax ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                {anyTax ? `$${totalTax.toFixed(2)}` : '—'}
              </td>
              {rightTab === 'grn' ? (
                <>
                  <td colSpan={3} />
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>${allGrnTotal.toFixed(2)}</td>
                  <td />
                </>
              ) : (
                <>
                  <td colSpan={2} />
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>${allPoTotal.toFixed(2)}</td>
                  <td />
                </>
              )}
            </tr>
            {/* Grand total row — only shown when tax applies */}
            {anyTax && (
              <tr style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td colSpan={2} />
                <td style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'right' }}>Total (incl. tax)</td>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 700, ...divider }}>
                  ${(invoice.total + totalTax).toFixed(2)}
                </td>
                <td colSpan={RC} />
              </tr>
            )}
          </tfoot>
        </table>
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
      id={`variance-${variance.sku}`}
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        border: '1px solid var(--color-border-subtle)',
        background: '#fff',
        transition: 'outline 0.1s',
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

      {resolution === 'Accept & Update Cost in Edify' && variance.type === 'price' && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-info-light)', fontSize: '12px', fontWeight: 500, color: 'var(--color-info)' }}>
          Updates master ingredient cost to ${variance.invoiceValue.toFixed(2)} — cascades to recipe costing and GP%.
        </div>
      )}
      {resolution === 'Accept for this delivery' && variance.type === 'price' && (
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

function ApprovalConfirmation({ invoice, resolutions, grns, unmatchedLines, onBack, onConfirm }: {
  invoice: Invoice;
  resolutions: Record<string, AnyResolution>;
  grns: GRN[];
  unmatchedLines: { description: string; sku: string; qty: number; unitPrice: number; lineTotal: number }[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  const creditNotes = invoice.variances.filter(v => resolutions[v.id]?.includes('Credit Note') || resolutions[v.id]?.includes('Dispute'));
  const creditTotal = creditNotes.reduce((s, v) => s + Math.abs(v.impact), 0);
  const costUpdates = invoice.variances.filter(v => resolutions[v.id] === 'Accept & Update Cost in Edify');
  const deliveryOnly = invoice.variances.filter(v => resolutions[v.id] === 'Accept for this delivery');

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

      {/* Unmatched items warning */}
      {unmatchedLines.length > 0 && (
        <div style={{ border: '1.5px solid var(--color-warning-border)', borderRadius: '10px', background: 'var(--color-warning-light)', padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠</span>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-warning)', margin: 0 }}>
              {unmatchedLines.length} item{unmatchedLines.length !== 1 ? 's' : ''} not matched to a Goods Received Notice
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 12px', fontWeight: 500, lineHeight: 1.5 }}>
            You are approving payment for the following items with no proof of receipt on file. Confirm delivery was received through another channel before proceeding.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {unmatchedLines.map(il => (
              <div key={il.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '7px', background: 'rgba(255,255,255,0.65)', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{il.description}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>({il.sku})</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {il.qty} × ${il.unitPrice.toFixed(2)} = ${il.lineTotal.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final warning */}
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
          Approve & Sync
        </button>
      </div>
    </div>
  );
}
