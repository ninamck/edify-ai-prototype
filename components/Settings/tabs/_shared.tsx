'use client';

/**
 * Shared building blocks for every settings tab — keeps the visual rhythm
 * consistent (principle 7 — learnable patterns) and stops each tab
 * re-inventing field rows / pills / cascade captions.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import StatusPill from '@/components/Production/StatusPill';
import type {
  SettingsHealthItem,
  SiteId,
} from '@/components/Production/fixtures';
import type { SiteSettingsOverlay } from '../siteSettingsStore';

export type TabProps = {
  siteId: SiteId;
  editing: boolean;
  staged: SiteSettingsOverlay;
  onStage: (p: SiteSettingsOverlay) => void;
  /** Settings Health items relevant to this tab. */
  health: SettingsHealthItem[];
};

// ─── Section card ────────────────────────────────────────────────────────────

export function Section({
  title,
  description,
  children,
  rightSlot,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  rightSlot?: ReactNode;
}) {
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {title}
          </div>
          {description && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {description}
            </div>
          )}
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  );
}

// ─── Field row ───────────────────────────────────────────────────────────────

/**
 * A field row: label on the left (or top on narrow), input on the right,
 * optional cascade caption + reset link underneath.
 */
export function FieldRow({
  label,
  hint,
  control,
  cascade,
  onReset,
  isOverridden,
  fullWidthControl = false,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
  /** "from format default · 06:00" — shown beneath the control. */
  cascade?: string;
  /** When provided, an inline "Use default" link appears under the control. */
  onReset?: () => void;
  isOverridden?: boolean;
  /** When true, the control gets the full row width (text inputs etc.). */
  fullWidthControl?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 200px) minmax(0, 1fr)',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            {hint}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 0,
          alignItems: fullWidthControl ? 'stretch' : 'flex-start',
        }}
      >
        {control}
        {(cascade || onReset) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {cascade && (
              <span
                style={{
                  fontSize: 10.5,
                  color: 'var(--color-text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Info size={10} /> {cascade}
              </span>
            )}
            {onReset && isOverridden && (
              <button
                type="button"
                onClick={onReset}
                style={{
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-info)',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontFamily: 'var(--font-primary)',
                }}
              >
                <RotateCcw size={10} /> Use default
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pill picker (single + multi) ────────────────────────────────────────────

export function PillPicker<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ id: T; label: string; sublabel?: string }>;
  value: T | null | undefined;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.id)}
            style={pillStyle(active, disabled)}
            title={o.sublabel}
          >
            {o.label}
            {o.sublabel && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  opacity: 0.7,
                }}
              >
                {o.sublabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PillMultiPicker<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ id: T; label: string }>;
  value: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: T) {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else onChange([...value, id]);
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(o.id)}
            style={pillStyle(active, disabled)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function pillStyle(active: boolean, disabled: boolean | undefined): CSSProperties {
  return {
    padding: '7px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'var(--font-primary)',
    background: active
      ? 'var(--color-accent-active)'
      : disabled
      ? 'var(--color-bg-hover)'
      : '#ffffff',
    color: active
      ? 'var(--color-text-on-active)'
      : disabled
      ? 'var(--color-text-muted)'
      : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-accent-active)' : 'var(--color-border)'}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.7 : 1,
  };
}

// ─── Time / text inputs ──────────────────────────────────────────────────────

export function TextInput({
  value,
  onChange,
  disabled,
  placeholder,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  width?: number | string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
        fontSize: 13,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        width: width ?? '100%',
        minHeight: 38,
      }}
    />
  );
}

export function TimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: disabled ? 'var(--color-bg-hover)' : '#ffffff',
        fontSize: 13,
        fontFamily: 'var(--font-primary)',
        color: 'var(--color-text-primary)',
        minHeight: 38,
        minWidth: 110,
      }}
    />
  );
}

// ─── Health alert strip ──────────────────────────────────────────────────────

export function HealthAlertStrip({ items }: { items: SettingsHealthItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-warning-light)',
        border: '1px solid var(--color-warning-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusPill tone="warning" label={`${items.length} health alert${items.length === 1 ? '' : 's'}`} size="xs" />
        <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 700 }}>
          Quinn flagged drift on the settings below — saving now will mark them resolved.
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(i => (
          <li key={i.id} style={{ fontSize: 11, color: 'var(--color-text-primary)', fontWeight: 600 }}>
            · {i.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Read-only badge (for spoke locked fields) ───────────────────────────────

export function ReadOnlyValue({ value, hint }: { value: string; hint?: string }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        background: 'var(--color-bg-hover)',
        border: '1px solid var(--color-border-subtle)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 2,
        minHeight: 38,
        justifyContent: 'center',
        minWidth: 120,
      }}
    >
      <span>{value}</span>
      {hint && (
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}
