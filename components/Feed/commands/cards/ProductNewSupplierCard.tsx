'use client';

import { useState } from 'react';
import { Truck, ChevronDown, ChevronRight } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';

interface ProductNewSupplierCardProps {
  state: CardState;
  /** Pre-filled supplier name from Step 1. */
  supplierName: string;
  initialEmail?: string;
  onSubmit: (input: {
    supplierName: string;
    email: string;
    contactName?: string;
    phone?: string;
    minimumOrderValue?: number;
  }) => void;
  onCancel: () => void;
}

/**
 * Step 2 of the product wizard — only shown when Step 1's supplier
 * was a new (un-matched) name.
 *
 * Two required fields make a supplier real: its name (already
 * captured) and the order email — that's where purchase orders send,
 * so a supplier without one can't be ordered from. Everything else
 * (contact name, phone, minimum order) is offered behind "More
 * details" and never forced; categories, sites and status default
 * downstream and live on the supplier page.
 */
export default function ProductNewSupplierCard({
  state,
  supplierName,
  initialEmail,
  onSubmit,
  onCancel,
}: ProductNewSupplierCardProps) {
  const [email, setEmail] = useState<string>(initialEmail ?? '');
  const [moreOpen, setMoreOpen] = useState(false);
  const [contactName, setContactName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [mov, setMov] = useState<string>('');

  const emailValid = /\S+@\S+\.\S+/.test(email.trim());

  function submit() {
    if (!emailValid) return;
    const movNum = Number(mov);
    onSubmit({
      supplierName,
      email: email.trim(),
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      minimumOrderValue: mov.trim() && Number.isFinite(movNum) && movNum > 0 ? movNum : undefined,
    });
  }

  return (
    <CardShell
      icon={Truck}
      title={`New supplier · ${supplierName}`}
      subtitle="Order email is required — it's where purchase orders go"
      state={state}
      confirmLabel="Next"
      onCancel={onCancel}
      onConfirm={submit}
      confirmDisabled={!emailValid}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.45,
          }}
        >
          A supplier without an order email can&rsquo;t be ordered from, so
          that one&rsquo;s required. Everything else can wait — add it now or
          on the supplier page later.
        </p>

        <div>
          <Label>Order email</Label>
          <input
            type="email"
            value={email}
            disabled={state !== 'pending'}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="orders@supplier.com"
            autoFocus
            style={inputStyle}
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '100px',
              border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              background: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {moreOpen ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronRight size={12} strokeWidth={2.4} />}
            More details · contact, phone, minimum order
          </button>

          {moreOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <Label>Contact name</Label>
                  <input
                    type="text"
                    value={contactName}
                    disabled={state !== 'pending'}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <Label>Phone</Label>
                  <input
                    type="tel"
                    value={phone}
                    disabled={state !== 'pending'}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+44…"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <Label>Minimum order value (£)</Label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={mov}
                  disabled={state !== 'pending'}
                  onChange={(e) => setMov(e.target.value)}
                  placeholder="e.g. 150"
                  style={{ ...inputStyle, width: '150px' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '6px',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--color-text-primary)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  );
}
