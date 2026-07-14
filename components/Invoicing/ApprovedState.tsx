'use client';

import StatusBadge from '@/components/Receiving/StatusBadge';
import { Invoice, getApprovedResolutions, getPOsForInvoice } from './mockData';
import { BASE_CURRENCY, currencySymbol, formatMoney } from '@/lib/currency';

interface ApprovedStateProps {
  invoice: Invoice;
  onBackToInvoices: () => void;
}

interface CostUpdate { item: string; oldPrice: number; newPrice: number; change: string; }
interface DeliveryOnly { item: string; invoicePrice: number; masterPrice: number; }

export default function ApprovedState({ invoice, onBackToInvoices }: ApprovedStateProps) {
  const resolutions = getApprovedResolutions(invoice.id) ?? {};
  const invCurrency = invoice.currency ?? BASE_CURRENCY;
  const isForeign = invCurrency !== BASE_CURRENCY;
  const sym = currencySymbol(invCurrency);
  const pos = getPOsForInvoice(invoice);

  const COST_UPDATES: CostUpdate[] = invoice.variances
    .filter(v => v.type === 'price' && resolutions[v.id] === 'Accept & Update Cost in Edify')
    .map(v => {
      const pct = v.poValue > 0 ? ((v.invoiceValue - v.poValue) / v.poValue) * 100 : 0;
      return {
        item: v.itemName,
        oldPrice: v.poValue,
        newPrice: v.invoiceValue,
        change: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      };
    });

  const DELIVERY_ONLY: DeliveryOnly[] = invoice.variances
    .filter(v => v.type === 'price' && resolutions[v.id] === 'Accept for this delivery')
    .map(v => ({ item: v.itemName, invoicePrice: v.invoiceValue, masterPrice: v.poValue }));

  const creditNoteVariances = invoice.variances.filter(v => {
    const r = resolutions[v.id];
    return r === 'Credit Note' || r === 'Dispute → Credit Note' || r === 'Request credit note';
  });
  const creditNoteCount = creditNoteVariances.length;
  const creditValue = creditNoteVariances.reduce((s, v) => s + Math.abs(v.impact), 0);

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      {/* Success banner */}
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', margin: '0 auto 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--color-success)', color: 'var(--color-success)',
          fontSize: '24px', fontWeight: 700,
        }}>✓</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
          Invoice Approved
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Invoice approved and queued for Xero sync.{COST_UPDATES.length > 0 ? ` ${COST_UPDATES.length} ingredient cost${COST_UPDATES.length > 1 ? 's' : ''} updated. Recipe GP% recalculated.` : ''}{DELIVERY_ONLY.length > 0 ? ` ${DELIVERY_ONLY.length} price${DELIVERY_ONLY.length > 1 ? 's' : ''} accepted for this delivery only.` : ''}
        </p>
      </div>

      {/* Summary card */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '12px',
          padding: '20px',
          background: '#fff',
          marginBottom: '20px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>
          Approval Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', fontSize: '13px' }}>
          <SummaryRow label="Invoice" value={invoice.invoiceNumber} />
          <SummaryRow label="Supplier" value={invoice.supplier} />
          <SummaryRow label="Invoice Date" value={invoice.date} />
          <SummaryRow label="Approved By" value="Nina McKinnon" />
          {pos.length > 0 && <SummaryRow label={pos.length === 1 ? 'Purchase Order' : 'Purchase Orders'} value={pos.join(', ')} />}
          {invoice.grnNumbers.length > 0 && <SummaryRow label={invoice.grnNumbers.length === 1 ? 'GRN' : 'GRNs'} value={invoice.grnNumbers.join(', ')} />}
          {isForeign && (
            <SummaryRow
              label="Exchange Rate"
              value={`1 ${invCurrency} = ${(invoice.lockedFxRate ?? 1).toFixed(2)} ${BASE_CURRENCY} · locked at receipt`}
            />
          )}
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Xero Status</span>
            <div style={{ marginTop: '4px' }}><StatusBadge status="Queued for sync" variant="info" /></div>
          </div>
          {creditNoteCount > 0 && (
            <div>
              <span style={{ color: 'var(--color-text-secondary)' }}>Credit Notes</span>
              <div style={{ marginTop: '4px' }}>
                <StatusBadge status={`${creditNoteCount} · £${creditValue.toFixed(2)}`} variant="warning" />
              </div>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--color-text-secondary)' }}>Total</span>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px', fontSize: '16px' }}>
              {invoice.currency && invoice.currency !== BASE_CURRENCY ? (
                <>
                  {formatMoney(invoice.total, invoice.currency)}
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                    {formatMoney(invoice.total * (invoice.lockedFxRate ?? 1), BASE_CURRENCY)} at locked rate
                  </span>
                </>
              ) : (
                <>£{invoice.total.toFixed(2)}</>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice lines — the full invoice, not just the sync status */}
      {invoice.lines.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            background: '#fff',
            marginBottom: '20px',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 20px 0' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
              Invoice Lines
            </h3>
            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
              As billed by the supplier{isForeign ? ` in ${invCurrency}` : ''}.
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Item', 'SKU', 'Qty', 'Unit Price', 'Line Total'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i >= 2 ? 'right' : 'left',
                      padding: '8px 20px',
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
              {invoice.lines.map(line => (
                <tr key={line.id}>
                  <td style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-subtle)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {line.description}
                  </td>
                  <td style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {line.sku}
                  </td>
                  <td style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right', color: 'var(--color-text-primary)' }}>
                    {line.qty}
                  </td>
                  <td style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                    {sym}{line.unitPrice.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 20px', borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                    {sym}{line.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Total
                </td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                  {formatMoney(invoice.total, invCurrency)}
                  {isForeign && (
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                      {formatMoney(invoice.total * (invoice.lockedFxRate ?? 1), BASE_CURRENCY)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Note card */}
      {invoice.note && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            padding: '16px 20px',
            background: 'var(--color-bg-hover)',
            marginBottom: '20px',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
          }}
        >
          <span style={{ marginRight: '8px' }}>📝</span>
          {invoice.note}
          {invoice.noteAuthor && (
            <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              — {invoice.noteAuthor}{invoice.noteUpdatedAt ? `, ${invoice.noteUpdatedAt}` : ''}
            </span>
          )}
        </div>
      )}

      {/* Cost Updates card */}
      {COST_UPDATES.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            padding: '20px',
            background: '#fff',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            Ingredient Costs Updated
          </h3>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
            These prices are now the new master cost. Recipe GP% has been recalculated.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {COST_UPDATES.map(ci => (
              <div
                key={ci.item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-hover)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{ci.item}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    £{ci.oldPrice.toFixed(2)} → £{ci.newPrice.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <StatusBadge status={ci.change} variant="warning" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery-only prices card */}
      {DELIVERY_ONLY.length > 0 && (
        <div
          style={{
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '12px',
            padding: '20px',
            background: '#fff',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
            Accepted for This Delivery Only
          </h3>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
            These prices were accepted for this invoice but did not change the master ingredient cost.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DELIVERY_ONLY.map(d => (
              <div
                key={d.item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-hover)',
                  border: '1px solid var(--color-border-subtle)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>{d.item}</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                    Charged £{d.invoicePrice.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  Master cost unchanged at £{d.masterPrice.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={onBackToInvoices}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: 'var(--color-accent-active)',
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            fontSize: '14px',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          Back to Invoices
        </button>
        <button
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: '#fff',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            fontWeight: 600,
            fontSize: '14px',
            fontFamily: 'var(--font-primary)',
            cursor: 'pointer',
          }}
        >
          View in Xero
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '4px' }}>{value}</div>
    </div>
  );
}
