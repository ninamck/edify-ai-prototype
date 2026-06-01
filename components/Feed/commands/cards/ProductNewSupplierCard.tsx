'use client';

import { useState } from 'react';
import { Truck, SkipForward } from 'lucide-react';
import CardShell, { type CardState } from './CardShell';

interface ProductNewSupplierCardProps {
  state: CardState;
  /** Pre-filled supplier name from Step 1. */
  supplierName: string;
  initialEmail?: string;
  initialLeadTimeDays?: number;
  onSubmit: (input: {
    supplierName: string;
    email?: string;
    leadTimeDays?: number;
  }) => void;
  onCancel: () => void;
}

/**
 * Step 2 of the Replace-a-product wizard. Only shown when Step 1's
 * supplier was a new (un-matched) name.
 *
 * Captures the bare minimum to make the supplier addressable — email
 * + lead time. Everything else (categories, sites, cut-off, MOV,
 * delivery days) defaults sensibly downstream and can be filled in
 * later on the supplier detail page. A "Skip for now" affordance is
 * always available since most operators just want the swap and will
 * tidy supplier metadata afterward.
 */
export default function ProductNewSupplierCard({
  state,
  supplierName,
  initialEmail,
  initialLeadTimeDays,
  onSubmit,
  onCancel,
}: ProductNewSupplierCardProps) {
  const [email, setEmail] = useState<string>(initialEmail ?? '');
  const [leadTime, setLeadTime] = useState<string>(
    initialLeadTimeDays != null ? String(initialLeadTimeDays) : '',
  );

  function submit(skip: boolean) {
    onSubmit({
      supplierName,
      email: skip ? undefined : email.trim() || undefined,
      leadTimeDays: skip ? undefined : leadTime.trim() ? Number(leadTime) : undefined,
    });
  }

  return (
    <CardShell
      icon={Truck}
      title={`New supplier · ${supplierName}`}
      subtitle="Step 2 of 4 — supplier basics (optional)"
      state={state}
      confirmLabel="Next"
      onCancel={onCancel}
      onConfirm={() => submit(false)}
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
          A bit of contact info now will save you a trip to the supplier
          page later. Anything blank just defaults — you can edit it
          later.
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
          <Label>Lead time (days)</Label>
          <input
            type="number"
            min={0}
            step={1}
            value={leadTime}
            disabled={state !== 'pending'}
            onChange={(e) => setLeadTime(e.target.value)}
            placeholder="e.g. 2"
            style={{ ...inputStyle, width: '120px' }}
          />
          <div
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              marginTop: '4px',
            }}
          >
            How many days between ordering and delivery.
          </div>
        </div>

        {state === 'pending' && (
          <button
            type="button"
            onClick={() => submit(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '100px',
              border: '1.5px dashed var(--color-border, rgba(0,28,53,0.18))',
              background: 'transparent',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <SkipForward size={12} strokeWidth={2.2} />
            Skip for now
          </button>
        )}
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
