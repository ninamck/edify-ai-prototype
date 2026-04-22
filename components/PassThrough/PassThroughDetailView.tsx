'use client';

import { useMemo, useState } from 'react';
import StatusBadge, { BadgeVariant } from '@/components/Receiving/StatusBadge';
import {
  PassThroughInvoice,
  PassThroughCategory,
  PassThroughStatus,
  PassThroughActivity,
  CATEGORY_OPTIONS,
  XERO_ACCOUNT_MAP,
  vatAmount,
  grandTotal,
} from './mockData';

interface Props {
  invoice: PassThroughInvoice;
  onBack: () => void;
  modeLabel?: string;
  modeDescription?: string;
  topContent?: React.ReactNode;
  onSend?: (payload: { invoiceId: string; xeroRef: string; xeroAccount: string; grandTotal: number }) => void;
}

function statusVariant(s: PassThroughStatus): BadgeVariant {
  switch (s) {
    case 'Awaiting review': return 'warning';
    case 'Ready to send': return 'info';
    case 'Sent to Xero': return 'success';
    case 'Failed to sync': return 'error';
  }
}

export default function PassThroughDetailView({ invoice, onBack, modeLabel, modeDescription, topContent, onSend }: Props) {
  const [supplier, setSupplier] = useState(invoice.supplier);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
  const [dueDate, setDueDate] = useState(invoice.dueDate ?? '');
  const [totalExVat, setTotalExVat] = useState(invoice.totalExVat);
  const [vatRate, setVatRate] = useState<number | null>(invoice.vatRate);
  const [category, setCategory] = useState<PassThroughCategory | null>(invoice.category);
  const [activity, setActivity] = useState<PassThroughActivity[]>(invoice.activity);
  const [status, setStatus] = useState<PassThroughStatus>(invoice.status);
  const [xeroRef, setXeroRef] = useState(invoice.xeroReference);
  const [showConfirm, setShowConfirm] = useState(false);

  const locked = status === 'Sent to Xero';
  const vatValue = vatRate === null ? 0 : totalExVat * (vatRate / 100);
  const grand = totalExVat + vatValue;

  const xeroAccount = category ? XERO_ACCOUNT_MAP[category] : null;
  const canSend = !!category && !!dueDate && !!supplier && !!invoiceNumber && totalExVat > 0 && xeroAccount !== null && !locked;

  const readyMessage = useMemo(() => {
    if (locked) return `Sent to Xero · ref ${xeroRef ?? '—'}`;
    if (!category) return 'Set a category so Xero picks the right account.';
    if (category === 'Other' && xeroAccount === null) return 'Pick a Xero account for "Other" category before sending.';
    if (!dueDate) return 'Confirm the due date before sending.';
    return 'Ready to push to Xero.';
  }, [locked, category, xeroAccount, dueDate, xeroRef]);

  const logEvent = (event: PassThroughActivity['event'], note?: string) => {
    const entry: PassThroughActivity = {
      id: `pa-local-${Date.now()}`,
      timestamp: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·'),
      event,
      by: 'Priya Naidoo',
      note,
    };
    setActivity(prev => [...prev, entry]);
  };

  const handleSend = () => {
    const ref = `XERO-INV-${Math.floor(10000 + Math.random() * 89999)}`;
    setXeroRef(ref);
    setStatus('Sent to Xero');
    logEvent('sent', `Pushed to Xero · account "${xeroAccount}" · ref ${ref}.`);
    setShowConfirm(false);
    if (onSend && xeroAccount) {
      onSend({ invoiceId: invoice.id, xeroRef: ref, xeroAccount, grandTotal: grand });
    }
  };

  return (
    <div style={{ fontFamily: 'var(--font-primary)' }}>
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent-deep)', fontFamily: 'var(--font-primary)', marginBottom: '4px' }}
      >
        ← Back to Invoices
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {invoiceNumber} — {supplier}
            </h1>
            <StatusBadge status={status} variant={statusVariant(status)} />
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: 'rgba(3,105,161,0.08)', color: 'var(--color-info)', border: '1px solid rgba(3,105,161,0.25)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {modeLabel ?? 'Pass-through'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            {modeDescription ?? 'No PO, no GRN — skips matching, routes direct to Xero.'}
          </p>
        </div>
      </div>

      {topContent && <div style={{ marginBottom: '16px' }}>{topContent}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '20px', alignItems: 'flex-start' }}>
        {/* PDF preview */}
        <section style={{
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '12px',
          background: '#fff',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Invoice PDF</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={pdfBtnStyle}>View full PDF</button>
              <button style={pdfBtnStyle}>Download</button>
            </div>
          </div>
          <div style={{
            minHeight: '560px',
            background: 'var(--color-bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '13px',
            textAlign: 'center',
            padding: '32px',
          }}>
            <div>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{invoiceNumber} · {supplier}</div>
              <div style={{ marginTop: '6px' }}>PDF preview placeholder.</div>
              <div style={{ marginTop: '2px', fontSize: '12px' }}>In production, the parsed invoice document renders here.</div>
            </div>
          </div>
        </section>

        {/* Right column: fields + action + activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <section style={cardStyle}>
            <h2 style={cardTitle}>Invoice details</h2>
            <FieldRow label="Supplier">
              <TextInput value={supplier} onChange={setSupplier} disabled={locked} />
            </FieldRow>
            <FieldRow label="Invoice #">
              <TextInput value={invoiceNumber} onChange={setInvoiceNumber} disabled={locked} />
            </FieldRow>
            <FieldRow label="Invoice date">
              <ReadonlyValue>{invoice.invoiceDate}</ReadonlyValue>
            </FieldRow>
            <FieldRow label="Due date">
              <TextInput value={dueDate} onChange={setDueDate} placeholder="e.g. 14 Apr 2026" disabled={locked} />
            </FieldRow>
            <FieldRow label="Total (ex-VAT)">
              <TextInput
                value={totalExVat.toFixed(2)}
                onChange={(v) => {
                  const n = parseFloat(v);
                  if (!isNaN(n)) setTotalExVat(n);
                }}
                prefix="£"
                disabled={locked}
              />
            </FieldRow>
            <FieldRow label="VAT">
              <select
                value={vatRate ?? ''}
                onChange={e => setVatRate(e.target.value === '' ? null : Number(e.target.value))}
                disabled={locked}
                style={{
                  fontSize: '12px', fontFamily: 'var(--font-primary)',
                  border: '1px solid var(--color-border)', borderRadius: '6px',
                  padding: '6px 8px', background: '#fff', color: 'var(--color-text-primary)',
                  cursor: locked ? 'not-allowed' : 'pointer', outline: 'none', width: '100%',
                }}
              >
                <option value="">— No VAT</option>
                <option value={0}>0%</option>
                <option value={5}>5%</option>
                <option value={20}>20%</option>
              </select>
            </FieldRow>
            <FieldRow label="VAT amount">
              <ReadonlyValue muted={vatRate === null}>
                {vatRate === null ? '—' : `£${vatValue.toFixed(2)}`}
              </ReadonlyValue>
            </FieldRow>

            <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Grand total</span>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>£{grand.toFixed(2)}</span>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={cardTitle}>Category</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 10px', fontWeight: 500 }}>
              Determines which Xero account this invoice posts to.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATEGORY_OPTIONS.map(opt => {
                const active = category === opt;
                return (
                  <button
                    key={opt}
                    disabled={locked}
                    onClick={() => {
                      if (active) setCategory(null);
                      else {
                        setCategory(opt);
                        logEvent('category-set', `Category set to ${opt}.`);
                      }
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '100px',
                      border: active ? '1.5px solid var(--color-accent-active)' : '1px solid var(--color-border)',
                      background: active ? 'var(--color-accent-active)' : '#fff',
                      color: active ? '#fff' : 'var(--color-text-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-primary)',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      opacity: locked && !active ? 0.5 : 1,
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--color-bg-hover)', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Xero account</div>
              <div style={{ marginTop: '2px' }}>
                {!category
                  ? <em>Pick a category above</em>
                  : xeroAccount === null
                    ? <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>⚠ "Other" — choose a Xero account manually before sending</span>
                    : <><strong style={{ color: 'var(--color-text-primary)' }}>{xeroAccount}</strong> — auto-mapped</>}
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: canSend ? 'var(--color-success)' : 'var(--color-text-secondary)', marginBottom: '10px' }}>
              {readyMessage}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={onBack}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: '#fff',
                  border: '1px solid var(--color-border)',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                {locked ? 'Back' : 'Cancel'}
              </button>
              {!locked ? (
                <button
                  disabled={!canSend}
                  onClick={() => setShowConfirm(true)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: canSend ? 'var(--color-accent-active)' : 'var(--color-bg-hover)',
                    border: canSend ? 'none' : '1px solid var(--color-border)',
                    fontWeight: 700,
                    fontSize: '13px',
                    fontFamily: 'var(--font-primary)',
                    color: canSend ? '#fff' : 'var(--color-text-secondary)',
                    cursor: canSend ? 'pointer' : 'not-allowed',
                  }}
                >
                  Send to Xero →
                </button>
              ) : (
                <a
                  href="#"
                  onClick={e => e.preventDefault()}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid var(--color-success-border)',
                    fontWeight: 700,
                    fontSize: '13px',
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--color-success)',
                    textDecoration: 'none',
                  }}
                >
                  View in Xero →
                </a>
              )}
            </div>
          </section>

          <ActivityTimeline activity={activity} />
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          supplier={supplier}
          invoiceNumber={invoiceNumber}
          grand={grand}
          vatValue={vatValue}
          xeroAccount={xeroAccount!}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleSend}
        />
      )}
    </div>
  );
}

function ActivityTimeline({ activity }: { activity: PassThroughActivity[] }) {
  return (
    <section style={cardStyle}>
      <h2 style={cardTitle}>Activity</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activity.map(a => (
          <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activityDotColor(a.event),
              marginTop: '7px',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {activityLabel(a.event)} <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>· {a.by}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: '1px' }}>
                {a.timestamp}
              </div>
              {a.note && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-primary)', marginTop: '3px', lineHeight: 1.5 }}>
                  {a.note}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function activityLabel(event: PassThroughActivity['event']): string {
  switch (event) {
    case 'auto-routed': return 'Auto-routed to pass-through';
    case 'manually-routed': return 'Manually routed to pass-through';
    case 'fields-reviewed': return 'Fields reviewed';
    case 'category-set': return 'Category set';
    case 'sent': return 'Sent to Xero';
    case 'sync-failed': return 'Xero sync failed';
    case 'sync-retried': return 'Xero sync retried';
  }
}

function activityDotColor(event: PassThroughActivity['event']): string {
  if (event === 'sent') return 'var(--color-success)';
  if (event === 'sync-failed') return 'var(--color-error)';
  if (event === 'auto-routed' || event === 'manually-routed') return 'var(--color-info)';
  return 'var(--color-border)';
}

function ConfirmModal({
  supplier, invoiceNumber, grand, vatValue, xeroAccount, onCancel, onConfirm,
}: {
  supplier: string; invoiceNumber: string; grand: number; vatValue: number; xeroAccount: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          fontFamily: 'var(--font-primary)',
        }}
      >
        <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px' }}>
          Send {invoiceNumber} to Xero?
        </h2>
        <ul style={{ margin: '0 0 18px', padding: '0 0 0 18px', fontSize: '13px', lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
          <li>Supplier: <strong>{supplier}</strong></li>
          <li>Amount: <strong>£{grand.toFixed(2)}</strong> (incl. £{vatValue.toFixed(2)} VAT)</li>
          <li>Xero account: <strong>{xeroAccount}</strong></li>
          <li>No PO, no GRN — this invoice bypasses three-way matching.</li>
        </ul>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '10px 18px', borderRadius: '8px', background: '#fff', border: '1px solid var(--color-border)', fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--color-accent-active)', border: 'none', fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-primary)', color: '#fff', cursor: 'pointer' }}
          >
            Send to Xero
          </button>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '12px',
  padding: '18px',
  background: '#fff',
};

const cardTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: '0 0 12px',
};

const pdfBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: '6px',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, prefix, placeholder, disabled }: { value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {prefix && <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{prefix}</span>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: '6px',
          border: '1px solid var(--color-border)',
          fontSize: '12px',
          fontFamily: 'var(--font-primary)',
          outline: 'none',
          background: disabled ? 'var(--color-bg-hover)' : '#fff',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}

function ReadonlyValue({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{ fontSize: '12px', color: muted ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', fontWeight: 500 }}>
      {children}
    </span>
  );
}
