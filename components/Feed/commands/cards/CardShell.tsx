'use client';

/**
 * Shared chrome for every work card in the chat / workspace panel.
 * Each card sits inside this shell so the visual language is
 * consistent: a small header (icon + title + optional context), a
 * body slot, and a footer row with Cancel + Confirm.
 *
 * Cards have four states: `pending` (initial), `confirmed` (action
 * committed, controls disabled), `cancelled` (greyed out), and
 * `partial` (committed but some rows failed — amber badge). The
 * shell owns the styling for those states; callers just forward
 * `state`. Completed cards persist with their badge — they never
 * disappear, so the panel doubles as the session's audit trail.
 */

import type { ComponentType, ReactNode, SVGProps } from 'react';
import { AlertTriangle, Check, Pencil, X } from 'lucide-react';
import type React from 'react';

export type CardState = 'pending' | 'confirmed' | 'cancelled' | 'partial';

/**
 * Common shape between lucide icons and our own `EdifyMark` glyph —
 * both accept `size`, `color`, `strokeWidth`, plus pass-through SVG
 * props. Typed loose enough that either works without ts gymnastics
 * at the call site.
 */
export type CardIcon = ComponentType<
  Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'color'> & {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
  }
>;

interface CardShellProps {
  icon: CardIcon;
  title: string;
  subtitle?: string;
  state: CardState;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmDisabled?: boolean;
  /** Optional inline warning line, rendered between body and footer
   *  (e.g. "Variance −2 vs expected — Quinn will flag this"). */
  warning?: string;
  /** When provided, a confirmed card shows an Edit button beside the
   *  Done badge — used by wizard flows where any step stays editable
   *  until the final confirm. */
  onEdit?: () => void;
  children: ReactNode;
}

export default function CardShell({
  icon: Icon,
  title,
  subtitle,
  state,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmDisabled,
  warning,
  onEdit,
  children,
}: CardShellProps) {
  const disabled = state !== 'pending';
  const style: React.CSSProperties = {
    marginTop: '8px',
    borderRadius: '14px',
    background: '#fff',
    border: '1px solid var(--color-border-subtle, rgba(0,28,53,0.12))',
    boxShadow: '0 4px 16px rgba(0, 28, 53,0.08)',
    overflow: 'hidden',
    opacity: state === 'cancelled' ? 0.55 : 1,
    fontFamily: 'var(--font-primary)',
  };

  return (
    <div style={style}>
      {/* Header — bare outline icon (no chip behind it), matching the
          command-centre / task-history list pattern. The reduced
          padding pulls the card height down by ~8px overall. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '9px 12px',
          borderBottom: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
        }}
      >
        <Icon
          size={15}
          color="var(--color-text-muted)"
          strokeWidth={1.9}
          style={{ flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</div>
          {subtitle && (
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                marginTop: '1px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {state === 'confirmed' && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '100px',
              border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              background: '#fff',
              color: 'var(--color-text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-primary)',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              marginRight: '2px',
            }}
          >
            <Pencil size={11} strokeWidth={2.2} /> Edit
          </button>
        )}
        {state === 'confirmed' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '100px',
              background: 'rgba(45,106,79,0.12)',
              color: '#2D6A4F',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <Check size={11} strokeWidth={2.5} /> Done
          </span>
        )}
        {state === 'cancelled' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '100px',
              background: 'rgba(0, 28, 53,0.06)',
              color: 'var(--color-text-muted)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <X size={11} strokeWidth={2.5} /> Cancelled
          </span>
        )}
        {state === 'partial' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '100px',
              background: '#FEF3E2',
              color: '#7A3800',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            <AlertTriangle size={11} strokeWidth={2.5} /> Partial
          </span>
        )}
      </div>

      <div style={{ padding: '12px' }}>{children}</div>

      {warning && state === 'pending' && (
        <div
          style={{
            padding: '7px 12px',
            background: '#FEF9F3',
            borderTop: '1px solid #F5E6D3',
            color: '#7A3800',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {warning}
        </div>
      )}

      {state === 'pending' && (onConfirm || onCancel) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '8px 12px',
            borderTop: '1px solid var(--color-border-subtle, rgba(0,28,53,0.08))',
            background: 'rgba(0,28,53,0.015)',
          }}
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={disabled}
              style={{
                padding: '7px 14px',
                borderRadius: '100px',
                border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
                background: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {cancelLabel}
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled || confirmDisabled}
              style={{
                padding: '7px 16px',
                borderRadius: '100px',
                border: 'none',
                background: 'var(--color-accent-active, #001C35)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-primary)',
                cursor: (disabled || confirmDisabled) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(0,28,53,0.22)',
                opacity: confirmDisabled ? 0.55 : 1,
              }}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared bits used across cards ────────────────────────────────────────

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '6px 0',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
        }}
      >
        {label}
      </span>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{children}</div>
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  disabled,
  min = 0,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  step?: number;
}) {
  const btn: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
    background: '#fff',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'var(--color-text-primary)',
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.max(min, value - step))}
        style={btn}
        aria-label="Decrement"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        style={{
          width: '56px',
          height: '32px',
          textAlign: 'center',
          border: '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 700,
          fontFamily: 'var(--font-primary)',
          color: 'var(--color-text-primary)',
          background: '#fff',
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + step)}
        style={btn}
        aria-label="Increment"
      >
        +
      </button>
    </div>
  );
}

export function PillRow<T extends string | number>({
  options,
  selected,
  onSelect,
  disabled,
  small,
}: {
  options: { value: T; label: string }[];
  selected: T | undefined;
  onSelect: (v: T) => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            style={{
              padding: small ? '4px 10px' : '6px 12px',
              borderRadius: '100px',
              border: active
                ? '1.5px solid var(--color-accent-active, #001C35)'
                : '1.5px solid var(--color-border, rgba(0,28,53,0.18))',
              background: active ? 'var(--color-accent-active, #001C35)' : '#fff',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              fontSize: small ? '11px' : '12px',
              fontWeight: 600,
              fontFamily: 'var(--font-primary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
