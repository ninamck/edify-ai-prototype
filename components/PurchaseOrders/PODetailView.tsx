'use client';

import StatusBadge, { BadgeVariant } from '@/components/Receiving/StatusBadge';
import { POCoverage, POCoverageStatus, POLineCoverage } from '@/components/Invoicing/mockData';

interface PODetailViewProps {
  coverage: POCoverage;
  onBack: () => void;
  onOpenInvoice: (invoiceId: string) => void;
}

export default function PODetailView({ coverage, onBack, onOpenInvoice }: PODetailViewProps) {
  const { po, invoices, poAmount, invoicedAmount, percent, lineCoverage, status, fullyInvoicedLineCount } = coverage;

  const remaining = Math.max(0, poAmount - invoicedAmount);
  const overBy = Math.max(0, invoicedAmount - poAmount);
  const pendingLineCount = lineCoverage.filter(l => l.invoicedQty < l.poLine.expectedQty).length;

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '4px' }}
      >
        ← Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {po.poNumber} — {po.supplier}
            </h1>
            <StatusBadge status={status} variant={poStatusVariant(status)} />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Sent {po.dateSent} · {po.site} · {po.lines.length} item{po.lines.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Running total card */}
      <RunningTotalCard
        poAmount={poAmount}
        invoicedAmount={invoicedAmount}
        percent={percent}
        status={status}
        fullyInvoicedLineCount={fullyInvoicedLineCount}
        pendingLineCount={pendingLineCount}
        totalLineCount={lineCoverage.length}
        remaining={remaining}
        overBy={overBy}
      />

      {/* Invoices list */}
      <section style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
          Invoices on this PO
        </h2>
        {invoices.length === 0 ? (
          <div style={{ padding: '18px 20px', borderRadius: '12px', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border-subtle)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            No invoices received yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {invoices.map(inv => {
              const thisCoverage = lineCoverage.flatMap(lc =>
                lc.applications.filter(a => a.invoice.id === inv.id).map(a => ({ a, lc }))
              );
              const coveredTotal = thisCoverage.reduce((s, { a }) => s + a.lineTotal, 0);
              return (
                <div key={inv.id} style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  background: '#fff',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)' }}>{inv.invoiceNumber}</span>
                      <StatusBadge status={inv.status} variant={invoiceStatusVariant(inv.status)} />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      {inv.date} · £{coveredTotal.toFixed(2)} applied · {thisCoverage.length} line{thisCoverage.length === 1 ? '' : 's'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted, var(--color-text-secondary))', marginTop: '4px' }}>
                      Covers: {thisCoverage.length > 0
                        ? thisCoverage.map(({ a, lc }) => `${lc.poLine.name} ${a.qty}/${lc.poLine.expectedQty}`).join(' · ')
                        : '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => onOpenInvoice(inv.id)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Line-level coverage */}
      <section style={{ marginTop: '28px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
          Line coverage
        </h2>
        <div style={{ border: '1px solid var(--color-border-subtle)', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-primary)', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Item', 'Ordered', 'Invoiced', 'Remaining', 'Invoice(s)', 'Status'].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      fontSize: '12px',
                      fontWeight: 500,
                      letterSpacing: '0.04em',
                      color: 'var(--color-text-secondary)',
                      borderBottom: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineCoverage.map(lc => (
                <LineCoverageRow key={lc.poLine.id} line={lc} onOpenInvoice={onOpenInvoice} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RunningTotalCard({
  poAmount, invoicedAmount, percent, status, fullyInvoicedLineCount, pendingLineCount, totalLineCount, remaining, overBy,
}: {
  poAmount: number; invoicedAmount: number; percent: number;
  status: POCoverageStatus; fullyInvoicedLineCount: number; pendingLineCount: number; totalLineCount: number;
  remaining: number; overBy: number;
}) {
  const barColor =
    status === 'Over-invoiced' ? 'var(--color-error)' :
    status === 'Fully Invoiced' ? 'var(--color-success)' :
    'var(--color-accent-active)';
  const displayPercent = Math.min(100, Math.round(percent));
  const overPercent = Math.max(0, Math.round(percent - 100));

  return (
    <div style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: '12px',
      padding: '20px',
      background: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Invoiced so far
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          {Math.round(percent)}%
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-primary)' }}>£{invoicedAmount.toFixed(2)}</span>
        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>of £{poAmount.toFixed(2)}</span>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: '14px', height: '10px', borderRadius: '999px', background: 'var(--color-bg-hover)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${displayPercent}%`, background: barColor, transition: 'width 0.2s' }} />
        {overPercent > 0 && (
          <div style={{ width: `${Math.min(20, overPercent)}%`, background: 'var(--color-error)', opacity: 0.4 }} />
        )}
      </div>

      <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <span><strong style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{fullyInvoicedLineCount}</strong> of {totalLineCount} lines complete</span>
        {pendingLineCount > 0 && <span>· <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{pendingLineCount}</strong> pending</span>}
        {status === 'Partially Invoiced' && remaining > 0 && <span>· £{remaining.toFixed(2)} remaining</span>}
        {status === 'Over-invoiced' && <span style={{ color: 'var(--color-error)', fontWeight: 700 }}>· Over-invoiced by £{overBy.toFixed(2)}</span>}
        {status === 'Fully Invoiced' && <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>· PO fully invoiced</span>}
      </div>
    </div>
  );
}

function LineCoverageRow({ line, onOpenInvoice }: { line: POLineCoverage; onOpenInvoice: (invoiceId: string) => void }) {
  const { poLine, invoicedQty, remainingQty, applications, overInvoiced } = line;

  const lineStatus = overInvoiced ? 'Over' :
    invoicedQty >= poLine.expectedQty ? 'Complete' :
    invoicedQty > 0 ? 'Partial' : 'Pending';
  const lineVariant: BadgeVariant =
    overInvoiced ? 'error' :
    invoicedQty >= poLine.expectedQty ? 'success' :
    invoicedQty > 0 ? 'warning' : 'default';

  const cellStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderBottom: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-primary)',
    verticalAlign: 'top',
  };

  return (
    <tr>
      <td style={{ ...cellStyle, fontWeight: 600 }}>
        {poLine.name}
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>{poLine.sku}</div>
      </td>
      <td style={cellStyle}>{poLine.expectedQty}</td>
      <td style={cellStyle}>
        {invoicedQty}
        {applications.length > 0 && (
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            £{line.invoicedAmount.toFixed(2)}
          </div>
        )}
      </td>
      <td style={{ ...cellStyle, color: remainingQty === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', fontWeight: remainingQty > 0 ? 600 : 400 }}>
        {remainingQty > 0 ? remainingQty : '—'}
      </td>
      <td style={cellStyle}>
        {applications.length === 0 ? (
          <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {applications.map(app => (
              <button
                key={app.invoice.id}
                onClick={() => onOpenInvoice(app.invoice.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontFamily: 'var(--font-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-accent-active)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {app.invoice.invoiceNumber} · {app.qty}
                {app.priceDelta !== 0 && (
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600, marginLeft: '6px' }}>
                    {app.priceDelta > 0 ? '+' : ''}£{app.priceDelta.toFixed(2)}/unit
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </td>
      <td style={cellStyle}>
        <StatusBadge status={lineStatus} variant={lineVariant} />
      </td>
    </tr>
  );
}

function poStatusVariant(status: POCoverageStatus): BadgeVariant {
  switch (status) {
    case 'Fully Invoiced': return 'success';
    case 'Partially Invoiced': return 'warning';
    case 'Over-invoiced': return 'error';
    default: return 'default';
  }
}

function invoiceStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'Variance': return 'warning';
    case 'Parse Failed':
    case 'Duplicate': return 'error';
    case 'Approved':
    case 'Matched': return 'success';
    case 'Matching in Progress': return 'info';
    default: return 'default';
  }
}
