'use client';

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import s from './basket.module.css';

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'cream' | 'onDark';
  size?: 'sm' | 'md' | 'lg';
};

const VARIANTS = {
  primary: s.btnPrimary,
  outline: s.btnOutline,
  ghost: s.btnGhost,
  cream: s.btnCream,
  onDark: s.btnOnDark,
};

export function Button({ variant = 'outline', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(s.btn, VARIANTS[variant], size === 'sm' && s.btnSm, size === 'lg' && s.btnLg, className)}
      {...props}
    />
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn' | 'ok' | 'muted'; children: ReactNode }) {
  return (
    <span className={cx(s.badge, tone === 'warn' && s.badgeWarn, tone === 'ok' && s.badgeOk, tone === 'muted' && s.badgeMuted)}>
      {children}
    </span>
  );
}

export function QuantityStepper({
  value,
  onChange,
  label,
  warn,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className={cx(s.stepper, warn && s.stepperWarn)}>
      <button type="button" className={s.stepBtn} onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`Less ${label}`}>
        <Minus size={14} strokeWidth={2.25} aria-hidden />
      </button>
      <input
        className={s.stepInput}
        type="number"
        inputMode="decimal"
        min={0}
        step={1}
        value={value}
        aria-label={`Quantity of ${label}`}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      <button type="button" className={s.stepBtn} onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        <Plus size={14} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}

export function DeleteIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={cx(s.iconBtn, s.deleteBtn)} onClick={onClick} aria-label={label}>
      <Trash2 size={16} aria-hidden />
    </button>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = ref.current?.querySelector<HTMLElement>('button, [href], input, textarea');
    focusable?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={s.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={s.dialogTitle}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Closes a popover when the user clicks outside it or presses Escape. */
export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}
