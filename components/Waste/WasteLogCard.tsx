'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Minus, Plus, Check, Calendar } from 'lucide-react';
import {
  WASTE_REASONS,
  getProduct,
  type WasteReasonId,
} from '@/components/Waste/wasteData';

export default function WasteLogCard({
  itemId,
  initialQty,
  initialReason,
}: {
  itemId: string;
  initialQty: number;
  initialReason: WasteReasonId | null;
}) {
  const router = useRouter();
  const product = getProduct(itemId);
  const [qty, setQty] = useState<number>(initialQty);
  const [uom, setUom] = useState<string>(product?.uomOptions[0] ?? 'unit');
  const [reason, setReason] = useState<WasteReasonId | null>(initialReason);
  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [confirmation, setConfirmation] = useState<string | null>(null);

  if (!product) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Product not found. <button onClick={() => router.push('/log-waste')}>Back to picker</button>
      </div>
    );
  }

  const value = qty * product.unitCost;
  const canLog = reason !== null && qty > 0;
  const multiUom = product.uomOptions.length > 1;

  function goPicker() {
    router.push('/log-waste');
  }

  function log(andAddAnother: boolean) {
    // Prototype — no persistence. Show a confirmation toast, then return.
    setConfirmation(
      `Logged ${qty} ${uom}${qty === 1 ? '' : 's'} of ${product!.name} · £${value.toFixed(2)}`,
    );
    setTimeout(() => {
      setConfirmation(null);
      if (andAddAnother) {
        goPicker();
      } else {
        router.push('/');
      }
    }, 900);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '40px' }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={goPicker}
          aria-label="Back to picker"
          style={{
            all: 'unset',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: '1px solid var(--color-border-subtle)',
            background: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} color="var(--color-text-secondary)" strokeWidth={2} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1.2,
              fontFamily: 'var(--font-display, var(--font-primary))',
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              textTransform: 'capitalize',
              marginTop: '2px',
            }}
          >
            {product.category} · £{product.unitCost.toFixed(2)} per {product.uomOptions[0]}
          </div>
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: '14px',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 2px 10px rgba(58,48,40,0.08)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
        }}
      >
        {/* Qty */}
        <Field label="Quantity">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <StepperButton onClick={() => setQty((q) => Math.max(0, +(q - 1).toFixed(2)))} aria-label="Decrease quantity">
              <Minus size={16} strokeWidth={2.2} />
            </StepperButton>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Number.isFinite(+e.target.value) ? +e.target.value : 0)}
              inputMode="decimal"
              step="1"
              min={0}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '36px',
                fontWeight: 700,
                fontFamily: 'var(--font-display, var(--font-primary))',
                color: 'var(--color-text-primary)',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                MozAppearance: 'textfield',
              }}
            />
            <StepperButton onClick={() => setQty((q) => +(q + 1).toFixed(2))} aria-label="Increase quantity">
              <Plus size={16} strokeWidth={2.2} />
            </StepperButton>
          </div>
        </Field>

        {/* UoM */}
        <Field label="Unit">
          {multiUom ? (
            <PillGroup>
              {product.uomOptions.map((u) => (
                <Pill key={u} active={uom === u} onClick={() => setUom(u)}>
                  {u}
                </Pill>
              ))}
            </PillGroup>
          ) : (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'var(--color-bg-hover)',
                color: 'var(--color-text-secondary)',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-block',
              }}
            >
              {uom}
            </div>
          )}
        </Field>

        {/* Reason */}
        <Field label="Reason" required>
          <PillGroup>
            {WASTE_REASONS.map((r) => (
              <Pill key={r.id} active={reason === r.id} onClick={() => setReason(r.id)}>
                {r.label}
              </Pill>
            ))}
          </PillGroup>
        </Field>

        {/* Date */}
        <Field label="When">
          <PillGroup>
            <Pill active={dateMode === 'today'} onClick={() => { setDateMode('today'); setCustomDate(''); }}>Today</Pill>
            <Pill active={dateMode === 'yesterday'} onClick={() => { setDateMode('yesterday'); setCustomDate(''); }}>Yesterday</Pill>
            <DatePickerPill
              active={dateMode === 'custom'}
              value={customDate}
              onChange={(v) => { setCustomDate(v); setDateMode(v ? 'custom' : 'today'); }}
            />
          </PillGroup>
        </Field>

        {/* Value */}
        <div
          style={{
            marginTop: '-4px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'var(--color-bg-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Waste value
          </span>
          <span
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-display, var(--font-primary))',
            }}
          >
            £{value.toFixed(2)}
          </span>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => canLog && log(false)}
          disabled={!canLog}
          style={{
            flex: '1 1 180px',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: canLog ? 'var(--color-accent-deep)' : 'var(--color-bg-hover)',
            color: canLog ? '#F4F1EC' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
            fontSize: '14px',
            fontWeight: 700,
            cursor: canLog ? 'pointer' : 'not-allowed',
          }}
        >
          Log
        </button>
        <button
          type="button"
          onClick={() => canLog && log(true)}
          disabled={!canLog}
          style={{
            flex: '1 1 180px',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            background: '#fff',
            color: canLog ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            fontFamily: 'var(--font-primary)',
            fontSize: '14px',
            fontWeight: 700,
            cursor: canLog ? 'pointer' : 'not-allowed',
          }}
        >
          Log and add another
        </button>
      </div>

      {/* Confirmation toast */}
      <AnimatePresence>
        {confirmation && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '12px 18px',
              borderRadius: '100px',
              background: '#1a5c3a',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 6px 24px rgba(26,92,58,0.3)',
              zIndex: 300,
              maxWidth: '92vw',
            }}
          >
            <Check size={14} strokeWidth={2.5} />
            {confirmation}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          marginBottom: '8px',
        }}
      >
        {label}
        {required && <span style={{ color: '#B91C1C', marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function PillGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{children}</div>;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '8px 14px',
        borderRadius: '100px',
        border: active ? '1.5px solid var(--color-accent-active)' : '1.5px solid var(--color-border-subtle)',
        background: active ? 'rgba(34,68,68,0.08)' : '#fff',
        color: active ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
        fontFamily: 'var(--font-primary)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

function DatePickerPill({
  active,
  value,
  onChange,
}: {
  active: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = value ? formatShortDate(value) : 'Pick a date';
  return (
    <label
      style={{
        position: 'relative',
        padding: '8px 14px',
        borderRadius: '100px',
        border: active ? '1.5px solid var(--color-accent-active)' : '1.5px solid var(--color-border-subtle)',
        background: active ? 'rgba(34,68,68,0.08)' : '#fff',
        color: active ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
        fontFamily: 'var(--font-primary)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
      }}
    >
      <Calendar size={13} strokeWidth={2} />
      <span>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Pick a date"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
        }}
      />
    </label>
  );
}

function formatShortDate(iso: string): string {
  // iso is YYYY-MM-DD from the native input
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(dt);
}

function StepperButton({
  onClick,
  children,
  'aria-label': ariaLabel,
}: {
  onClick: () => void;
  children: React.ReactNode;
  'aria-label': string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: '1px solid var(--color-border)',
        background: '#fff',
        color: 'var(--color-text-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
