'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Minus, Plus, Check, Calendar, ChevronLeft, ChevronRight, X, AlertTriangle } from 'lucide-react';
import {
  WASTE_REASONS,
  getProduct,
  type WasteProduct,
  type WasteReasonId,
} from '@/components/Waste/wasteData';

export default function WasteLogCard({
  itemId,
  initialQty,
  initialReason,
  queue,
  queueIndex,
}: {
  itemId: string;
  initialQty: number;
  initialReason: WasteReasonId | null;
  /** Ordered product ids currently being logged (multi-select flow). Empty = single-item flow. */
  queue?: string[];
  /** 0-based index into queue for the item being logged now. */
  queueIndex?: number;
}) {
  const router = useRouter();
  const product = getProduct(itemId);
  const [qty, setQty] = useState<number>(initialQty);
  const [uom, setUom] = useState<string>(product?.uomOptions[0] ?? 'unit');
  const [reason, setReason] = useState<WasteReasonId | null>(initialReason);
  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [pendingLog, setPendingLog] = useState<false | { andAddAnother: boolean }>(false);

  const hasQueue = (queue?.length ?? 0) > 0;
  const qIndex = queueIndex ?? 0;
  const qTotal = queue?.length ?? 0;
  const hasNextInQueue = hasQueue && qIndex + 1 < qTotal;

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

  function goToQueueItem(nextIndex: number) {
    if (!queue) return;
    const nextId = queue[nextIndex];
    router.push(
      `/log-waste?itemId=${encodeURIComponent(nextId)}&queue=${encodeURIComponent(queue.join(','))}&i=${nextIndex}`,
    );
  }

  function log(andAddAnother: boolean) {
    // Prototype — no persistence. Show a confirmation toast, then return.
    setConfirmation(
      `Logged ${qty} ${uom}${qty === 1 ? '' : 's'} of ${product!.name} · £${value.toFixed(2)}`,
    );
    setTimeout(() => {
      setConfirmation(null);
      if (hasNextInQueue) {
        goToQueueItem(qIndex + 1);
      } else if (andAddAnother) {
        goPicker();
      } else {
        goPicker();
      }
    }, 2500);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingBottom: '40px' }}>
      {hasQueue && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'var(--color-accent-quinn-tint, rgba(34,68,68,0.08))',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-accent-active)',
            }}
          >
            Sweep · {qIndex + 1} of {qTotal}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            {queue!.map((_, i) => (
              <span
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: i <= qIndex ? 'var(--color-accent-active)' : 'var(--color-border)',
                }}
              />
            ))}
          </span>
        </div>
      )}
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
        {/* Qty + Value, side-by-side, each takes half the row */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="Quantity">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  height: '42px',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border-subtle)',
                  background: '#fff',
                  overflow: 'hidden',
                }}
              >
                <StepperButton
                  onClick={() => setQty((q) => Math.max(0, +(q - 1).toFixed(2)))}
                  aria-label="Decrease quantity"
                >
                  <Minus size={15} strokeWidth={2.2} />
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
                    minWidth: 0,
                    height: '100%',
                    textAlign: 'center',
                    fontSize: '20px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display, var(--font-primary))',
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: 0,
                    MozAppearance: 'textfield',
                  }}
                />
                <StepperButton
                  onClick={() => setQty((q) => +(q + 1).toFixed(2))}
                  aria-label="Increase quantity"
                >
                  <Plus size={15} strokeWidth={2.2} />
                </StepperButton>
              </div>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Field label="Value">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '42px',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  background: 'var(--color-bg-hover)',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-display, var(--font-primary))',
                }}
              >
                £{value.toFixed(2)}
              </div>
            </Field>
          </div>
        </div>

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

      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => canLog && setPendingLog({ andAddAnother: false })}
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
          {hasNextInQueue ? `Log & next (${qIndex + 2}/${qTotal})` : 'Log'}
        </button>
        {!hasQueue && (
          <button
            type="button"
            onClick={() => canLog && setPendingLog({ andAddAnother: true })}
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
        )}
      </div>

      {pendingLog && (
        <ConfirmLogModal
          product={product!}
          qty={qty}
          uom={uom}
          value={value}
          reason={reason!}
          dateMode={dateMode}
          customDate={customDate}
          onCancel={() => setPendingLog(false)}
          onConfirm={() => {
            const payload = pendingLog;
            setPendingLog(false);
            log(payload.andAddAnother);
          }}
        />
      )}

      {/* Confirmation toast — large centered overlay */}
      <AnimatePresence>
        {confirmation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(3,28,89,0.22)',
                backdropFilter: 'blur(1px)',
                zIndex: 299,
              }}
            />
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                pointerEvents: 'none',
              }}
            >
              <motion.div
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  pointerEvents: 'auto',
                  width: 'min(320px, 100%)',
                  boxSizing: 'border-box',
                  padding: '24px 28px',
                  borderRadius: '18px',
                  background: '#1a5c3a',
                  color: '#fff',
                  textAlign: 'center',
                  boxShadow: '0 16px 48px rgba(26,92,58,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.16)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={26} strokeWidth={3} color="#fff" />
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display, var(--font-primary))',
                    lineHeight: 1.2,
                  }}
                >
                  {hasNextInQueue ? `Logged · ${qIndex + 1} of ${qTotal}` : 'Waste logged'}
                </span>
                <span style={{ fontSize: '13px', opacity: 0.88, lineHeight: 1.4 }}>{confirmation}</span>
              </motion.div>
            </div>
          </>
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
  const [open, setOpen] = useState(false);
  const label = value ? formatShortDate(value) : 'Pick a date';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-pressed={active}
        aria-label="Pick a date"
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
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
        }}
      >
        <Calendar size={13} strokeWidth={2} />
        <span>{label}</span>
      </button>
      <DatePickerModal
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </>
  );
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function DatePickerModal({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  const [view, setView] = useState(() => {
    const d = value ? parseIso(value) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    if (open) {
      const d = value ? parseIso(value) : new Date();
      setView({ year: d.getFullYear(), month: d.getMonth() });
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const firstOfMonth = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  // Monday-first: shift Sunday=0 to the end
  const offset = (firstOfMonth.getDay() + 6) % 7;
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(firstOfMonth);
  const todayIso = toIso(new Date());
  const selectedIso = value;

  function prevMonth() {
    setView(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
  }
  function nextMonth() {
    setView(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );
  }
  function pickDay(day: number) {
    onChange(
      `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    );
  }
  function pickToday() {
    onChange(todayIso);
  }
  function clearDate() {
    onChange('');
  }

  const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(3,28,89,0.25)',
          backdropFilter: 'blur(2px)',
          animation: 'dpFadeIn 0.2s ease-out',
        }}
      />
      <div
        role="dialog"
        aria-label="Pick a date"
        style={{
          position: 'relative',
          width: 'min(340px, 100%)',
          boxSizing: 'border-box',
          padding: '18px 18px 14px',
          borderRadius: 16,
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 16px 48px rgba(3,28,89,0.22)',
          fontFamily: 'var(--font-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'dpPop 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <style>{`@keyframes dpFadeIn { from { opacity: 0 } to { opacity: 1 } } @keyframes dpPop { from { opacity: 0; transform: translateY(12px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }`}</style>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={prevMonth}
                  aria-label="Previous month"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--color-bg-surface)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronLeft size={16} color="var(--color-text-secondary)" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next month"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--color-bg-surface)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ChevronRight size={16} color="var(--color-text-secondary)" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--color-bg-hover)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 4,
                  }}
                >
                  <X size={14} color="var(--color-text-muted)" />
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  rowGap: 4,
                }}
              >
                {dayHeaders.map((d, i) => (
                  <div
                    key={`h${i}`}
                    style={{
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      padding: '6px 0',
                    }}
                  >
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (day == null) {
                    return <div key={`e${i}`} />;
                  }
                  const iso = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = iso === selectedIso;
                  const isToday = iso === todayIso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => pickDay(day)}
                      aria-pressed={isSelected}
                      style={{
                        height: 38,
                        border: 'none',
                        borderRadius: 10,
                        background: isSelected ? 'var(--color-accent-active)' : 'transparent',
                        color: isSelected
                          ? '#fff'
                          : isToday
                          ? 'var(--color-accent-active)'
                          : 'var(--color-text-primary)',
                        fontFamily: 'var(--font-primary)',
                        fontSize: 14,
                        fontWeight: isSelected || isToday ? 700 : 500,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.15s ease, color 0.15s ease',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background =
                            'var(--color-bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      }}
                    >
                      {day}
                      {isToday && !isSelected && (
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            bottom: 5,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: 'var(--color-accent-active)',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 4,
                  borderTop: '1px solid var(--color-border-subtle)',
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={clearDate}
                  style={{
                    padding: '8px 4px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={pickToday}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Today
                </button>
              </div>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmLogModal({
  product,
  qty,
  uom,
  value,
  reason,
  dateMode,
  customDate,
  onCancel,
  onConfirm,
}: {
  product: WasteProduct;
  qty: number;
  uom: string;
  value: number;
  reason: WasteReasonId;
  dateMode: 'today' | 'yesterday' | 'custom';
  customDate: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reasonLabel = WASTE_REASONS.find((r) => r.id === reason)?.label ?? reason;
  const whenLabel =
    dateMode === 'today'
      ? 'Today'
      : dateMode === 'yesterday'
      ? 'Yesterday'
      : customDate
      ? formatShortDate(customDate)
      : 'Today';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(3,28,89,0.25)',
          backdropFilter: 'blur(2px)',
          animation: 'dpFadeIn 0.2s ease-out',
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm log waste"
        style={{
          position: 'relative',
          width: 'min(360px, 100%)',
          boxSizing: 'border-box',
          padding: '22px 22px 18px',
          borderRadius: 16,
          background: '#fff',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 16px 48px rgba(3,28,89,0.22)',
          fontFamily: 'var(--font-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'dpPop 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <style>{`@keyframes dpFadeIn { from { opacity: 0 } to { opacity: 1 } } @keyframes dpPop { from { opacity: 0; transform: translateY(12px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }`}</style>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(234,179,8,0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={20} color="#B45309" strokeWidth={2.2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                lineHeight: 1.25,
              }}
            >
              Log this waste?
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                lineHeight: 1.4,
                marginTop: 4,
              }}
            >
              This writes to today&rsquo;s waste log and affects reports. You can still remove it
              from the Today or 7-day tabs.
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--color-bg-hover)',
            fontSize: 13,
            color: 'var(--color-text-primary)',
          }}
        >
          <SummaryRow label="Item" value={product.name} />
          <SummaryRow label="Quantity" value={`${qty} ${uom}${qty === 1 ? '' : 's'}`} />
          <SummaryRow label="Reason" value={reasonLabel} />
          <SummaryRow label="When" value={whenLabel} />
          <SummaryRow label="Value" value={`£${value.toFixed(2)}`} strong />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid var(--color-border)',
              background: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-accent-deep)',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 14,
              fontWeight: 700,
              color: '#F4F1EC',
            }}
          >
            Yes, log it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: strong ? 14 : 13,
          fontWeight: strong ? 700 : 600,
          color: 'var(--color-text-primary)',
          textAlign: 'right',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
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
        width: '40px',
        height: '40px',
        borderRadius: 0,
        border: 'none',
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
